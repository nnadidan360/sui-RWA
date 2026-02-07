/**
 * Push Notification Service for Backend
 * 
 * Handles server-side push notification management and delivery
 */

import webpush from 'web-push';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../utils/error-utils';

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: NotificationAction[];
  requireInteraction?: boolean;
  silent?: boolean;
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface UserSubscription {
  userId: string;
  subscription: PushSubscription;
  createdAt: Date;
  isActive: boolean;
}

export class PushNotificationService {
  private subscriptions: Map<string, UserSubscription[]> = new Map();

  constructor() {
    this.initializeWebPush();
  }

  private initializeWebPush(): void {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL;

    if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
      logger.warn('Push notification service not configured - VAPID keys missing');
      return;
    }

    webpush.setVapidDetails(
      `mailto:${vapidEmail}`,
      vapidPublicKey,
      vapidPrivateKey
    );

    logger.info('Push notification service initialized');
  }

  /**
   * Subscribe user to push notifications
   */
  async subscribeUser(userId: string, subscription: PushSubscription): Promise<void> {
    try {
      const userSubscription: UserSubscription = {
        userId,
        subscription,
        createdAt: new Date(),
        isActive: true,
      };

      if (!this.subscriptions.has(userId)) {
        this.subscriptions.set(userId, []);
      }

      // Remove existing subscription with same endpoint
      const userSubs = this.subscriptions.get(userId)!;
      const existingIndex = userSubs.findIndex(
        sub => sub.subscription.endpoint === subscription.endpoint
      );

      if (existingIndex >= 0) {
        userSubs[existingIndex] = userSubscription;
      } else {
        userSubs.push(userSubscription);
      }

      logger.info('User subscribed to push notifications', { 
        userId, 
        endpoint: subscription.endpoint.substring(0, 50) + '...' 
      });
    } catch (error:any) {
      logger.error('Failed to subscribe user to push notifications', { 
        error: error.message, 
        userId 
      });
      throw error;
    }
  }

  /**
   * Unsubscribe user from push notifications
   */
  async unsubscribeUser(userId: string, endpoint?: string): Promise<void> {
    try {
      const userSubs = this.subscriptions.get(userId);
      
      if (!userSubs) {
        return;
      }

      if (endpoint) {
        // Remove specific subscription
        const filteredSubs = userSubs.filter(
          sub => sub.subscription.endpoint !== endpoint
        );
        this.subscriptions.set(userId, filteredSubs);
      } else {
        // Remove all subscriptions for user
        this.subscriptions.delete(userId);
      }

      logger.info('User unsubscribed from push notifications', { userId, endpoint });
    } catch (error:any) {
      logger.error('Failed to unsubscribe user from push notifications', { 
        error: error.message, 
        userId 
      });
      throw error;
    }
  }

  /**
   * Send notification to specific user
   */
  async sendNotificationToUser(
    userId: string, 
    payload: NotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    const userSubs = this.subscriptions.get(userId);
    
    if (!userSubs || userSubs.length === 0) {
      logger.warn('No subscriptions found for user', { userId });
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    const notificationData = {
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/notification-icon.png',
      badge: payload.badge || '/icons/notification-badge.png',
      tag: payload.tag,
      data: payload.data,
      requireInteraction: payload.requireInteraction || false,
      silent: payload.silent || false,
      ...(payload.actions && { actions: payload.actions }),
    };

    for (const userSub of userSubs) {
      if (!userSub.isActive) {
        continue;
      }

      try {
        await webpush.sendNotification(
          userSub.subscription,
          JSON.stringify(notificationData)
        );
        sent++;
        
        logger.debug('Notification sent successfully', { 
          userId, 
          endpoint: userSub.subscription.endpoint.substring(0, 50) + '...' 
        });
      } catch (error:any) {
        failed++;
        
        // Handle subscription errors
        if (error.statusCode === 410 || error.statusCode === 404) {
          // Subscription is no longer valid, remove it
          await this.removeInvalidSubscription(userId, userSub.subscription.endpoint);
          logger.info('Removed invalid subscription', { 
            userId, 
            endpoint: userSub.subscription.endpoint.substring(0, 50) + '...' 
          });
        } else {
          logger.error('Failed to send notification', { 
            error: error.message, 
            userId,
            statusCode: error.statusCode 
          });
        }
      }
    }

    logger.info('Notification delivery completed', { userId, sent, failed });
    return { sent, failed };
  }

  /**
   * Send notification to multiple users
   */
  async sendNotificationToUsers(
    userIds: string[], 
    payload: NotificationPayload
  ): Promise<{ totalSent: number; totalFailed: number; userResults: Record<string, { sent: number; failed: number }> }> {
    let totalSent = 0;
    let totalFailed = 0;
    const userResults: Record<string, { sent: number; failed: number }> = {};

    for (const userId of userIds) {
      const result = await this.sendNotificationToUser(userId, payload);
      userResults[userId] = result;
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    logger.info('Bulk notification delivery completed', { 
      userCount: userIds.length, 
      totalSent, 
      totalFailed 
    });

    return { totalSent, totalFailed, userResults };
  }

  /**
   * Send notification to all subscribed users
   */
  async broadcastNotification(
    payload: NotificationPayload
  ): Promise<{ totalSent: number; totalFailed: number }> {
    const allUserIds = Array.from(this.subscriptions.keys());
    const result = await this.sendNotificationToUsers(allUserIds, payload);
    
    logger.info('Broadcast notification completed', { 
      userCount: allUserIds.length,
      totalSent: result.totalSent,
      totalFailed: result.totalFailed 
    });

    return {
      totalSent: result.totalSent,
      totalFailed: result.totalFailed,
    };
  }

  /**
   * Get user subscriptions
   */
  getUserSubscriptions(userId: string): UserSubscription[] {
    return this.subscriptions.get(userId) || [];
  }

  /**
   * Get subscription statistics
   */
  getSubscriptionStats(): {
    totalUsers: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
  } {
    let totalSubscriptions = 0;
    let activeSubscriptions = 0;

    for (const userSubs of this.subscriptions.values()) {
      totalSubscriptions += userSubs.length;
      activeSubscriptions += userSubs.filter(sub => sub.isActive).length;
    }

    return {
      totalUsers: this.subscriptions.size,
      totalSubscriptions,
      activeSubscriptions,
    };
  }

  /**
   * Remove invalid subscription
   */
  private async removeInvalidSubscription(userId: string, endpoint: string): Promise<void> {
    const userSubs = this.subscriptions.get(userId);
    
    if (userSubs) {
      const filteredSubs = userSubs.filter(
        sub => sub.subscription.endpoint !== endpoint
      );
      
      if (filteredSubs.length === 0) {
        this.subscriptions.delete(userId);
      } else {
        this.subscriptions.set(userId, filteredSubs);
      }
    }
  }

  /**
   * Validate subscription format
   */
  isValidSubscription(subscription: PushSubscription): boolean {
    return !!(
      subscription &&
      subscription.endpoint &&
      subscription.keys &&
      subscription.keys.p256dh &&
      subscription.keys.auth
    );
  }

  /**
   * Get service status
   */
  getServiceStatus(): {
    configured: boolean;
    error?: string;
  } {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL;

    const configured = !!(vapidPublicKey && vapidPrivateKey && vapidEmail);

    return {
      configured,
      error: configured ? undefined : 'VAPID keys not configured',
    };
  }
}

// Notification types for the RWA platform
export const NotificationTypes = {
  TRANSACTION_CONFIRMED: 'transaction_confirmed',
  TRANSACTION_FAILED: 'transaction_failed',
  LOAN_LIQUIDATION_WARNING: 'loan_liquidation_warning',
  LOAN_LIQUIDATED: 'loan_liquidated',
  STAKING_REWARDS: 'staking_rewards',
  UNBONDING_COMPLETE: 'unbonding_complete',
  SECURITY_ALERT: 'security_alert',
  SYSTEM_MAINTENANCE: 'system_maintenance',
  ASSET_VERIFIED: 'asset_verified',
  ASSET_REJECTED: 'asset_rejected',
} as const;

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes];

/**
 * Create notification payload for specific notification types
 */
export function createNotificationPayload(
  type: NotificationType,
  data: any
): NotificationPayload {
  switch (type) {
    case NotificationTypes.TRANSACTION_CONFIRMED:
      return {
        title: 'Transaction Confirmed',
        body: `Your ${data.type} transaction has been confirmed`,
        icon: '/icons/success.png',
        tag: 'transaction',
        data: { type, ...data },
        actions: [
          { action: 'view', title: 'View Details' },
        ],
      };

    case NotificationTypes.TRANSACTION_FAILED:
      return {
        title: 'Transaction Failed',
        body: `Your ${data.type} transaction failed to execute`,
        icon: '/icons/error.png',
        tag: 'transaction',
        data: { type, ...data },
        requireInteraction: true,
        actions: [
          { action: 'retry', title: 'Retry' },
          { action: 'view', title: 'View Details' },
        ],
      };

    case NotificationTypes.LOAN_LIQUIDATION_WARNING:
      return {
        title: 'Liquidation Warning',
        body: `Your loan is at risk of liquidation. Health factor: ${data.healthFactor}`,
        icon: '/icons/warning.png',
        tag: 'liquidation',
        data: { type, ...data },
        requireInteraction: true,
        actions: [
          { action: 'add_collateral', title: 'Add Collateral' },
          { action: 'repay', title: 'Repay Loan' },
        ],
      };

    case NotificationTypes.ASSET_VERIFIED:
      return {
        title: 'Asset Verified',
        body: `Your asset "${data.assetName}" has been verified and approved`,
        icon: '/icons/success.png',
        tag: 'asset',
        data: { type, ...data },
        actions: [
          { action: 'view', title: 'View Asset' },
        ],
      };

    case NotificationTypes.ASSET_REJECTED:
      return {
        title: 'Asset Rejected',
        body: `Your asset "${data.assetName}" verification was rejected`,
        icon: '/icons/error.png',
        tag: 'asset',
        data: { type, ...data },
        requireInteraction: true,
        actions: [
          { action: 'view', title: 'View Details' },
          { action: 'resubmit', title: 'Resubmit' },
        ],
      };

    default:
      return {
        title: 'Notification',
        body: 'You have a new notification',
        icon: '/icons/notification.png',
        data: { type, ...data },
      };
  }
}