/**
 * Connection Monitor for Backend Real-time Services
 * 
 * Monitors client connections and manages connection health
 */

import { logger } from '../../utils/logger';

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

export interface ClientConnection {
  id: string;
  userId?: string;
  connectedAt: Date;
  lastActivity: Date;
  health: ConnectionHealth;
  metadata: Record<string, any>;
}

export class ConnectionMonitor {
  private config: ConnectionConfig;
  private connections: Map<string, ClientConnection> = new Map();
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private listeners: Set<(connections: ClientConnection[]) => void> = new Set();

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

    logger.info('Connection Monitor initialized', { config: this.config });
  }

  /**
   * Start monitoring connections
   */
  start(): void {
    this.startHealthCheck();
    logger.info('Connection monitoring started');
  }

  /**
   * Stop monitoring connections
   */
  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    logger.info('Connection monitoring stopped');
  }

  /**
   * Register a new client connection
   */
  registerConnection(
    connectionId: string, 
    userId?: string, 
    metadata: Record<string, any> = {}
  ): ClientConnection {
    const connection: ClientConnection = {
      id: connectionId,
      userId,
      connectedAt: new Date(),
      lastActivity: new Date(),
      health: {
        isConnected: true,
        lastHeartbeat: Date.now(),
        reconnectAttempts: 0,
        latency: 0,
        strategy: 'sse',
      },
      metadata,
    };

    this.connections.set(connectionId, connection);
    this.notifyListeners();

    logger.info('Client connection registered', { 
      connectionId, 
      userId, 
      totalConnections: this.connections.size 
    });

    return connection;
  }

  /**
   * Unregister a client connection
   */
  unregisterConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.connections.delete(connectionId);
      this.notifyListeners();

      logger.info('Client connection unregistered', { 
        connectionId, 
        userId: connection.userId,
        totalConnections: this.connections.size 
      });
    }
  }

  /**
   * Update connection activity
   */
  updateConnectionActivity(
    connectionId: string, 
    isConnected: boolean = true, 
    strategy: 'sse' | 'polling' = 'sse'
  ): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date();
      connection.health.isConnected = isConnected;
      connection.health.strategy = strategy;
      connection.health.lastHeartbeat = Date.now();
      
      if (isConnected) {
        connection.health.reconnectAttempts = 0;
      }
      
      this.notifyListeners();
    }
  }

  /**
   * Record connection latency
   */
  recordLatency(connectionId: string, latency: number): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.health.latency = latency;
      this.notifyListeners();
    }
  }

  /**
   * Increment reconnect attempts for a connection
   */
  incrementReconnectAttempts(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.health.reconnectAttempts++;
      this.notifyListeners();
    }
  }

  /**
   * Check if connection should reconnect
   */
  shouldReconnect(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    return connection ? 
      connection.health.reconnectAttempts < this.config.maxReconnectAttempts : 
      false;
  }

  /**
   * Get reconnect delay for a connection
   */
  getReconnectDelay(connectionId: string): number {
    const connection = this.connections.get(connectionId);
    if (!connection) return this.config.reconnectDelay;

    // Exponential backoff with jitter
    const baseDelay = this.config.reconnectDelay;
    const exponentialDelay = baseDelay * Math.pow(2, connection.health.reconnectAttempts);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    
    return Math.min(exponentialDelay + jitter, this.config.maxReconnectDelay);
  }

  /**
   * Check if connection should fallback to polling
   */
  shouldFallbackToPolling(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    return (
      !connection.health.isConnected ||
      connection.health.latency > this.config.latencyThreshold ||
      connection.health.reconnectAttempts >= 2
    );
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): ClientConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections for a user
   */
  getUserConnections(userId: string): ClientConnection[] {
    return Array.from(this.connections.values()).filter(
      conn => conn.userId === userId
    );
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): ClientConnection[] {
    return Array.from(this.connections.values()).filter(
      conn => conn.health.isConnected
    );
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    total: number;
    active: number;
    inactive: number;
    byStrategy: Record<string, number>;
    averageLatency: number;
  } {
    const connections = Array.from(this.connections.values());
    const active = connections.filter(conn => conn.health.isConnected);
    const inactive = connections.filter(conn => !conn.health.isConnected);

    const byStrategy = connections.reduce((acc, conn) => {
      acc[conn.health.strategy] = (acc[conn.health.strategy] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalLatency = connections.reduce((sum, conn) => sum + conn.health.latency, 0);
    const averageLatency = connections.length > 0 ? totalLatency / connections.length : 0;

    return {
      total: connections.length,
      active: active.length,
      inactive: inactive.length,
      byStrategy,
      averageLatency,
    };
  }

  /**
   * Listen to connection changes
   */
  onConnectionsChange(listener: (connections: ClientConnection[]) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Cleanup stale connections
   */
  cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = this.config.heartbeatInterval * 3; // 3x heartbeat interval
    let cleanedCount = 0;

    for (const [connectionId, connection] of this.connections.entries()) {
      const timeSinceLastActivity = now - connection.lastActivity.getTime();
      
      if (timeSinceLastActivity > staleThreshold) {
        this.connections.delete(connectionId);
        cleanedCount++;
        
        logger.debug('Cleaned up stale connection', { 
          connectionId, 
          userId: connection.userId,
          timeSinceLastActivity 
        });
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up stale connections', { 
        cleanedCount, 
        remainingConnections: this.connections.size 
      });
      this.notifyListeners();
    }
  }

  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  private performHealthCheck(): void {
    // Clean up stale connections
    this.cleanupStaleConnections();

    // Log connection statistics
    const stats = this.getConnectionStats();
    logger.debug('Connection health check', { stats });
  }

  private notifyListeners(): void {
    const connections = Array.from(this.connections.values());
    this.listeners.forEach(listener => {
      try {
        listener(connections);
      } catch (error) {
        logger.error('Error in connection change listener', { error: (error as Error).message });
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