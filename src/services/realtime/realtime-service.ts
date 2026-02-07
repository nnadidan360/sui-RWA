/**
 * Real-time Service for Backend
 * 
 * Manages real-time communication with clients via SSE and WebSocket
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { getEventStore, RealtimeEvent } from './event-store';
import { getConnectionMonitor, ClientConnection } from './connection-monitor';

export interface SSEConnection {
  id: string;
  userId?: string;
  response: Response;
  lastEventId?: string;
  connectedAt: Date;
}

export interface RealtimeServiceConfig {
  heartbeatInterval: number;
  maxConnections: number;
  eventRetentionTime: number; // milliseconds
}

export class RealtimeService {
  private config: RealtimeServiceConfig;
  private sseConnections: Map<string, SSEConnection> = new Map();
  private eventStore = getEventStore();
  private connectionMonitor = getConnectionMonitor();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<RealtimeServiceConfig> = {}) {
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      maxConnections: 1000,
      eventRetentionTime: 24 * 60 * 60 * 1000, // 24 hours
      ...config,
    };

    logger.info('Realtime Service initialized', { config: this.config });
  }

  /**
   * Start the real-time service
   */
  start(): void {
    this.connectionMonitor.start();
    this.startHeartbeat();
    logger.info('Realtime Service started');
  }

  /**
   * Stop the real-time service
   */
  stop(): void {
    this.connectionMonitor.stop();
    this.stopHeartbeat();
    
    // Close all SSE connections
    for (const connection of this.sseConnections.values()) {
      this.closeSSEConnection(connection.id);
    }
    
    logger.info('Realtime Service stopped');
  }

  /**
   * Handle SSE connection request
   */
  async handleSSEConnection(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.query.userId as string;
      const since = req.query.since ? parseInt(req.query.since as string) : 0;
      
      // Check connection limits
      if (this.sseConnections.size >= this.config.maxConnections) {
        res.status(503).json({ error: 'Maximum connections reached' });
        return;
      }

      // Set up SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });

      // Generate connection ID
      const connectionId = this.generateConnectionId();

      // Create SSE connection
      const sseConnection: SSEConnection = {
        id: connectionId,
        userId,
        response: res,
        lastEventId: since.toString(),
        connectedAt: new Date(),
      };

      this.sseConnections.set(connectionId, sseConnection);

      // Register with connection monitor
      this.connectionMonitor.registerConnection(connectionId, userId, {
        type: 'sse',
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });

      // Send initial connection event
      this.sendSSEEvent(connectionId, {
        type: 'connection',
        data: { connectionId, connected: true },
      });

      // Send missed events if any
      if (userId && since > 0) {
        await this.sendMissedEvents(connectionId, userId, since);
      }

      // Handle connection close
      req.on('close', () => {
        this.closeSSEConnection(connectionId);
      });

      req.on('error', (error) => {
        logger.error('SSE connection error', { 
          error: (error as Error).message, 
          connectionId, 
          userId 
        });
        this.closeSSEConnection(connectionId);
      });

      logger.info('SSE connection established', { connectionId, userId });
    } catch (error) {
      logger.error('Failed to handle SSE connection', { error: (error as Error).message });
      res.status(500).json({ error: 'Failed to establish SSE connection' });
    }
  }

  /**
   * Handle polling request
   */
  async handlePollingRequest(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.query.userId as string;
      const since = req.query.since ? parseInt(req.query.since as string) : 0;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      // Get events since timestamp
      const events = await this.eventStore.getEventsSince(userId, since);
      const limitedEvents = events.slice(0, limit);

      // Update connection activity
      const connectionId = `polling_${userId}_${Date.now()}`;
      this.connectionMonitor.registerConnection(connectionId, userId, {
        type: 'polling',
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });

      // Clean up polling connection immediately
      setTimeout(() => {
        this.connectionMonitor.unregisterConnection(connectionId);
      }, 1000);

      res.json({
        events: limitedEvents,
        timestamp: Date.now(),
        hasMore: events.length > limit,
      });

      logger.debug('Polling request handled', { 
        userId, 
        since, 
        eventCount: limitedEvents.length 
      });
    } catch (error) {
      logger.error('Failed to handle polling request', { 
        error: (error as Error).message, 
        userId: req.query.userId 
      });
      res.status(500).json({ error: 'Failed to get events' });
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  async broadcastEvent(event: Omit<RealtimeEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      // Store event
      const storedEvent = await this.eventStore.addEvent(event);

      // Send to all SSE connections for this user
      const userConnections = Array.from(this.sseConnections.values())
        .filter(conn => conn.userId === event.userId);

      for (const connection of userConnections) {
        this.sendSSEEvent(connection.id, {
          type: event.type,
          data: event.data,
          id: storedEvent.id,
          timestamp: storedEvent.timestamp,
        });
      }

      logger.debug('Event broadcasted', { 
        eventId: storedEvent.id, 
        userId: event.userId, 
        type: event.type,
        connectionCount: userConnections.length 
      });
    } catch (error) {
      logger.error('Failed to broadcast event', { 
        error: (error as Error).message, 
        userId: event.userId, 
        type: event.type 
      });
      throw error;
    }
  }

  /**
   * Send event to specific user
   */
  async sendEventToUser(
    userId: string, 
    event: Omit<RealtimeEvent, 'id' | 'timestamp' | 'userId'>
  ): Promise<void> {
    await this.broadcastEvent({
      ...event,
      userId,
    });
  }

  /**
   * Send event to multiple users
   */
  async sendEventToUsers(
    userIds: string[], 
    event: Omit<RealtimeEvent, 'id' | 'timestamp' | 'userId'>
  ): Promise<void> {
    for (const userId of userIds) {
      await this.sendEventToUser(userId, event);
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    sseConnections: number;
    totalConnections: number;
    connectionsByUser: Record<string, number>;
  } {
    const connectionsByUser: Record<string, number> = {};
    
    for (const connection of this.sseConnections.values()) {
      if (connection.userId) {
        connectionsByUser[connection.userId] = (connectionsByUser[connection.userId] || 0) + 1;
      }
    }

    const monitorStats = this.connectionMonitor.getConnectionStats();

    return {
      sseConnections: this.sseConnections.size,
      totalConnections: monitorStats.total,
      connectionsByUser,
    };
  }

  /**
   * Get user connections
   */
  getUserConnections(userId: string): ClientConnection[] {
    return this.connectionMonitor.getUserConnections(userId);
  }

  /**
   * Disconnect user
   */
  disconnectUser(userId: string): void {
    // Close SSE connections
    const userSSEConnections = Array.from(this.sseConnections.values())
      .filter(conn => conn.userId === userId);

    for (const connection of userSSEConnections) {
      this.closeSSEConnection(connection.id);
    }

    logger.info('User disconnected', { userId, connectionCount: userSSEConnections.length });
  }

  private generateConnectionId(): string {
    return `sse_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private sendSSEEvent(connectionId: string, event: {
    type: string;
    data: any;
    id?: string;
    timestamp?: number;
  }): void {
    const connection = this.sseConnections.get(connectionId);
    if (!connection) {
      return;
    }

    try {
      const eventData = JSON.stringify(event.data);
      
      if (event.id) {
        connection.response.write(`id: ${event.id}\n`);
      }
      
      connection.response.write(`event: ${event.type}\n`);
      connection.response.write(`data: ${eventData}\n\n`);

      // Update connection activity
      this.connectionMonitor.updateConnectionActivity(connectionId, true, 'sse');
    } catch (error) {
      logger.error('Failed to send SSE event', { 
        error: (error as Error).message, 
        connectionId 
      });
      this.closeSSEConnection(connectionId);
    }
  }

  private async sendMissedEvents(connectionId: string, userId: string, since: number): Promise<void> {
    try {
      const missedEvents = await this.eventStore.getEventsSince(userId, since);
      
      for (const event of missedEvents) {
        this.sendSSEEvent(connectionId, {
          type: event.type,
          data: event.data,
          id: event.id,
          timestamp: event.timestamp,
        });
      }

      if (missedEvents.length > 0) {
        logger.debug('Sent missed events', { 
          connectionId, 
          userId, 
          eventCount: missedEvents.length 
        });
      }
    } catch (error) {
      logger.error('Failed to send missed events', { 
        error: (error as Error).message, 
        connectionId, 
        userId 
      });
    }
  }

  private closeSSEConnection(connectionId: string): void {
    const connection = this.sseConnections.get(connectionId);
    if (connection) {
      try {
        connection.response.end();
      } catch (error) {
        // Connection might already be closed
      }
      
      this.sseConnections.delete(connectionId);
      this.connectionMonitor.unregisterConnection(connectionId);
      
      logger.debug('SSE connection closed', { 
        connectionId, 
        userId: connection.userId 
      });
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendHeartbeat(): void {
    const heartbeatEvent = {
      type: 'heartbeat',
      data: { timestamp: Date.now() },
    };

    for (const connectionId of this.sseConnections.keys()) {
      this.sendSSEEvent(connectionId, heartbeatEvent);
    }

    logger.debug('Heartbeat sent', { connectionCount: this.sseConnections.size });
  }
}

// Singleton instance
let realtimeService: RealtimeService | null = null;

export function getRealtimeService(): RealtimeService {
  if (!realtimeService) {
    realtimeService = new RealtimeService();
  }
  return realtimeService;
}