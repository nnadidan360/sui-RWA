import { CryptoVaultService } from './crypto-vault-service';
import { logger } from '../../utils/logger';

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  URGENT = 'urgent',
}

/**
 * Alert types
 */
export enum AlertType {
  LTV_WARNING_1 = 'ltv_warning_1', // 65% LTV
  LTV_WARNING_2 = 'ltv_warning_2', // 70% LTV
  LTV_WARNING_3 = 'ltv_warning_3', // 75% LTV
  LTV_CRITICAL = 'ltv_critical', // 80% LTV - liquidation imminent
  PRICE_DROP = 'price_drop',
  HEALTH_FACTOR_LOW = 'health_factor_low',
}

/**
 * Notification channel
 */
export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  IN_APP = 'in_app',
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  vaultId: string;
  userId: string;
  enabledChannels: NotificationChannel[];
  ltvThresholds: {
    warning1: number; // Default: 65%
    warning2: number; // Default: 70%
    warning3: number; // Default: 75%
  };
  cooldownMinutes: number; // Minimum time between alerts
}

/**
 * Alert record
 */
export interface AlertRecord {
  id: string;
  vaultId: string;
  userId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  ltv: number;
  healthFactor: number;
  channels: NotificationChannel[];
  sentAt: number;
  acknowledged: boolean;
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  userId: string;
  enableEmail: boolean;
  enableSms: boolean;
  enablePush: boolean;
  enableInApp: boolean;
  emailAddress?: string;
  phoneNumber?: string;
  quietHoursStart?: number; // Hour (0-23)
  quietHoursEnd?: number; // Hour (0-23)
  timezone?: string;
}

/**
 * LTV thresholds for alerts
 */
export const DEFAULT_LTV_THRESHOLDS = {
  WARNING_1: 6500, // 65% - First warning
  WARNING_2: 7000, // 70% - Second warning
  WARNING_3: 7500, // 75% - Final warning
  CRITICAL: 8000, // 80% - Liquidation imminent
};

/**
 * Service for managing crypto position alerts
 */
export class CryptoAlertService {
  private vaultService: CryptoVaultService;
  private alertHistory: Map<string, AlertRecord[]> = new Map();
  private userPreferences: Map<string, NotificationPreferences> = new Map();
  private lastAlertTime: Map<string, number> = new Map();

  constructor(vaultService: CryptoVaultService) {
    this.vaultService = vaultService;
  }

  /**
   * Check vault and send alerts if needed
   */
  async checkAndAlert(
    vaultId: string,
    userId: string,
    config: AlertConfig
  ): Promise<AlertRecord[]> {
    try {
      const health = await this.vaultService.monitorVaultHealth(vaultId);
      const alerts: AlertRecord[] = [];

      // Check if in cooldown period
      const lastAlert = this.lastAlertTime.get(vaultId);
      const now = Date.now();
      if (lastAlert && now - lastAlert < config.cooldownMinutes * 60 * 1000) {
        logger.debug('Alert in cooldown period', {
          vaultId,
          cooldownRemaining: config.cooldownMinutes * 60 * 1000 - (now - lastAlert),
        });
        return alerts;
      }

      // Determine alert type and severity based on LTV
      let alertType: AlertType | null = null;
      let severity: AlertSeverity = AlertSeverity.INFO;
      let message = '';

      if (health.ltv >= DEFAULT_LTV_THRESHOLDS.CRITICAL) {
        alertType = AlertType.LTV_CRITICAL;
        severity = AlertSeverity.URGENT;
        message = `URGENT: Your vault is at ${(health.ltv / 100).toFixed(2)}% LTV and will be liquidated soon! Add collateral immediately.`;
      } else if (health.ltv >= config.ltvThresholds.warning3) {
        alertType = AlertType.LTV_WARNING_3;
        severity = AlertSeverity.CRITICAL;
        message = `CRITICAL: Your vault has reached ${(health.ltv / 100).toFixed(2)}% LTV. Liquidation at 80%. Add collateral now.`;
      } else if (health.ltv >= config.ltvThresholds.warning2) {
        alertType = AlertType.LTV_WARNING_2;
        severity = AlertSeverity.WARNING;
        message = `WARNING: Your vault is at ${(health.ltv / 100).toFixed(2)}% LTV. Consider adding collateral to avoid liquidation.`;
      } else if (health.ltv >= config.ltvThresholds.warning1) {
        alertType = AlertType.LTV_WARNING_1;
        severity = AlertSeverity.WARNING;
        message = `NOTICE: Your vault has reached ${(health.ltv / 100).toFixed(2)}% LTV. Monitor your position closely.`;
      }

      if (alertType) {
        const alert = await this.sendAlert({
          vaultId,
          userId,
          type: alertType,
          severity,
          message,
          ltv: health.ltv,
          healthFactor: health.healthFactor,
          channels: config.enabledChannels,
        });

        alerts.push(alert);
        this.lastAlertTime.set(vaultId, now);
      }

      return alerts;
    } catch (error) {
      logger.error('Failed to check and alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
        vaultId,
      });
      return [];
    }
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(params: {
    vaultId: string;
    userId: string;
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    ltv: number;
    healthFactor: number;
    channels: NotificationChannel[];
  }): Promise<AlertRecord> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const alert: AlertRecord = {
      id: alertId,
      vaultId: params.vaultId,
      userId: params.userId,
      type: params.type,
      severity: params.severity,
      message: params.message,
      ltv: params.ltv,
      healthFactor: params.healthFactor,
      channels: params.channels,
      sentAt: now,
      acknowledged: false,
    };

    // Get user preferences
    const preferences = this.userPreferences.get(params.userId);

    // Check quiet hours
    if (preferences && this.isQuietHours(preferences)) {
      logger.info('Alert suppressed due to quiet hours', {
        userId: params.userId,
        alertType: params.type,
      });
      // Still record the alert but don't send
      this.recordAlert(alert);
      return alert;
    }

    // Send through each channel
    for (const channel of params.channels) {
      try {
        await this.sendThroughChannel(channel, alert, preferences);
      } catch (error) {
        logger.error('Failed to send alert through channel', {
          error: error instanceof Error ? error.message : 'Unknown error',
          channel,
          alertId,
        });
      }
    }

    this.recordAlert(alert);

    logger.info('Alert sent', {
      alertId,
      vaultId: params.vaultId,
      type: params.type,
      severity: params.severity,
      channels: params.channels,
    });

    return alert;
  }

  /**
   * Send alert through specific channel
   */
  private async sendThroughChannel(
    channel: NotificationChannel,
    alert: AlertRecord,
    preferences?: NotificationPreferences
  ): Promise<void> {
    switch (channel) {
      case NotificationChannel.EMAIL:
        if (preferences?.enableEmail && preferences.emailAddress) {
          await this.sendEmail(preferences.emailAddress, alert);
        }
        break;

      case NotificationChannel.SMS:
        if (preferences?.enableSms && preferences.phoneNumber) {
          await this.sendSms(preferences.phoneNumber, alert);
        }
        break;

      case NotificationChannel.PUSH:
        if (preferences?.enablePush) {
          await this.sendPushNotification(alert.userId, alert);
        }
        break;

      case NotificationChannel.IN_APP:
        // In-app notifications are always enabled
        await this.sendInAppNotification(alert.userId, alert);
        break;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(email: string, alert: AlertRecord): Promise<void> {
    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    logger.info('Sending email alert', {
      email,
      alertId: alert.id,
      type: alert.type,
    });

    // Mock implementation
    // await emailService.send({
    //   to: email,
    //   subject: `Crypto Vault Alert: ${alert.severity.toUpperCase()}`,
    //   body: alert.message,
    // });
  }

  /**
   * Send SMS notification
   */
  private async sendSms(phoneNumber: string, alert: AlertRecord): Promise<void> {
    // In production, integrate with SMS service (Twilio, AWS SNS, etc.)
    logger.info('Sending SMS alert', {
      phoneNumber,
      alertId: alert.id,
      type: alert.type,
    });

    // Mock implementation
    // await smsService.send({
    //   to: phoneNumber,
    //   message: alert.message,
    // });
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(userId: string, alert: AlertRecord): Promise<void> {
    // In production, integrate with push notification service (FCM, APNS, etc.)
    logger.info('Sending push notification', {
      userId,
      alertId: alert.id,
      type: alert.type,
    });

    // Mock implementation
    // await pushService.send({
    //   userId,
    //   title: `Vault Alert: ${alert.severity}`,
    //   body: alert.message,
    // });
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(userId: string, alert: AlertRecord): Promise<void> {
    logger.info('Sending in-app notification', {
      userId,
      alertId: alert.id,
      type: alert.type,
    });

    // In production, store in database and send via WebSocket
    // await notificationStore.create({
    //   userId,
    //   type: 'vault_alert',
    //   data: alert,
    // });
  }

  /**
   * Check if current time is in quiet hours
   */
  private isQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentHour = now.getHours();

    const start = preferences.quietHoursStart;
    const end = preferences.quietHoursEnd;

    if (start < end) {
      return currentHour >= start && currentHour < end;
    } else {
      // Quiet hours span midnight
      return currentHour >= start || currentHour < end;
    }
  }

  /**
   * Record alert in history
   */
  private recordAlert(alert: AlertRecord): void {
    if (!this.alertHistory.has(alert.vaultId)) {
      this.alertHistory.set(alert.vaultId, []);
    }

    const history = this.alertHistory.get(alert.vaultId)!;
    history.push(alert);

    // Keep only last 100 alerts per vault
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get alert history for a vault
   */
  getAlertHistory(vaultId: string, limit: number = 50): AlertRecord[] {
    const history = this.alertHistory.get(vaultId) || [];
    return history.slice(-limit);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, vaultId: string): boolean {
    const history = this.alertHistory.get(vaultId);
    if (!history) return false;

    const alert = history.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      logger.info('Alert acknowledged', { alertId, vaultId });
      return true;
    }

    return false;
  }

  /**
   * Set user notification preferences
   */
  setUserPreferences(preferences: NotificationPreferences): void {
    this.userPreferences.set(preferences.userId, preferences);
    logger.info('User notification preferences updated', {
      userId: preferences.userId,
    });
  }

  /**
   * Get user notification preferences
   */
  getUserPreferences(userId: string): NotificationPreferences | undefined {
    return this.userPreferences.get(userId);
  }

  /**
   * Get unacknowledged alerts for a user
   */
  getUnacknowledgedAlerts(userId: string): AlertRecord[] {
    const alerts: AlertRecord[] = [];

    for (const [vaultId, history] of this.alertHistory.entries()) {
      const userAlerts = history.filter(
        a => a.userId === userId && !a.acknowledged
      );
      alerts.push(...userAlerts);
    }

    return alerts.sort((a, b) => b.sentAt - a.sentAt);
  }

  /**
   * Clear alert cooldown (for testing)
   */
  clearCooldown(vaultId: string): void {
    this.lastAlertTime.delete(vaultId);
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics(vaultId: string): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    acknowledged: number;
    unacknowledged: number;
  } {
    const history = this.alertHistory.get(vaultId) || [];

    const stats = {
      total: history.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      acknowledged: 0,
      unacknowledged: 0,
    };

    for (const alert of history) {
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
      stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;

      if (alert.acknowledged) {
        stats.acknowledged++;
      } else {
        stats.unacknowledged++;
      }
    }

    return stats;
  }
}
