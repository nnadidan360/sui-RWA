/**
 * Real-time Communication Routes
 */

import { Router } from 'express';
import {
  handleSSEConnection,
  handlePollingRequest,
  sendEventToUser,
  broadcastEventToUsers,
  getConnectionStats,
  getUserConnections,
  disconnectUser,
  getUserEvents,
  clearUserEvents,
  getEventsByType,
  getRealtimeHealth
} from '../controllers/realtime';

const router = Router();

// Real-time connection routes
router.get('/sse', handleSSEConnection);
router.get('/poll', handlePollingRequest);

// Event management routes
router.post('/send-event', sendEventToUser);
router.post('/broadcast-event', broadcastEventToUsers);

// Statistics and monitoring routes
router.get('/stats', getConnectionStats);
router.get('/health', getRealtimeHealth);

// User-specific routes
router.get('/users/:userId/connections', getUserConnections);
router.post('/users/:userId/disconnect', disconnectUser);
router.get('/users/:userId/events', getUserEvents);
router.delete('/users/:userId/events', clearUserEvents);

// Event type routes
router.get('/events/type/:eventType', getEventsByType);

export default router;