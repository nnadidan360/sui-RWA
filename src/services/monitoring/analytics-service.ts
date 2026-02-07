/**
 * Analytics and Monitoring Service for Backend
 * 
 * Implements platform metrics, performance tracking, and fraud detection
 */

import { logger } from '../../utils/logger';

export interface PlatformMetrics {
  totalAssets: number;
  totalLoans: number;
  totalStaked: number;
  activeUsers: number;
  totalVolume: number;
  utilizationRate: number;
  averageAPY: number;
  liquidationRate: number;
}

export interface TransactionMetrics {
  transactionId: string;
  userId: string;
  type: 'tokenization' | 'lending' | 'staking' | 'liquidation';
  amount: number;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
  gasUsed?: number;
  processingTime?: number;
  riskScore?: number;
}

export interface SuspiciousActivity {
  userId: string;
  activityType: 'rapid_transactions' | 'large_amounts' | 'unusual_patterns' | 'failed_attempts';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: any;
  newValue?: any;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class AnalyticsService {
  // In-memory storage for demo purposes
  // In production, this would use Redis and MongoDB
  private transactionMetrics: TransactionMetrics[] = [];
  private suspiciousActivities: SuspiciousActivity[] = [];
  private auditLogs: AuditLog[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private userActivityCache: Map<string, Date[]> = new Map();

  constructor() {
    // Start cleanup interval to prevent memory leaks
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Collect platform metrics
   */
  async collectPlatformMetrics(): Promise<PlatformMetrics> {
    try {
      logger.info('Collecting platform metrics');

      // In production, these would query actual database
      const metrics: PlatformMetrics = {
        totalAssets: this.getMockTotalAssets(),
        totalLoans: this.getMockTotalLoans(),
        totalStaked: this.getMockTotalStaked(),
        activeUsers: this.getMockActiveUsers(),
        totalVolume: this.getMockTotalVolume(),
        utilizationRate: this.getMockUtilizationRate(),
        averageAPY: this.getMockAverageAPY(),
        liquidationRate: this.getMockLiquidationRate(),
      };

      logger.info('Platform metrics collected', { metrics });
      return metrics;
    } catch (error) {
      logger.error('Failed to collect platform metrics', { error: error.message });
      throw error;
    }
  }

  /**
   * Record transaction for monitoring
   */
  async recordTransaction(transaction: TransactionMetrics): Promise<void> {
    try {
      logger.info('Recording transaction metrics', { 
        transactionId: transaction.transactionId,
        type: transaction.type,
        amount: transaction.amount 
      });

      // Store transaction
      this.transactionMetrics.push({
        ...transaction,
        timestamp: new Date(),
      });

      // Keep only last 10000 transactions in memory
      if (this.transactionMetrics.length > 10000) {
        this.transactionMetrics = this.transactionMetrics.slice(-10000);
      }

      // Update user activity cache
      this.updateUserActivity(transaction.userId);

      // Check for suspicious activity
      await this.checkSuspiciousActivity(transaction);

      logger.debug('Transaction recorded successfully', { 
        transactionId: transaction.transactionId 
      });
    } catch (error) {
      logger.error('Failed to record transaction', { 
        error: error.message,
        transactionId: transaction.transactionId 
      });
      throw error;
    }
  }

  /**
   * Check for suspicious activity patterns
   */
  async checkSuspiciousActivity(transaction: TransactionMetrics): Promise<void> {
    try {
      const suspiciousActivities: SuspiciousActivity[] = [];

      // Check for rapid transactions (more than 10 in 1 minute)
      const recentTransactions = this.getUserRecentTransactions(transaction.userId, 60);
      if (recentTransactions.length > 10) {
        suspiciousActivities.push({
          userId: transaction.userId,
          activityType: 'rapid_transactions',
          severity: 'high',
          description: `User performed ${recentTransactions.length} transactions in 1 minute`,
          timestamp: new Date(),
          metadata: { transactionCount: recentTransactions.length, timeWindow: 60 }
        });
      }

      // Check for unusually large amounts (> 95th percentile)
      const percentile95 = this.getAmountPercentile(95);
      if (transaction.amount > percentile95) {
        suspiciousActivities.push({
          userId: transaction.userId,
          activityType: 'large_amounts',
          severity: 'medium',
          description: `Transaction amount ${transaction.amount} exceeds 95th percentile (${percentile95})`,
          timestamp: new Date(),
          metadata: { amount: transaction.amount, percentile95 }
        });
      }

      // Check for unusual patterns (transactions outside normal hours)
      const hour = new Date().getHours();
      if (hour < 6 || hour > 22) {
        const userNormalHours = this.getUserNormalHours(transaction.userId);
        if (!userNormalHours.includes(hour)) {
          suspiciousActivities.push({
            userId: transaction.userId,
            activityType: 'unusual_patterns',
            severity: 'low',
            description: `Transaction at unusual hour: ${hour}`,
            timestamp: new Date(),
            metadata: { hour, normalHours: userNormalHours }
          });
        }
      }

      // Check for repeated failed attempts
      if (transaction.status === 'failed') {
        const failedCount = this.getUserFailedTransactions(transaction.userId, 300); // 5 minutes
        if (failedCount >= 5) {
          suspiciousActivities.push({
            userId: transaction.userId,
            activityType: 'failed_attempts',
            severity: 'critical',
            description: `${failedCount} failed transaction attempts in 5 minutes`,
            timestamp: new Date(),
            metadata: { failedCount, timeWindow: 300 }
          });
        }
      }

      // Store suspicious activities
      for (const activity of suspiciousActivities) {
        await this.recordSuspiciousActivity(activity);
      }
    } catch (error) {
      logger.error('Failed to check suspicious activity', { 
        error: error.message,
        userId: transaction.userId 
      });
    }
  }

  /**
   * Record suspicious activity
   */
  async recordSuspiciousActivity(activity: SuspiciousActivity): Promise<void> {
    try {
      logger.warn('Suspicious activity detected', {
        userId: activity.userId,
        activityType: activity.activityType,
        severity: activity.severity
      });

      this.suspiciousActivities.push(activity);

      // Keep only last 1000 activities in memory
      if (this.suspiciousActivities.length > 1000) {
        this.suspiciousActivities = this.suspiciousActivities.slice(-1000);
      }

      // Alert for high/critical severity
      if (activity.severity === 'high' || activity.severity === 'critical') {
        await this.alertSuspiciousActivity(activity);
      }
    } catch (error) {
      logger.error('Failed to record suspicious activity', { 
        error: error.message,
        userId: activity.userId 
      });
    }
  }

  /**
   * Log administrative action
   */
  async logAdminAction(auditLog: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      const log: AuditLog = {
        ...auditLog,
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date()
      };

      logger.info('Admin action logged', {
        adminId: log.adminId,
        action: log.action,
        resource: log.resource
      });

      this.auditLogs.push(log);

      // Keep only last 5000 logs in memory
      if (this.auditLogs.length > 5000) {
        this.auditLogs = this.auditLogs.slice(-5000);
      }

      // Alert on critical actions
      if (this.isCriticalAction(auditLog.action)) {
        await this.alertCriticalAction(log);
      }
    } catch (error) {
      logger.error('Failed to log admin action', { 
        error: error.message,
        adminId: auditLog.adminId,
        action: auditLog.action 
      });
    }
  }

  /**
   * Record performance metric
   */
  async recordPerformanceMetric(
    operation: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const metric: PerformanceMetric = {
        operation,
        duration,
        success,
        timestamp: new Date(),
        metadata: metadata || {}
      };

      this.performanceMetrics.push(metric);

      // Keep only last 10000 metrics in memory
      if (this.performanceMetrics.length > 10000) {
        this.performanceMetrics = this.performanceMetrics.slice(-10000);
      }

      logger.debug('Performance metric recorded', {
        operation,
        duration,
        success
      });
    } catch (error) {
      logger.error('Failed to record performance metric', { 
        error: error.message,
        operation 
      });
    }
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(): Promise<{
    metrics: PlatformMetrics;
    recentTransactions: TransactionMetrics[];
    suspiciousActivities: SuspiciousActivity[];
    recentAuditLogs: AuditLog[];
    performanceMetrics: Record<string, any>;
  }> {
    try {
      const [
        metrics,
        recentTransactions,
        suspiciousActivities,
        recentAuditLogs,
        performanceMetrics
      ] = await Promise.all([
        this.collectPlatformMetrics(),
        this.getRecentTransactions(20),
        this.getRecentSuspiciousActivities(10),
        this.getRecentAuditLogs(15),
        this.getPerformanceMetrics()
      ]);

      return {
        metrics,
        recentTransactions,
        suspiciousActivities,
        recentAuditLogs,
        performanceMetrics
      };
    } catch (error) {
      logger.error('Failed to get dashboard data', { error: error.message });
      throw error;
    }
  }

  // Private helper methods

  private updateUserActivity(userId: string): void {
    if (!this.userActivityCache.has(userId)) {
      this.userActivityCache.set(userId, []);
    }
    
    const activities = this.userActivityCache.get(userId)!;
    activities.push(new Date());
    
    // Keep only last 100 activities per user
    if (activities.length > 100) {
      this.userActivityCache.set(userId, activities.slice(-100));
    }
  }

  private getUserRecentTransactions(userId: string, seconds: number): TransactionMetrics[] {
    const since = new Date(Date.now() - seconds * 1000);
    return this.transactionMetrics.filter(
      t => t.userId === userId && t.timestamp >= since
    );
  }

  private getAmountPercentile(percentile: number): number {
    const completedTransactions = this.transactionMetrics
      .filter(t => t.status === 'completed')
      .map(t => t.amount)
      .sort((a, b) => a - b);
    
    if (completedTransactions.length === 0) return 0;
    
    const index = Math.floor((percentile / 100) * completedTransactions.length);
    return completedTransactions[index] || 0;
  }

  private getUserNormalHours(userId: string): number[] {
    const userTransactions = this.transactionMetrics
      .filter(t => t.userId === userId && t.status === 'completed')
      .slice(-100); // Last 100 transactions
    
    const hours = userTransactions.map(t => t.timestamp.getHours());
    const hourCounts = hours.reduce((acc, hour) => {
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return Object.entries(hourCounts)
      .filter(([_, count]) => count >= 2)
      .map(([hour, _]) => parseInt(hour));
  }

  private getUserFailedTransactions(userId: string, seconds: number): number {
    const since = new Date(Date.now() - seconds * 1000);
    return this.transactionMetrics.filter(
      t => t.userId === userId && t.status === 'failed' && t.timestamp >= since
    ).length;
  }

  private async alertSuspiciousActivity(activity: SuspiciousActivity): Promise<void> {
    logger.warn(`SUSPICIOUS ACTIVITY ALERT: ${activity.activityType} for user ${activity.userId}`, {
      severity: activity.severity,
      description: activity.description,
      metadata: activity.metadata
    });
    
    // In production, this would integrate with external alerting systems
  }

  private isCriticalAction(action: string): boolean {
    const criticalActions = [
      'emergency_pause',
      'upgrade_contract',
      'change_admin',
      'modify_risk_parameters',
      'suspend_user',
      'liquidate_position'
    ];
    return criticalActions.includes(action);
  }

  private async alertCriticalAction(log: AuditLog): Promise<void> {
    logger.warn(`CRITICAL ADMIN ACTION: ${log.action} by ${log.adminId}`, {
      resource: log.resource,
      resourceId: log.resourceId,
      timestamp: log.timestamp
    });
    
    // In production, this would integrate with external alerting systems
  }

  private getRecentTransactions(limit: number): TransactionMetrics[] {
    return this.transactionMetrics
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  private getRecentSuspiciousActivities(limit: number): SuspiciousActivity[] {
    return this.suspiciousActivities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  private getRecentAuditLogs(limit: number): AuditLog[] {
    return this.auditLogs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  private getPerformanceMetrics(): Record<string, any> {
    const operations = ['tokenization', 'lending', 'staking', 'liquidation'];
    const metrics: Record<string, any> = {};

    for (const operation of operations) {
      const operationMetrics = this.performanceMetrics.filter(m => m.operation === operation);
      
      if (operationMetrics.length > 0) {
        const durations = operationMetrics.map(m => m.duration);
        const successCount = operationMetrics.filter(m => m.success).length;
        
        metrics[operation] = {
          totalCount: operationMetrics.length,
          successRate: (successCount / operationMetrics.length) * 100,
          averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
          minDuration: Math.min(...durations),
          maxDuration: Math.max(...durations)
        };
      }
    }

    return metrics;
  }

  private cleanupOldData(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Clean up old transactions
    this.transactionMetrics = this.transactionMetrics.filter(
      t => t.timestamp >= oneWeekAgo
    );
    
    // Clean up old suspicious activities
    this.suspiciousActivities = this.suspiciousActivities.filter(
      a => a.timestamp >= oneWeekAgo
    );
    
    // Clean up old performance metrics
    this.performanceMetrics = this.performanceMetrics.filter(
      m => m.timestamp >= oneWeekAgo
    );
    
    logger.debug('Cleaned up old analytics data');
  }

  // Mock data methods (replace with real database queries in production)
  private getMockTotalAssets(): number {
    return Math.floor(Math.random() * 1000) + 500;
  }

  private getMockTotalLoans(): number {
    return Math.floor(Math.random() * 200) + 100;
  }

  private getMockTotalStaked(): number {
    return Math.floor(Math.random() * 1000000) + 500000;
  }

  private getMockActiveUsers(): number {
    return Math.floor(Math.random() * 5000) + 1000;
  }

  private getMockTotalVolume(): number {
    return Math.floor(Math.random() * 10000000) + 5000000;
  }

  private getMockUtilizationRate(): number {
    return Math.random() * 100;
  }

  private getMockAverageAPY(): number {
    return Math.random() * 20 + 5;
  }

  private getMockLiquidationRate(): number {
    return Math.random() * 10;
  }
}