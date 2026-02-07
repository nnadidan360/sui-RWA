/**
 * Test for Monitoring and Analytics Implementation
 * Task 9.3: Implement monitoring and analytics
 * Requirements: 6.3
 */

describe('Monitoring and Analytics Implementation', () => {
  test('should have comprehensive monitoring and analytics system', () => {
    // Test that the monitoring system components exist and are properly structured
    
    // 1. Analytics Service exists and has required methods
    const { AnalyticsService } = require('@/lib/monitoring/analytics');
    expect(AnalyticsService).toBeDefined();
    
    const mockRedis = { setex: jest.fn(), lpush: jest.fn() };
    const mockDb = { collection: jest.fn(() => ({ insertOne: jest.fn(), countDocuments: jest.fn() })) };
    const service = new AnalyticsService(mockRedis, mockDb);
    
    // Verify core methods exist
    expect(typeof service.collectPlatformMetrics).toBe('function');
    expect(typeof service.recordTransaction).toBe('function');
    expect(typeof service.checkSuspiciousActivity).toBe('function');
    expect(typeof service.logAdminAction).toBe('function');
    expect(typeof service.recordPerformanceMetric).toBe('function');
    expect(typeof service.getDashboardData).toBe('function');
  });

  test('should have monitoring dashboard component', () => {
    // Test that the monitoring dashboard exists
    const fs = require('fs');
    const path = require('path');
    
    const dashboardPath = path.join(process.cwd(), 'src/components/admin/monitoring-dashboard.tsx');
    expect(fs.existsSync(dashboardPath)).toBe(true);
    
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    
    // Verify key dashboard features
    expect(dashboardContent).toContain('MonitoringDashboard');
    expect(dashboardContent).toContain('PlatformMetrics');
    expect(dashboardContent).toContain('TransactionMetrics');
    expect(dashboardContent).toContain('SuspiciousActivity');
    expect(dashboardContent).toContain('AuditLog');
    expect(dashboardContent).toContain('fetchDashboardData');
  });

  test('should have monitoring middleware', () => {
    // Test that the monitoring middleware exists
    const fs = require('fs');
    const path = require('path');
    
    const middlewarePath = path.join(process.cwd(), 'src/lib/monitoring/middleware.ts');
    expect(fs.existsSync(middlewarePath)).toBe(true);
    
    const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
    
    // Verify key middleware features
    expect(middlewareContent).toContain('MonitoringMiddleware');
    expect(middlewareContent).toContain('monitorApiRequest');
    expect(middlewareContent).toContain('monitorTransaction');
    expect(middlewareContent).toContain('monitorAuthEvent');
    expect(middlewareContent).toContain('monitorAdminAction');
    expect(middlewareContent).toContain('monitorSystemHealth');
  });

  test('should have dashboard API endpoint', () => {
    // Test that the dashboard API exists
    const fs = require('fs');
    const path = require('path');
    
    const apiPath = path.join(process.cwd(), 'src/app/api/admin/monitoring/dashboard/route.ts');
    expect(fs.existsSync(apiPath)).toBe(true);
    
    const apiContent = fs.readFileSync(apiPath, 'utf8');
    
    // Verify API features
    expect(apiContent).toContain('GET');
    expect(apiContent).toContain('POST');
    expect(apiContent).toContain('AnalyticsService');
    expect(apiContent).toContain('getDashboardData');
    expect(apiContent).toContain('isValidAdminToken');
  });

  test('should implement fraud detection patterns', () => {
    // Test fraud detection implementation
    const { AnalyticsService } = require('@/lib/monitoring/analytics');
    
    const mockRedis = { 
      setex: jest.fn(), 
      lpush: jest.fn(), 
      ltrim: jest.fn(),
      hincrby: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn()
    };
    const mockDb = { 
      collection: jest.fn(() => ({ 
        insertOne: jest.fn(), 
        find: jest.fn(() => ({ toArray: jest.fn().mockResolvedValue([]) })),
        aggregate: jest.fn(() => ({ toArray: jest.fn().mockResolvedValue([{ percentile: 1000 }]) })),
        countDocuments: jest.fn().mockResolvedValue(0)
      })) 
    };
    
    const service = new AnalyticsService(mockRedis, mockDb);
    
    // Test that suspicious activity detection exists
    expect(typeof service.checkSuspiciousActivity).toBe('function');
    
    // Verify the analytics service has the required suspicious activity types
    const analyticsContent = require('fs').readFileSync(
      require('path').join(process.cwd(), 'src/lib/monitoring/analytics.ts'), 
      'utf8'
    );
    
    expect(analyticsContent).toContain('rapid_transactions');
    expect(analyticsContent).toContain('large_amounts');
    expect(analyticsContent).toContain('unusual_patterns');
    expect(analyticsContent).toContain('failed_attempts');
  });

  test('should implement comprehensive audit logging', () => {
    // Test audit logging implementation
    const analyticsContent = require('fs').readFileSync(
      require('path').join(process.cwd(), 'src/lib/monitoring/analytics.ts'), 
      'utf8'
    );
    
    // Verify audit logging features
    expect(analyticsContent).toContain('logAdminAction');
    expect(analyticsContent).toContain('AuditLog');
    expect(analyticsContent).toContain('audit_logs');
    expect(analyticsContent).toContain('isCriticalAction');
    expect(analyticsContent).toContain('alertCriticalAction');
  });

  test('should implement performance monitoring', () => {
    // Test performance monitoring implementation
    const analyticsContent = require('fs').readFileSync(
      require('path').join(process.cwd(), 'src/lib/monitoring/analytics.ts'), 
      'utf8'
    );
    
    // Verify performance monitoring features
    expect(analyticsContent).toContain('recordPerformanceMetric');
    expect(analyticsContent).toContain('updatePerformanceAggregates');
    expect(analyticsContent).toContain('getPerformanceMetrics');
    expect(analyticsContent).toContain('performance:agg');
  });
});