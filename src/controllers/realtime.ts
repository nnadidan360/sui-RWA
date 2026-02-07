/**
 * Real-time Communication API Controller
 * 
 * Handles SSE connections, polling, and real-time event management
 */

import { Request, Response } from 'express';
import { getRealtimeService } from '../services/realtime/realtime-service';
import { getEventStore } from '../services/realtime/event-store';
import { logger } from '../utils/logger';

const realtimeService = getRealtimeService();
const eventStore = getEventStore();

/**
 * Handle Server-Sent Events connection
 * GET /api/realtime/sse
 */
export async function handleSSEConnection(req: Request, res: Response): Promise<void> {
  await realtimeService.handleSSEConnection(req, res);
}

/**
 * Handle polling requests for real-time events
 * GET /api/realtime/poll
 */
export async function handlePollingRequest(req: Request, res: Response): Promise<void> {
  await realtimeService.handlePollingRequest(req, res);
}

/**
 * Send event to specific user
 * POST /api/realtime/send-event
 */
export async function sendEventToUser(req: Request, res: Response): Promise<void> {
  try {
    const { userId, type, data, metadata } = req.body;

    // Validate required fields
    if (!userId || !type || !data) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, type, data'
      });
      return;
    }

    await realtimeService.sendEventToUser(userId, {
      type,
      data,
      metadata
    });

    logger.info('Event sent to user', { userId, type });

    res.json({
      success: true,
      message: 'Event sent successfully'
    });
  } catch (error: any) {
    logger.error('Failed to send event to user', { 
      error: error.message, 
      userId: req.body.userId 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Send event to multiple users
 * POST /api/realtime/broadcast-event
 */
export async function broadcastEventToUsers(req: Request, res: Response): Promise<void> {
  try {
    const { userIds, type, data, metadata } = req.body;

    // Validate required fields
    if (!userIds || !Array.isArray(userIds) || !type || !data) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userIds (array), type, data'
      });
      return;
    }

    await realtimeService.sendEventToUsers(userIds, {
      type,
      data,
      metadata
    });

    logger.info('Event broadcasted to users', { userCount: userIds.length, type });

    res.json({
      success: true,
      message: `Event sent to ${userIds.length} users`
    });
  } catch (error: any) {
    logger.error('Failed to broadcast event to users', { 
      error: error.message, 
      userCount: req.body.userIds?.length 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get connection statistics
 * GET /api/realtime/stats
 */
export async function getConnectionStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = realtimeService.getConnectionStats();
    const eventStats = await eventStore.getEventStats();

    res.json({
      success: true,
      data: {
        connections: stats,
        events: eventStats
      }
    });
  } catch (error: any) {
    logger.error('Failed to get connection stats', { error: error.message });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get user connections
 * GET /api/realtime/users/:userId/connections
 */
export async function getUserConnections(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    const connections = realtimeService.getUserConnections(userId as string);

    res.json({
      success: true,
      data: {
        userId,
        connections,
        count: connections.length
      }
    });
  } catch (error: any) {
    logger.error('Failed to get user connections', { 
      error: error.message, 
      userId: req.params.userId 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Disconnect user
 * POST /api/realtime/users/:userId/disconnect
 */
export async function disconnectUser(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    realtimeService.disconnectUser(userId as string);

    logger.info('User disconnected', { userId });

    res.json({
      success: true,
      message: 'User disconnected successfully'
    });
  } catch (error: any) {
    logger.error('Failed to disconnect user', { 
      error: error.message, 
      userId: req.params.userId 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get events for user
 * GET /api/realtime/users/:userId/events
 */
export async function getUserEvents(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const { since, limit, type } = req.query;

    const filter: any = { userId };
    
    if (since) {
      filter.since = parseInt(since as string);
    }
    
    if (limit) {
      filter.limit = parseInt(limit as string);
    }
    
    if (type) {
      filter.type = type as string;
    }

    const events = await eventStore.getEvents(filter);

    res.json({
      success: true,
      data: {
        userId,
        events,
        count: events.length
      }
    });
  } catch (error: any) {
    logger.error('Failed to get user events', { 
      error: error.message, 
      userId: req.params.userId 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Clear events for user
 * DELETE /api/realtime/users/:userId/events
 */
export async function clearUserEvents(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    await eventStore.clearEvents(userId as string);

    logger.info('User events cleared', { userId });

    res.json({
      success: true,
      message: 'User events cleared successfully'
    });
  } catch (error: any) {
    logger.error('Failed to clear user events', { 
      error: error.message, 
      userId: req.params.userId 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get events by type
 * GET /api/realtime/events/type/:eventType
 */
export async function getEventsByType(req: Request, res: Response): Promise<void> {
  try {
    const { eventType } = req.params;
    const { limit } = req.query;

    const limitNum = limit ? parseInt(limit as string) : 100;
    const events = await eventStore.getEventsByType(eventType as string, limitNum);

    res.json({
      success: true,
      data: {
        eventType,
        events,
        count: events.length
      }
    });
  } catch (error: any) {
    logger.error('Failed to get events by type', { 
      error: error.message, 
      eventType: req.params.eventType 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Health check for real-time service
 * GET /api/realtime/health
 */
export async function getRealtimeHealth(req: Request, res: Response): Promise<void> {
  try {
    const stats = realtimeService.getConnectionStats();
    const eventStats = await eventStore.getEventStats();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      connections: {
        total: stats.totalConnections,
        sse: stats.sseConnections,
      },
      events: {
        total: eventStats.totalEvents,
        recent: eventStats.recentEvents,
      },
      uptime: process.uptime(),
    };

    res.json({
      success: true,
      data: health
    });
  } catch (error: any) {
    logger.error('Failed to get realtime health', { error: error.message });

    res.status(500).json({
      success: false,
      error: error.message,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      }
    });
  }
}