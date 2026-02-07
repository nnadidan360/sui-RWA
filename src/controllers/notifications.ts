import { Router, Response } from 'express';
import Joi from 'joi';
import { asyncHandler, CustomError } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../middleware/auth-middleware';
import { 
  PushNotificationService, 
  NotificationTypes, 
  createNotificationPayload,
  type PushSubscription,
  type NotificationPayload 
} from '../services/notifications/push-service';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/error-utils';
import { ApiResponse } from '../types/api';

const router = Router();

// Initialize push notification service
const pushService = new PushNotificationService();

// Validation schemas
const subscribeSchema = Joi.object({
  endpoint: Joi.string().uri().required(),
  keys: Joi.object({
    p256dh: Joi.string().required(),
    auth: Joi.string().required(),
  }).required(),
});

const sendNotificationSchema = Joi.object({
  title: Joi.string().required(),
  body: Joi.string().required(),
  icon: Joi.string().uri().optional(),
  badge: Joi.string().uri().optional(),
  tag: Joi.string().optional(),
  data: Joi.object().optional(),
  requireInteraction: Joi.boolean().optional(),
  silent: Joi.boolean().optional(),
  actions: Joi.array().items(Joi.object({
    action: Joi.string().required(),
    title: Joi.string().required(),
    icon: Joi.string().uri().optional(),
  })).optional(),
});

const sendTypedNotificationSchema = Joi.object({
  type: Joi.string().valid(...Object.values(NotificationTypes)).required(),
  data: Joi.object().required(),
});

/**
 * Subscribe user to push notifications
 */
router.post('/subscribe', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  const { error, value } = subscribeSchema.validate(req.body);
  
  if (error) {
    throw new CustomError('Invalid subscription data', 400);
  }

  const subscription: PushSubscription = value;

  if (!pushService.isValidSubscription(subscription)) {
    throw new CustomError('Invalid subscription format', 400);
  }

  try {
    await pushService.subscribeUser(req.user.id, subscription);

    logger.info('User subscribed to push notifications', {
      userId: req.user.id,
      endpoint: subscription.endpoint.substring(0, 50) + '...'
    });

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Successfully subscribed to push notifications' },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to subscribe user to push notifications', {
      error: getErrorMessage(error),
      userId: req.user.id
    });
    throw error;
  }
}));

/**
 * Unsubscribe user from push notifications
 */
router.post('/unsubscribe', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  const endpoint = req.body.endpoint as string;

  try {
    await pushService.unsubscribeUser(req.user.id, endpoint);

    logger.info('User unsubscribed from push notifications', {
      userId: req.user.id,
      endpoint: endpoint ? endpoint.substring(0, 50) + '...' : 'all'
    });

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Successfully unsubscribed from push notifications' },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error:any) {
    logger.error('Failed to unsubscribe user from push notifications', {
      error: error.message,
      userId: req.user.id
    });
    throw error;
  }
}));

/**
 * Send custom notification to user
 */
router.post('/send', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new CustomError('Admin access required', 403);
  }

  const { error, value } = sendNotificationSchema.validate(req.body);
  
  if (error) {
    throw new CustomError('Invalid notification data', 400);
  }

  const { userId, ...notificationPayload } = req.body;

  if (!userId) {
    throw new CustomError('User ID is required', 400);
  }

  try {
    const result = await pushService.sendNotificationToUser(userId, notificationPayload);

    logger.info('Custom notification sent', {
      adminId: req.user.id,
      targetUserId: userId,
      sent: result.sent,
      failed: result.failed
    });

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error:any) {
    logger.error('Failed to send custom notification', {
      error: error.message,
      adminId: req.user.id,
      targetUserId: userId
    });
    throw error;
  }
}));

/**
 * Send typed notification to user
 */
router.post('/send-typed', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  const { error, value } = sendTypedNotificationSchema.validate(req.body);
  
  if (error) {
    throw new CustomError('Invalid notification data', 400);
  }

  const { userId, type, data } = req.body;

  // Allow users to send notifications to themselves, or admins to send to anyone
  if (userId !== req.user.id && req.user.role !== 'admin') {
    throw new CustomError('You can only send notifications to yourself', 403);
  }

  try {
    const notificationPayload = createNotificationPayload(type, data);
    const result = await pushService.sendNotificationToUser(userId || req.user.id, notificationPayload);

    logger.info('Typed notification sent', {
      senderId: req.user.id,
      targetUserId: userId || req.user.id,
      type,
      sent: result.sent,
      failed: result.failed
    });

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error:any) {
    logger.error('Failed to send typed notification', {
      error: error.message,
      senderId: req.user.id,
      targetUserId: userId,
      type: req.body.type
    });
    throw error;
  }
}));

/**
 * Broadcast notification to all users (admin only)
 */
router.post('/broadcast', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new CustomError('Admin access required', 403);
  }

  const { error, value } = sendNotificationSchema.validate(req.body);
  
  if (error) {
    throw new CustomError('Invalid notification data', 400);
  }

  const notificationPayload: NotificationPayload = value;

  try {
    const result = await pushService.broadcastNotification(notificationPayload);

    logger.info('Broadcast notification sent', {
      adminId: req.user.id,
      totalSent: result.totalSent,
      totalFailed: result.totalFailed
    });

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error:any) {
    logger.error('Failed to send broadcast notification', {
      error: error.message,
      adminId: req.user.id
    });
    throw error;
  }
}));

/**
 * Get user's subscriptions
 */
router.get('/subscriptions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  try {
    const subscriptions = pushService.getUserSubscriptions(req.user.id);

    // Remove sensitive data from response
    const sanitizedSubscriptions = subscriptions.map(sub => ({
      endpoint: sub.subscription.endpoint.substring(0, 50) + '...',
      createdAt: sub.createdAt,
      isActive: sub.isActive,
    }));

    const response: ApiResponse<typeof sanitizedSubscriptions> = {
      success: true,
      data: sanitizedSubscriptions,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error:any) {
    logger.error('Failed to get user subscriptions', {
      error: error.message,
      userId: req.user.id
    });
    throw error;
  }
}));

/**
 * Get subscription statistics (admin only)
 */
router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new CustomError('Admin access required', 403);
  }

  try {
    const stats = pushService.getSubscriptionStats();

    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error:any) {
    logger.error('Failed to get subscription statistics', {
      error: error.message,
      adminId: req.user.id
    });
    throw error;
  }
}));

/**
 * Get notification service status
 */
router.get('/status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = pushService.getServiceStatus();

    const response: ApiResponse<typeof status> = {
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error:any) {
    logger.error('Failed to get notification service status', {
      error: error.message
    });
    throw error;
  }
}));

export default router;