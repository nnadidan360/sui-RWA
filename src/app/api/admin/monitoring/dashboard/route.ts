/**
 * Monitoring Dashboard API Endpoint
 * Provides aggregated platform metrics and monitoring data
 * Requirements: 6.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from 'ioredis';
import { MongoClient } from 'mongodb';
import { AnalyticsService } from '@/lib/monitoring/analytics';

// Initialize connections (in production, these would be properly configured)
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const mongoClient = new MongoClient(process.env.MONGODB_URL || 'mongodb://localhost:27017');

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !isValidAdminToken(authHeader)) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    // Connect to MongoDB
    await mongoClient.connect();
    const db = mongoClient.db('rwa_lending_protocol');

    // Initialize analytics service
    const analyticsService = new AnalyticsService(redis, db);

    // Get dashboard data
    const dashboardData = await analyticsService.getDashboardData();

    // Log admin access for audit trail
    await analyticsService.logAdminAction({
      adminId: extractAdminId(authHeader),
      action: 'view_monitoring_dashboard',
      resource: 'monitoring_dashboard',
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await mongoClient.close();
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !isValidAdminToken(authHeader)) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, parameters } = body;

    // Connect to MongoDB
    await mongoClient.connect();
    const db = mongoClient.db('rwa_lending_protocol');

    // Initialize analytics service
    const analyticsService = new AnalyticsService(redis, db);

    let result;

    switch (action) {
      case 'refresh_metrics':
        result = await analyticsService.collectPlatformMetrics();
        break;

      case 'clear_suspicious_activities':
        await redis.del('suspicious:recent');
        result = { success: true, message: 'Suspicious activities cleared' };
        break;

      case 'export_audit_logs':
        const { startDate, endDate } = parameters;
        result = await exportAuditLogs(db, startDate, endDate);
        break;

      case 'update_alert_thresholds':
        const { thresholds } = parameters;
        await updateAlertThresholds(redis, thresholds);
        result = { success: true, message: 'Alert thresholds updated' };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Log admin action
    await analyticsService.logAdminAction({
      adminId: extractAdminId(authHeader),
      action: `monitoring_${action}`,
      resource: 'monitoring_dashboard',
      newValue: parameters,
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Dashboard action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await mongoClient.close();
  }
}

// Helper functions
function isValidAdminToken(authHeader: string): boolean {
  // In production, this would validate JWT tokens and check admin roles
  const token = authHeader.replace('Bearer ', '');
  
  // Mock validation - replace with actual JWT verification
  return token.includes('admin') || token.includes('moderator');
}

function extractAdminId(authHeader: string): string {
  // In production, this would extract the admin ID from the JWT token
  const token = authHeader.replace('Bearer ', '');
  
  // Mock extraction - replace with actual JWT parsing
  if (token.includes('admin')) {
    return 'admin@platform.com';
  } else if (token.includes('moderator')) {
    return 'moderator@platform.com';
  }
  
  return 'unknown@admin.com';
}

async function exportAuditLogs(db: any, startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const logs = await db.collection('audit_logs')
    .find({
      timestamp: {
        $gte: start,
        $lte: end
      }
    })
    .sort({ timestamp: -1 })
    .limit(10000)
    .toArray();

  return {
    success: true,
    data: logs,
    count: logs.length,
    dateRange: { startDate, endDate }
  };
}

async function updateAlertThresholds(redis: Redis, thresholds: Record<string, any>) {
  const key = 'monitoring:alert_thresholds';
  
  for (const [metric, threshold] of Object.entries(thresholds)) {
    await redis.hset(key, metric, JSON.stringify(threshold));
  }

  // Set expiration for 30 days
  await redis.expire(key, 30 * 24 * 60 * 60);
}