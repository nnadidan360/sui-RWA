export interface ConnectionHealth {
  isConnected: boolean;
  lastHeartbeat: number;
  reconnectAttempts: number;
  latency: number;
  strategy: 'sse' | 'polling';
}

export interface ConnectionConfig {
  heartbeatInterval: number; // milliseconds
  maxReconnectAttempts: number;
  reconnectDelay: number; // milliseconds
  maxReconnectDelay: number; // milliseconds
  latencyThreshold: number; // milliseconds
  healthCheckInterval: number; // milliseconds
}

export class ConnectionMonitor {
  private config: ConnectionConfig;
  private health: ConnectionHealth;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private listeners: Set<(health: ConnectionHealth) => void> = new Set();

  constructor(config: Partial<ConnectionConfig> = {}) {
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      maxReconnectAttempts: 5,
      reconnectDelay: 1000, // 1 second
      maxReconnectDelay: 30000, // 30 seconds
      latencyThreshold: 5000, // 5 seconds
      healthCheckInterval: 10000, // 10 seconds
      ...config,
    };

    this.health = {
      isConnected: false,
      lastHeartbeat: 0,
      reconnectAttempts: 0,
      latency: 0,
      strategy: 'sse',
    };
  }

  start(): void {
    this.startHeartbeat();
    this.startHealthCheck();
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  updateConnection(isConnected: boolean, strategy: 'sse' | 'polling' = 'sse'): void {
    const wasConnected = this.health.isConnected;
    
    this.health.isConnected = isConnected;
    this.health.strategy = strategy;
    this.health.lastHeartbeat = Date.now();
    
    if (isConnected && !wasConnected) {
      // Connection restored
      this.health.reconnectAttempts = 0;
    }
    
    this.notifyListeners();
  }

  recordLatency(latency: number): void {
    this.health.latency = latency;
    this.notifyListeners();
  }

  incrementReconnectAttempts(): void {
    this.health.reconnectAttempts++;
    this.notifyListeners();
  }

  shouldReconnect(): boolean {
    return this.health.reconnectAttempts < this.config.maxReconnectAttempts;
  }

  getReconnectDelay(): number {
    // Exponential backoff with jitter
    const baseDelay = this.config.reconnectDelay;
    const exponentialDelay = baseDelay * Math.pow(2, this.health.reconnectAttempts);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    
    return Math.min(exponentialDelay + jitter, this.config.maxReconnectDelay);
  }

  shouldFallbackToPolling(): boolean {
    return (
      !this.health.isConnected ||
      this.health.latency > this.config.latencyThreshold ||
      this.health.reconnectAttempts >= 2
    );
  }

  getHealth(): ConnectionHealth {
    return { ...this.health };
  }

  onHealthChange(listener: (health: ConnectionHealth) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeSinceLastHeartbeat = now - this.health.lastHeartbeat;
      
      if (timeSinceLastHeartbeat > this.config.heartbeatInterval * 2) {
        // Connection appears to be stale
        this.updateConnection(false);
      }
    }, this.config.heartbeatInterval);
  }

  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Perform a simple health check request
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      if (response.ok) {
        this.recordLatency(latency);
        if (!this.health.isConnected) {
          this.updateConnection(true);
        }
      } else {
        this.updateConnection(false);
      }
    } catch (error) {
      this.updateConnection(false);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getHealth());
      } catch (error) {
        console.error('Error in connection health listener:', error);
      }
    });
  }
}

// Singleton instance
let connectionMonitor: ConnectionMonitor | null = null;

export function getConnectionMonitor(): ConnectionMonitor {
  if (!connectionMonitor) {
    connectionMonitor = new ConnectionMonitor();
  }
  
  return connectionMonitor;
}