/**
 * Monitoring Middleware
 * Automatically tracks transactions and performance metrics
 * Requirements: 6.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from 'ioredis';
import { MongoClient } from 'mongodb';
import { AnalyticsService, TransactionMetrics } from './analytics';

// Initialize connections
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const mongoClient = new MongoClient(process.env.MONGODB_URL || 'mongodb://localhost:27017');

export class MonitoringMiddleware {
  private analyticsService!: AnalyticsService;
  private isConnected = false;

  constructor() {
    this.initializeConnections();
  }

  private async initializeConnections() {
    try {
      await mongoClient.connect();
      const db = mongoClient.db('rwa_lending_protocol');
      this.analyticsService = new AnalyticsService(redis, db);
      this.isConnected = true;
    } catch (error) {
      console.error('Failed to initialize monitoring middleware:', error);
    }
  }

  /**
   * Middleware for API route monitoring
   */
  async monitorApiRequest(
    request: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>,
    operationType: string
  ): Promise<NextResponse> {
    const startTime = Date.now();
    let response: NextResponse;
    let success = true;
    let error: any = null;

    try {
      // Execute the actual handler
      response = await handler(request);
      success = response.status < 400;
    } catch (err: any) {
      error = err;
      success = false;
      response = NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Record performance metrics
    if (this.isConnected) {
      try {
        await this.analyticsService.recordPerformanceMetric(
          operationType,
          duration,
          success,
          {
            method: request.method,
            url: request.url,
            statusCode: response.status,
            userAgent: request.headers.get('user-agent'),
            error: error?.message
          }
        );
      } catch (monitoringError) {
        console.error('Failed to record performance metric:', monitoringError);
      }
    }

    return response;
  }

  /**
   * Monitor transaction operations
   */
  async monitorTransaction(
    userId: string,
    transactionType: 'tokenization' | 'lending' | 'staking' | 'liquidation',
    amount: number,
    status: 'pending' | 'completed' | 'failed',
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.isConnected) {
      await this.initializeConnections();
    }

    const transaction: TransactionMetrics = {
      transactionId: `${transactionType}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      type: transactionType,
      amount,
      timestamp: new Date(),
      status,
      processingTime: metadata?.processingTime,
      riskScore: metadata?.riskScore
    };

    try {
      await this.analyticsService.recordTransaction(transaction);
    } catch (error) {
      console.error('Failed to record transaction:', error);
    }
  }

  /**
   * Monitor user authentication events
   */
  async monitorAuthEvent(
    userId: string,
    eventType: 'login' | 'logout' | 'failed_login' | 'password_reset',
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    if (!this.isConnected) {
      await this.initializeConnections();
    }

    try {
      // Record authentication metrics
      await this.analyticsService.recordPerformanceMetric(
        `auth_${eventType}`,
        0, // Duration not applicable for auth events
        eventType !== 'failed_login',
        {
          userId,
          ipAddress,
          userAgent,
          timestamp: new Date()
        }
      );

      // Check for suspicious authentication patterns
      if (eventType === 'failed_login') {
        await this.checkFailedLoginPattern(userId, ipAddress);
      }
    } catch (error) {
      console.error('Failed to record auth event:', error);
    }
  }

  /**
   * Monitor admin actions
   */
  async monitorAdminAction(
    adminId: string,
    action: string,
    resource: string,
    resourceId?: string,
    oldValue?: any,
    newValue?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    if (!this.isConnected) {
      await this.initializeConnections();
    }

    try {
      await this.analyticsService.logAdminAction({
        adminId,
        action,
        resource,
        resourceId,
        oldValue,
        newValue,
        ipAddress,
        userAgent
      });
    } catch (error) {
      console.error('Failed to log admin action:', error);
    }
  }

  /**
   * Monitor system health metrics
   */
  async monitorSystemHealth(): Promise<void> {
    if (!this.isConnected) {
      await this.initializeConnections();
    }

    try {
      const healthMetrics = await this.collectSystemHealthMetrics();
      
      // Store health metrics in Redis with TTL
      await redis.setex(
        'system:health',
        300, // 5 minutes TTL
        JSON.stringify(healthMetrics)
      );

      // Check for system alerts
      await this.checkSystemAlerts(healthMetrics);
    } catch (error) {
      console.error('Failed to monitor system health:', error);
    }
  }

  /**
   * Helper methods
   */
  private async checkFailedLoginPattern(userId: string, ipAddress?: string): Promise<void> {
    const key = `failed_logins:${userId}`;
    const count = await redis.incr(key);
    await redis.expire(key, 300); // 5 minutes window

    if (count >= 5) {
      // Record suspicious activity
      await this.analyticsService.recordTransaction({
        transactionId: `suspicious_login_${Date.now()}`,
        userId,
        type: 'tokenization', // Using as placeholder for suspicious activity
        amount: 0,
        timestamp: new Date(),
        status: 'failed',
        riskScore: 100 // Maximum risk score
      });

      // Could trigger additional security measures here
      console.warn(`Suspicious login activity detected for user ${userId} from IP ${ipAddress}`);
    }
  }

  private async collectSystemHealthMetrics(): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};

    try {
      // Redis health
      const redisInfo = await redis.info('memory');
      metrics.redis = {
        connected: true,
        memoryUsage: this.parseRedisMemoryUsage(redisInfo)
      };
    } catch (error: any) {
      metrics.redis = { connected: false, error: error.message };
    }

    try {
      // MongoDB health
      const mongoStats = await mongoClient.db('rwa_lending_protocol').stats();
      metrics.mongodb = {
        connected: true,
        collections: mongoStats.collections,
        dataSize: mongoStats.dataSize,
        indexSize: mongoStats.indexSize
      };
    } catch (error: any) {
      metrics.mongodb = { connected: false, error: error.message };
    }

    // System metrics
    metrics.system = {
      timestamp: new Date(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };

    return metrics;
  }

  private parseRedisMemoryUsage(info: string): number {
    const match = info.match(/used_memory:(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  private async checkSystemAlerts(healthMetrics: Record<string, any>): Promise<void> {
    const alerts = [];

    // Check Redis memory usage (alert if > 80% of max memory)
    if (healthMetrics.redis?.memoryUsage > 0.8 * 1024 * 1024 * 1024) { // 800MB threshold
      alerts.push({
        type: 'high_redis_memory',
        severity: 'medium',
        message: 'Redis memory usage is high',
        value: healthMetrics.redis.memoryUsage
      });
    }

    // Check MongoDB connection
    if (!healthMetrics.mongodb?.connected) {
      alerts.push({
        type: 'mongodb_disconnected',
        severity: 'critical',
        message: 'MongoDB connection lost',
        error: healthMetrics.mongodb?.error
      });
    }

    // Check system memory usage
    const memUsage = healthMetrics.system.memoryUsage;
    if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
      alerts.push({
        type: 'high_memory_usage',
        severity: 'high',
        message: 'System memory usage is critical',
        value: (memUsage.heapUsed / memUsage.heapTotal) * 100
      });
    }

    // Store alerts
    for (const alert of alerts) {
      await redis.lpush('system:alerts', JSON.stringify({
        ...alert,
        timestamp: new Date()
      }));
    }

    // Keep only last 100 alerts
    await redis.ltrim('system:alerts', 0, 99);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await redis.quit();
      await mongoClient.close();
    } catch (error) {
      console.error('Failed to cleanup monitoring middleware:', error);
    }
  }
}

// Export singleton instance
export const monitoringMiddleware = new MonitoringMiddleware();

// Utility function for wrapping API handlers
export function withMonitoring(
  handler: (req: NextRequest) => Promise<NextResponse>,
  operationType: string
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    return await monitoringMiddleware.monitorApiRequest(request, handler, operationType);
  };
}