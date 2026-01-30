'use client';

import { getConnectionMonitor, ConnectionHealth } from './connection-monitor';

export type { ConnectionHealth };

export interface RealtimeEvent {
  id: string;
  type: string;
  data: any;
  timestamp: number;
}

export interface RealtimeClientConfig {
  sseEndpoint: string;
  pollingEndpoint: string;
  pollingInterval: number;
  maxRetries: number;
  userId?: string;
}

export type EventHandler = (event: RealtimeEvent) => void;
export type ErrorHandler = (error: Error) => void;
export type ConnectionHandler = (connected: boolean) => void;

export class RealtimeClient {
  private config: RealtimeClientConfig;
  private eventSource: EventSource | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private connectionMonitor = getConnectionMonitor();
  private lastEventTimestamp = 0;
  private isActive = false;
  private currentStrategy: 'sse' | 'polling' = 'sse';

  private eventHandlers = new Map<string, Set<EventHandler>>();
  private errorHandlers = new Set<ErrorHandler>();
  private connectionHandlers = new Set<ConnectionHandler>();

  constructor(config: RealtimeClientConfig) {
    this.config = {
      ...config,
      pollingInterval: config.pollingInterval ?? 5000, // 5 seconds
      maxRetries: config.maxRetries ?? 3,
    };

    // Listen to connection health changes
    this.connectionMonitor.onHealthChange(this.handleHealthChange.bind(this));
  }

  async connect(): Promise<void> {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.connectionMonitor.start();
    
    // Try SSE first, fallback to polling if needed
    await this.trySSEConnection();
  }

  disconnect(): void {
    this.isActive = false;
    this.connectionMonitor.stop();
    this.closeSSEConnection();
    this.stopPolling();
  }

  on(eventType: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    
    this.eventHandlers.get(eventType)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(eventType);
        }
      }
    };
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  getCurrentStrategy(): 'sse' | 'polling' {
    return this.currentStrategy;
  }

  getConnectionHealth(): ConnectionHealth {
    return this.connectionMonitor.getHealth();
  }

  private async trySSEConnection(): Promise<void> {
    if (!this.isActive) return;

    try {
      const url = new URL(this.config.sseEndpoint, window.location.origin);
      if (this.config.userId) {
        url.searchParams.set('userId', this.config.userId);
      }
      if (this.lastEventTimestamp > 0) {
        url.searchParams.set('since', this.lastEventTimestamp.toString());
      }

      this.eventSource = new EventSource(url.toString());
      this.currentStrategy = 'sse';

      this.eventSource.onopen = () => {
        this.connectionMonitor.updateConnection(true, 'sse');
        this.notifyConnectionHandlers(true);
      };

      this.eventSource.onmessage = (event) => {
        this.handleSSEMessage(event);
      };

      this.eventSource.onerror = (error) => {
        this.handleSSEError(error);
      };

      // Add custom event listeners for different event types
      this.eventSource.addEventListener('heartbeat', (event) => {
        this.connectionMonitor.updateConnection(true, 'sse');
      });

    } catch (error) {
      this.handleConnectionError(error as Error);
    }
  }

  private handleSSEMessage(event: MessageEvent): void {
    try {
      const realtimeEvent: RealtimeEvent = JSON.parse(event.data);
      this.lastEventTimestamp = Math.max(this.lastEventTimestamp, realtimeEvent.timestamp);
      this.emitEvent(realtimeEvent);
    } catch (error) {
      this.notifyErrorHandlers(new Error('Failed to parse SSE message'));
    }
  }

  private handleSSEError(error: Event): void {
    this.connectionMonitor.updateConnection(false, 'sse');
    this.notifyConnectionHandlers(false);

    if (this.isActive && this.connectionMonitor.shouldReconnect()) {
      this.connectionMonitor.incrementReconnectAttempts();
      
      if (this.connectionMonitor.shouldFallbackToPolling()) {
        this.fallbackToPolling();
      } else {
        // Retry SSE connection with exponential backoff
        const delay = this.connectionMonitor.getReconnectDelay();
        setTimeout(() => {
          if (this.isActive) {
            this.closeSSEConnection();
            this.trySSEConnection();
          }
        }, delay);
      }
    }
  }

  private fallbackToPolling(): void {
    this.closeSSEConnection();
    this.startPolling();
  }

  private startPolling(): void {
    if (this.pollingTimer) {
      return;
    }

    this.currentStrategy = 'polling';
    this.connectionMonitor.updateConnection(true, 'polling');
    this.notifyConnectionHandlers(true);

    this.pollingTimer = setInterval(() => {
      this.performPoll();
    }, this.config.pollingInterval);

    // Perform initial poll
    this.performPoll();
  }

  private async performPoll(): Promise<void> {
    if (!this.isActive) return;

    try {
      const startTime = Date.now();
      const url = new URL(this.config.pollingEndpoint, window.location.origin);
      
      if (this.config.userId) {
        url.searchParams.set('userId', this.config.userId);
      }
      if (this.lastEventTimestamp > 0) {
        url.searchParams.set('since', this.lastEventTimestamp.toString());
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      const endTime = Date.now();
      this.connectionMonitor.recordLatency(endTime - startTime);

      if (!response.ok) {
        throw new Error(`Polling failed: ${response.status}`);
      }

      const events: RealtimeEvent[] = await response.json();
      
      events.forEach(event => {
        this.lastEventTimestamp = Math.max(this.lastEventTimestamp, event.timestamp);
        this.emitEvent(event);
      });

      this.connectionMonitor.updateConnection(true, 'polling');

    } catch (error) {
      this.connectionMonitor.updateConnection(false, 'polling');
      this.notifyErrorHandlers(error as Error);
    }
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private closeSSEConnection(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private handleHealthChange(health: ConnectionHealth): void {
    // Switch strategies based on connection health
    if (this.isActive && health.isConnected) {
      if (health.strategy === 'polling' && !this.connectionMonitor.shouldFallbackToPolling()) {
        // Try to upgrade back to SSE
        this.stopPolling();
        this.trySSEConnection();
      }
    }
  }

  private handleConnectionError(error: Error): void {
    this.notifyErrorHandlers(error);
    
    if (this.connectionMonitor.shouldFallbackToPolling()) {
      this.fallbackToPolling();
    }
  }

  private emitEvent(event: RealtimeEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      });
    }

    // Also emit to wildcard handlers
    const wildcardHandlers = this.eventHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in wildcard event handler:', error);
        }
      });
    }
  }

  private notifyErrorHandlers(error: Error): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (err) {
        console.error('Error in error handler:', err);
      }
    });
  }

  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach(handler => {
      try {
        handler(connected);
      } catch (error) {
        console.error('Error in connection handler:', error);
      }
    });
  }
}

// Global instance management
let globalClient: RealtimeClient | null = null;

export function createRealtimeClient(config: RealtimeClientConfig): RealtimeClient {
  return new RealtimeClient(config);
}

export function getGlobalRealtimeClient(config?: RealtimeClientConfig): RealtimeClient {
  if (!globalClient && config) {
    globalClient = new RealtimeClient(config);
  }
  
  if (!globalClient) {
    throw new Error('Global realtime client not initialized. Call with config first.');
  }
  
  return globalClient;
}