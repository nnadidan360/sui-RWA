'use client';

export interface NotificationConfig {
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

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: globalThis.PushSubscription | null = null;
  private isSupported: boolean = false;

  constructor() {
    this.isSupported = this.checkSupport();
  }

  private checkSupport(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  async initialize(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Push notifications are not supported in this browser');
      return false;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully');

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  async subscribe(vapidPublicKey: string): Promise<PushSubscription | null> {
    if (!this.registration) {
      throw new Error('Service Worker not registered');
    }

    try {
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      // Send subscription to server
      await this.sendSubscriptionToServer(this.subscription);

      return {
        endpoint: this.subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(this.subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(this.subscription.getKey('auth')!),
        },
      };
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      const success = await this.subscription.unsubscribe();
      if (success) {
        this.subscription = null;
        // Notify server about unsubscription
        await this.removeSubscriptionFromServer();
      }
      return success;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  async showNotification(config: NotificationConfig): Promise<void> {
    if (!this.registration) {
      throw new Error('Service Worker not registered');
    }

    const permission = Notification.permission;
    if (permission !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    await this.registration.showNotification(config.title, {
      body: config.body,
      icon: config.icon || '/icons/notification-icon.png',
      badge: config.badge || '/icons/notification-badge.png',
      tag: config.tag,
      data: config.data,
      requireInteraction: config.requireInteraction || false,
      silent: config.silent || false,
      ...(config.actions && { actions: config.actions }),
    });
  }

  async getSubscription(): Promise<globalThis.PushSubscription | null> {
    if (!this.registration) {
      return null;
    }

    return await this.registration.pushManager.getSubscription();
  }

  isSubscribed(): boolean {
    return this.subscription !== null;
  }

  getPermissionStatus(): NotificationPermission {
    return Notification.permission;
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private async sendSubscriptionToServer(subscription: globalThis.PushSubscription): Promise<void> {
    try {
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
            auth: this.arrayBufferToBase64(subscription.getKey('auth')!),
          },
        }),
      });
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
    }
  }

  private async removeSubscriptionFromServer(): Promise<void> {
    try {
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Failed to remove subscription from server:', error);
    }
  }
}

// Global instance
let pushService: PushNotificationService | null = null;

export function getPushNotificationService(): PushNotificationService {
  if (!pushService) {
    pushService = new PushNotificationService();
  }
  return pushService;
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
} as const;

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes];

export function createNotificationConfig(
  type: NotificationType,
  data: any
): NotificationConfig {
  switch (type) {
    case NotificationTypes.TRANSACTION_CONFIRMED:
      return {
        title: 'Transaction Confirmed',
        body: `Your transaction has been confirmed on the blockchain`,
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
        body: `Your transaction failed to execute`,
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

    case NotificationTypes.LOAN_LIQUIDATED:
      return {
        title: 'Loan Liquidated',
        body: `Your loan has been liquidated due to insufficient collateral`,
        icon: '/icons/error.png',
        tag: 'liquidation',
        data: { type, ...data },
        requireInteraction: true,
        actions: [
          { action: 'view', title: 'View Details' },
        ],
      };

    case NotificationTypes.STAKING_REWARDS:
      return {
        title: 'Staking Rewards Available',
        body: `You have ${data.amount} CSPR in staking rewards to claim`,
        icon: '/icons/rewards.png',
        tag: 'staking',
        data: { type, ...data },
        actions: [
          { action: 'claim', title: 'Claim Rewards' },
        ],
      };

    case NotificationTypes.UNBONDING_COMPLETE:
      return {
        title: 'Unbonding Complete',
        body: `Your ${data.amount} CSPR tokens are now available to withdraw`,
        icon: '/icons/success.png',
        tag: 'staking',
        data: { type, ...data },
        actions: [
          { action: 'withdraw', title: 'Withdraw' },
        ],
      };

    case NotificationTypes.SECURITY_ALERT:
      return {
        title: 'Security Alert',
        body: data.message || 'A security event has been detected',
        icon: '/icons/security.png',
        tag: 'security',
        data: { type, ...data },
        requireInteraction: true,
        actions: [
          { action: 'view', title: 'View Details' },
        ],
      };

    case NotificationTypes.SYSTEM_MAINTENANCE:
      return {
        title: 'System Maintenance',
        body: data.message || 'The system will undergo maintenance',
        icon: '/icons/maintenance.png',
        tag: 'system',
        data: { type, ...data },
        actions: [
          { action: 'view', title: 'Learn More' },
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