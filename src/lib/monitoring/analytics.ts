/**
 * Analytics and Monitoring Service
 * Implements platform metrics, performance tracking, and fraud detection
 * Requirements: 6.3
 */

import { Redis } from 'ioredis';
import { MongoClient, Db } from 'mongodb';

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

export class AnalyticsService {
  private redis: Redis;
  private db: Db;

  constructor(redis: Redis, db: Db) {
    this.redis = redis;
    this.db = db;
  }

  /**
   * Platform Metrics Collection
   */
  async collectPlatformMetrics(): Promise<PlatformMetrics> {
    const [
      totalAssets,
      totalLoans,
      totalStaked,
      activeUsers,
      totalVolume,
      utilizationRate,
      averageAPY,
      liquidationRate
    ] = await Promise.all([
      this.getTotalAssets(),
      this.getTotalLoans(),
      this.getTotalStaked(),
      this.getActiveUsers(),
      this.getTotalVolume(),
      this.getUtilizationRate(),
      this.getAverageAPY(),
      this.getLiquidationRate()
    ]);

    const metrics: PlatformMetrics = {
      totalAssets,
      totalLoans,
      totalStaked,
      activeUsers,
      totalVolume,
      utilizationRate,
      averageAPY,
      liquidationRate
    };

    // Cache metrics for 5 minutes
    await this.redis.setex('platform:metrics', 300, JSON.stringify(metrics));

    return metrics;
  }

  /**
   * Transaction Monitoring
   */
  async recordTransaction(transaction: TransactionMetrics): Promise<void> {
    // Store in MongoDB for long-term analysis
    await this.db.collection('transactions').insertOne({
      ...transaction,
      createdAt: new Date()
    });

    // Store in Redis for real-time monitoring
    await this.redis.lpush('transactions:recent', JSON.stringify(transaction));
    await this.redis.ltrim('transactions:recent', 0, 999); // Keep last 1000 transactions

    // Update real-time counters
    const today = new Date().toISOString().split('T')[0];
    await this.redis.hincrby(`transactions:daily:${today}`, transaction.type, 1);
    await this.redis.hincrby(`transactions:daily:${today}`, 'total', 1);

    // Check for suspicious activity
    await this.checkSuspiciousActivity(transaction);
  }

  /**
   * Fraud Detection and Suspicious Activity Monitoring
   */
  async checkSuspiciousActivity(transaction: TransactionMetrics): Promise<void> {
    const suspiciousActivities: SuspiciousActivity[] = [];

    // Check for rapid transactions (more than 10 in 1 minute)
    const recentTransactions = await this.getUserRecentTransactions(transaction.userId, 60);
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
    const percentile95 = await this.getAmountPercentile(95);
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
      const userNormalHours = await this.getUserNormalHours(transaction.userId);
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
      const failedCount = await this.getUserFailedTransactions(transaction.userId, 300); // 5 minutes
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
  }

  /**
   * Audit Logging for Administrative Actions
   */
  async logAdminAction(auditLog: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    const log: AuditLog = {
      ...auditLog,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    // Store in MongoDB for permanent record
    await this.db.collection('audit_logs').insertOne(log);

    // Store in Redis for real-time monitoring
    await this.redis.lpush('audit:recent', JSON.stringify(log));
    await this.redis.ltrim('audit:recent', 0, 499); // Keep last 500 logs

    // Alert on critical actions
    if (this.isCriticalAction(auditLog.action)) {
      await this.alertCriticalAction(log);
    }
  }

  /**
   * Performance Monitoring
   */
  async recordPerformanceMetric(
    operation: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>
  ): Promise<void> {
    const metric = {
      operation,
      duration,
      success,
      timestamp: new Date(),
      metadata: metadata || {}
    };

    // Store in time-series format
    const key = `performance:${operation}:${new Date().toISOString().split('T')[0]}`;
    await this.redis.lpush(key, JSON.stringify(metric));
    await this.redis.expire(key, 86400 * 7); // Keep for 7 days

    // Update aggregated metrics
    await this.updatePerformanceAggregates(operation, duration, success);
  }

  /**
   * Helper Methods
   */
  private async getTotalAssets(): Promise<number> {
    return await this.db.collection('assets').countDocuments({ status: 'active' });
  }

  private async getTotalLoans(): Promise<number> {
    return await this.db.collection('loans').countDocuments({ status: { $in: ['active', 'pending'] } });
  }

  private async getTotalStaked(): Promise<number> {
    const result = await this.db.collection('staking').aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    return result[0]?.total || 0;
  }

  private async getActiveUsers(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return await this.db.collection('users').countDocuments({
      lastActivity: { $gte: thirtyDaysAgo }
    });
  }

  private async getTotalVolume(): Promise<number> {
    const result = await this.db.collection('transactions').aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    return result[0]?.total || 0;
  }

  private async getUtilizationRate(): Promise<number> {
    const [totalDeposits, totalBorrows] = await Promise.all([
      this.db.collection('lending_pools').aggregate([
        { $group: { _id: null, total: { $sum: '$totalDeposits' } } }
      ]).toArray(),
      this.db.collection('lending_pools').aggregate([
        { $group: { _id: null, total: { $sum: '$totalBorrows' } } }
      ]).toArray()
    ]);

    const deposits = totalDeposits[0]?.total || 0;
    const borrows = totalBorrows[0]?.total || 0;
    return deposits > 0 ? (borrows / deposits) * 100 : 0;
  }

  private async getAverageAPY(): Promise<number> {
    const result = await this.db.collection('lending_pools').aggregate([
      { $group: { _id: null, avgAPY: { $avg: '$currentAPY' } } }
    ]).toArray();
    return result[0]?.avgAPY || 0;
  }

  private async getLiquidationRate(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [totalLoans, liquidatedLoans] = await Promise.all([
      this.db.collection('loans').countDocuments({
        createdAt: { $gte: thirtyDaysAgo }
      }),
      this.db.collection('loans').countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
        status: 'liquidated'
      })
    ]);

    return totalLoans > 0 ? (liquidatedLoans / totalLoans) * 100 : 0;
  }

  private async getUserRecentTransactions(userId: string, seconds: number): Promise<TransactionMetrics[]> {
    const since = new Date(Date.now() - seconds * 1000);
    const transactions = await this.db.collection('transactions')
      .find({ userId, timestamp: { $gte: since } })
      .toArray();
    return transactions.map(doc => ({
      transactionId: doc.transactionId,
      userId: doc.userId,
      type: doc.type,
      amount: doc.amount,
      timestamp: doc.timestamp,
      status: doc.status,
      gasUsed: doc.gasUsed,
      processingTime: doc.processingTime,
      riskScore: doc.riskScore
    }));
  }

  private async getAmountPercentile(percentile: number): Promise<number> {
    const result = await this.db.collection('transactions').aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, amounts: { $push: '$amount' } } },
      { $project: { percentile: { $arrayElemAt: ['$amounts', { $floor: { $multiply: [{ $size: '$amounts' }, percentile / 100] } }] } } }
    ]).toArray();
    return result[0]?.percentile || 0;
  }

  private async getUserNormalHours(userId: string): Promise<number[]> {
    const cached = await this.redis.get(`user:${userId}:normal_hours`);
    if (cached) {
      return JSON.parse(cached);
    }

    const transactions = await this.db.collection('transactions')
      .find({ userId, status: 'completed' })
      .limit(100)
      .toArray();

    const hours = transactions.map(t => new Date(t.timestamp).getHours());
    const hourCounts = hours.reduce((acc, hour) => {
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const normalHours = Object.entries(hourCounts)
      .filter(([_, count]) => count >= 2)
      .map(([hour, _]) => parseInt(hour));

    await this.redis.setex(`user:${userId}:normal_hours`, 3600, JSON.stringify(normalHours));
    return normalHours;
  }

  private async getUserFailedTransactions(userId: string, seconds: number): Promise<number> {
    const since = new Date(Date.now() - seconds * 1000);
    return await this.db.collection('transactions').countDocuments({
      userId,
      status: 'failed',
      timestamp: { $gte: since }
    });
  }

  private async recordSuspiciousActivity(activity: SuspiciousActivity): Promise<void> {
    // Store in MongoDB
    await this.db.collection('suspicious_activities').insertOne(activity);

    // Store in Redis for real-time alerts
    await this.redis.lpush('suspicious:recent', JSON.stringify(activity));
    await this.redis.ltrim('suspicious:recent', 0, 99); // Keep last 100

    // Trigger alerts for high/critical severity
    if (activity.severity === 'high' || activity.severity === 'critical') {
      await this.alertSuspiciousActivity(activity);
    }
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
    // Store alert in Redis for real-time processing
    await this.redis.lpush('alerts:critical', JSON.stringify({
      type: 'critical_admin_action',
      log,
      timestamp: new Date()
    }));

    // Could integrate with external alerting systems here
    console.warn(`CRITICAL ADMIN ACTION: ${log.action} by ${log.adminId}`);
  }

  private async alertSuspiciousActivity(activity: SuspiciousActivity): Promise<void> {
    // Store alert in Redis for real-time processing
    await this.redis.lpush('alerts:suspicious', JSON.stringify({
      type: 'suspicious_activity',
      activity,
      timestamp: new Date()
    }));

    // Could integrate with external alerting systems here
    console.warn(`SUSPICIOUS ACTIVITY: ${activity.activityType} for user ${activity.userId}`);
  }

  private async updatePerformanceAggregates(
    operation: string,
    duration: number,
    success: boolean
  ): Promise<void> {
    const key = `performance:agg:${operation}`;
    const pipeline = this.redis.pipeline();

    // Update counters
    pipeline.hincrby(key, 'total_count', 1);
    if (success) {
      pipeline.hincrby(key, 'success_count', 1);
    } else {
      pipeline.hincrby(key, 'error_count', 1);
    }

    // Update duration stats
    pipeline.hincrby(key, 'total_duration', duration);
    
    // Get current min/max for comparison
    const current = await this.redis.hmget(key, 'min_duration', 'max_duration');
    const currentMin = current[0] ? parseInt(current[0]) : Infinity;
    const currentMax = current[1] ? parseInt(current[1]) : 0;

    if (duration < currentMin) {
      pipeline.hset(key, 'min_duration', duration);
    }
    if (duration > currentMax) {
      pipeline.hset(key, 'max_duration', duration);
    }

    pipeline.expire(key, 86400); // Expire after 24 hours
    await pipeline.exec();
  }

  /**
   * Dashboard Data Retrieval
   */
  async getDashboardData(): Promise<{
    metrics: PlatformMetrics;
    recentTransactions: TransactionMetrics[];
    suspiciousActivities: SuspiciousActivity[];
    recentAuditLogs: AuditLog[];
    performanceMetrics: Record<string, any>;
  }> {
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
  }

  private async getRecentTransactions(limit: number): Promise<TransactionMetrics[]> {
    const transactions = await this.redis.lrange('transactions:recent', 0, limit - 1);
    return transactions.map(t => JSON.parse(t));
  }

  private async getRecentSuspiciousActivities(limit: number): Promise<SuspiciousActivity[]> {
    const activities = await this.redis.lrange('suspicious:recent', 0, limit - 1);
    return activities.map(a => JSON.parse(a));
  }

  private async getRecentAuditLogs(limit: number): Promise<AuditLog[]> {
    const logs = await this.redis.lrange('audit:recent', 0, limit - 1);
    return logs.map(l => JSON.parse(l));
  }

  private async getPerformanceMetrics(): Promise<Record<string, any>> {
    const operations = ['tokenization', 'lending', 'staking', 'liquidation'];
    const metrics: Record<string, any> = {};

    for (const operation of operations) {
      const key = `performance:agg:${operation}`;
      const data = await this.redis.hgetall(key);
      
      if (data.total_count) {
        const totalCount = parseInt(data.total_count);
        const successCount = parseInt(data.success_count || '0');
        const totalDuration = parseInt(data.total_duration || '0');
        
        metrics[operation] = {
          totalCount,
          successRate: (successCount / totalCount) * 100,
          averageDuration: totalDuration / totalCount,
          minDuration: parseInt(data.min_duration || '0'),
          maxDuration: parseInt(data.max_duration || '0')
        };
      }
    }

    return metrics;
  }
}