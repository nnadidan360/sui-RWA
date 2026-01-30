/**
 * Real-time Security Monitoring System
 * 
 * Monitors authentication attempts, detects suspicious activity,
 * and provides real-time security alerting
 */

import { AuditLogger } from './audit-logger';
import { RateLimiter } from './rate-limiter';

export interface SecurityAlert {
  id: string;
  type: 'BRUTE_FORCE' | 'ACCOUNT_LOCKOUT' | 'SUSPICIOUS_LOGIN' | 'MULTIPLE_FAILURES' | 'RATE_LIMIT_EXCEEDED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  adminId?: string;
  adminEmail?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  details: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface SecurityMetrics {
  totalLoginAttempts: number;
  failedLoginAttempts: number;
  successfulLogins: number;
  blockedIPs: number;
  activeAlerts: number;
  accountLockouts: number;
  suspiciousActivities: number;
}

export interface SuspiciousActivityPattern {
  type: 'RAPID_FAILURES' | 'MULTIPLE_IPS' | 'UNUSUAL_TIMING' | 'GEOGRAPHIC_ANOMALY';
  threshold: number;
  timeWindow: number; // in milliseconds
  description: string;
}

export class SecurityMonitor {
  private auditLogger: AuditLogger;
  private rateLimiter: RateLimiter;
  private alerts: Map<string, SecurityAlert> = new Map();
  private alertId = 0;
  private loginAttempts: Map<string, Array<{ timestamp: number; success: boolean; ipAddress: string }>> = new Map();
  private blockedIPs: Set<string> = new Set();
  private suspiciousPatterns: SuspiciousActivityPattern[] = [
    {
      type: 'RAPID_FAILURES',
      threshold: 10,
      timeWindow: 5 * 60 * 1000, // 5 minutes
      description: 'Multiple rapid failed login attempts'
    },
    {
      type: 'MULTIPLE_IPS',
      threshold: 3,
      timeWindow: 30 * 60 * 1000, // 30 minutes
      description: 'Login attempts from multiple IP addresses'
    },
    {
      type: 'UNUSUAL_TIMING',
      threshold: 5,
      timeWindow: 60 * 60 * 1000, // 1 hour
      description: 'Login attempts at unusual hours'
    }
  ];

  constructor(auditLogger: AuditLogger, rateLimiter: RateLimiter) {
    this.auditLogger = auditLogger;
    this.rateLimiter = rateLimiter;
    this.startMonitoring();
  }

  /**
   * Record a login attempt for monitoring
   */
  recordLoginAttempt(
    adminEmail: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    details?: Record<string, any>
  ): void {
    const timestamp = Date.now();
    
    // Record attempt
    if (!this.loginAttempts.has(adminEmail)) {
      this.loginAttempts.set(adminEmail, []);
    }
    
    const attempts = this.loginAttempts.get(adminEmail)!;
    attempts.push({ timestamp, success, ipAddress });
    
    // Keep only recent attempts (last 24 hours)
    const cutoff = timestamp - (24 * 60 * 60 * 1000);
    this.loginAttempts.set(
      adminEmail,
      attempts.filter(attempt => attempt.timestamp > cutoff)
    );

    // Check for suspicious patterns
    this.checkSuspiciousActivity(adminEmail, ipAddress, userAgent, success, details);
  }

  /**
   * Check for suspicious activity patterns
   */
  private checkSuspiciousActivity(
    adminEmail: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    details?: Record<string, any>
  ): void {
    const attempts = this.loginAttempts.get(adminEmail) || [];
    const now = Date.now();

    // Check each suspicious pattern
    for (const pattern of this.suspiciousPatterns) {
      const recentAttempts = attempts.filter(
        attempt => now - attempt.timestamp <= pattern.timeWindow
      );

      switch (pattern.type) {
        case 'RAPID_FAILURES':
          this.checkRapidFailures(adminEmail, ipAddress, userAgent, recentAttempts, pattern);
          break;
        
        case 'MULTIPLE_IPS':
          this.checkMultipleIPs(adminEmail, ipAddress, userAgent, recentAttempts, pattern);
          break;
        
        case 'UNUSUAL_TIMING':
          this.checkUnusualTiming(adminEmail, ipAddress, userAgent, recentAttempts, pattern);
          break;
      }
    }

    // Check rate limiting violations
    const rateLimitInfo = this.rateLimiter.getRateLimitInfo(`login:${adminEmail}:${ipAddress}`);
    if (rateLimitInfo.isBlocked) {
      this.createAlert({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'HIGH',
        adminEmail,
        ipAddress,
        userAgent,
        details: {
          ...details,
          rateLimitInfo,
          pattern: 'Rate limit exceeded for login attempts'
        }
      });
    }
  }

  /**
   * Check for rapid failure pattern
   */
  private checkRapidFailures(
    adminEmail: string,
    ipAddress: string,
    userAgent: string,
    recentAttempts: Array<{ timestamp: number; success: boolean; ipAddress: string }>,
    pattern: SuspiciousActivityPattern
  ): void {
    const failedAttempts = recentAttempts.filter(attempt => !attempt.success);
    
    if (failedAttempts.length >= pattern.threshold) {
      this.createAlert({
        type: 'BRUTE_FORCE',
        severity: 'CRITICAL',
        adminEmail,
        ipAddress,
        userAgent,
        details: {
          failedAttempts: failedAttempts.length,
          timeWindow: pattern.timeWindow,
          pattern: pattern.description,
          attempts: failedAttempts.slice(-5) // Last 5 attempts
        }
      });

      // Auto-block IP for severe brute force attempts
      if (failedAttempts.length >= 20) {
        this.blockIP(ipAddress, `Brute force attack detected: ${failedAttempts.length} failed attempts`);
      }
    }
  }

  /**
   * Check for multiple IP addresses pattern
   */
  private checkMultipleIPs(
    adminEmail: string,
    ipAddress: string,
    userAgent: string,
    recentAttempts: Array<{ timestamp: number; success: boolean; ipAddress: string }>,
    pattern: SuspiciousActivityPattern
  ): void {
    const uniqueIPs = new Set(recentAttempts.map(attempt => attempt.ipAddress));
    
    if (uniqueIPs.size >= pattern.threshold) {
      this.createAlert({
        type: 'SUSPICIOUS_LOGIN',
        severity: 'MEDIUM',
        adminEmail,
        ipAddress,
        userAgent,
        details: {
          uniqueIPs: Array.from(uniqueIPs),
          ipCount: uniqueIPs.size,
          timeWindow: pattern.timeWindow,
          pattern: pattern.description
        }
      });
    }
  }

  /**
   * Check for unusual timing pattern
   */
  private checkUnusualTiming(
    adminEmail: string,
    ipAddress: string,
    userAgent: string,
    recentAttempts: Array<{ timestamp: number; success: boolean; ipAddress: string }>,
    pattern: SuspiciousActivityPattern
  ): void {
    // Check for attempts during unusual hours (e.g., 2 AM - 6 AM)
    const unusualHourAttempts = recentAttempts.filter(attempt => {
      const hour = new Date(attempt.timestamp).getHours();
      return hour >= 2 && hour <= 6;
    });

    if (unusualHourAttempts.length >= pattern.threshold) {
      this.createAlert({
        type: 'SUSPICIOUS_LOGIN',
        severity: 'LOW',
        adminEmail,
        ipAddress,
        userAgent,
        details: {
          unusualHourAttempts: unusualHourAttempts.length,
          timeWindow: pattern.timeWindow,
          pattern: pattern.description,
          hours: unusualHourAttempts.map(attempt => new Date(attempt.timestamp).getHours())
        }
      });
    }
  }

  /**
   * Create a security alert
   */
  private createAlert(alertData: Omit<SecurityAlert, 'id' | 'timestamp' | 'resolved'>): void {
    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      resolved: false,
      ...alertData
    };

    this.alerts.set(alert.id, alert);

    // Log the alert
    this.auditLogger.log({
      adminId: alert.adminId || 'system',
      adminEmail: alert.adminEmail || 'system',
      action: 'SECURITY_ALERT_CREATED',
      resource: 'security_monitor',
      details: {
        alertId: alert.id,
        alertType: alert.type,
        severity: alert.severity,
        ...alert.details
      },
      ipAddress: alert.ipAddress,
      userAgent: alert.userAgent,
      timestamp: alert.timestamp,
      success: true
    });

    // Send real-time notification (in production, this would use WebSockets or push notifications)
    this.sendSecurityNotification(alert);
  }

  /**
   * Block an IP address
   */
  blockIP(ipAddress: string, reason: string): void {
    this.blockedIPs.add(ipAddress);
    
    this.auditLogger.log({
      adminId: 'system',
      adminEmail: 'system',
      action: 'IP_BLOCKED',
      resource: 'security_monitor',
      details: {
        ipAddress,
        reason,
        blockedAt: new Date()
      },
      ipAddress,
      userAgent: 'system',
      timestamp: new Date(),
      success: true
    });
  }

  /**
   * Unblock an IP address
   */
  unblockIP(ipAddress: string, adminId: string, adminEmail: string): void {
    this.blockedIPs.delete(ipAddress);
    
    this.auditLogger.log({
      adminId,
      adminEmail,
      action: 'IP_UNBLOCKED',
      resource: 'security_monitor',
      details: {
        ipAddress,
        unblockedAt: new Date()
      },
      ipAddress,
      userAgent: 'admin-action',
      timestamp: new Date(),
      success: true
    });
  }

  /**
   * Check if an IP is blocked
   */
  isIPBlocked(ipAddress: string): boolean {
    return this.blockedIPs.has(ipAddress);
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): SecurityAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(timeRange?: { startDate: Date; endDate: Date }): SecurityMetrics {
    const now = Date.now();
    const last24Hours = now - (24 * 60 * 60 * 1000);
    
    let totalLoginAttempts = 0;
    let failedLoginAttempts = 0;
    let successfulLogins = 0;

    for (const attempts of this.loginAttempts.values()) {
      const recentAttempts = attempts.filter(attempt => 
        attempt.timestamp > (timeRange?.startDate.getTime() || last24Hours) &&
        attempt.timestamp < (timeRange?.endDate.getTime() || now)
      );

      totalLoginAttempts += recentAttempts.length;
      failedLoginAttempts += recentAttempts.filter(attempt => !attempt.success).length;
      successfulLogins += recentAttempts.filter(attempt => attempt.success).length;
    }

    const alerts = Array.from(this.alerts.values());
    const activeAlerts = alerts.filter(alert => !alert.resolved).length;
    const accountLockouts = alerts.filter(alert => alert.type === 'ACCOUNT_LOCKOUT').length;
    const suspiciousActivities = alerts.filter(alert => 
      alert.type === 'SUSPICIOUS_LOGIN' || alert.type === 'BRUTE_FORCE'
    ).length;

    return {
      totalLoginAttempts,
      failedLoginAttempts,
      successfulLogins,
      blockedIPs: this.blockedIPs.size,
      activeAlerts,
      accountLockouts,
      suspiciousActivities
    };
  }

  /**
   * Resolve a security alert
   */
  resolveAlert(alertId: string, resolvedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    this.auditLogger.log({
      adminId: resolvedBy,
      adminEmail: resolvedBy,
      action: 'SECURITY_ALERT_RESOLVED',
      resource: 'security_monitor',
      details: {
        alertId,
        alertType: alert.type,
        resolvedAt: alert.resolvedAt
      },
      ipAddress: alert.ipAddress,
      userAgent: 'admin-action',
      timestamp: new Date(),
      success: true
    });

    return true;
  }

  /**
   * Get blocked IPs list
   */
  getBlockedIPs(): string[] {
    return Array.from(this.blockedIPs);
  }

  /**
   * Start monitoring processes
   */
  private startMonitoring(): void {
    // Clean up old data every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);

    // Check for patterns every 5 minutes
    setInterval(() => {
      this.performPeriodicChecks();
    }, 5 * 60 * 1000);
  }

  /**
   * Clean up old monitoring data
   */
  private cleanupOldData(): void {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days

    // Clean up old login attempts
    for (const [email, attempts] of this.loginAttempts.entries()) {
      const recentAttempts = attempts.filter(attempt => attempt.timestamp > cutoff);
      if (recentAttempts.length === 0) {
        this.loginAttempts.delete(email);
      } else {
        this.loginAttempts.set(email, recentAttempts);
      }
    }

    // Clean up old resolved alerts
    const oldAlerts = Array.from(this.alerts.entries())
      .filter(([_, alert]) => alert.resolved && alert.resolvedAt && alert.resolvedAt.getTime() < cutoff);
    
    for (const [alertId] of oldAlerts) {
      this.alerts.delete(alertId);
    }
  }

  /**
   * Perform periodic security checks
   */
  private performPeriodicChecks(): void {
    // Check for accounts with excessive failed attempts
    for (const [email, attempts] of this.loginAttempts.entries()) {
      const recentFailures = attempts.filter(attempt => 
        !attempt.success && 
        Date.now() - attempt.timestamp <= 60 * 60 * 1000 // Last hour
      );

      if (recentFailures.length >= 15) {
        this.createAlert({
          type: 'MULTIPLE_FAILURES',
          severity: 'HIGH',
          adminEmail: email,
          ipAddress: recentFailures[recentFailures.length - 1].ipAddress,
          userAgent: 'periodic-check',
          details: {
            failureCount: recentFailures.length,
            timeWindow: '1 hour',
            pattern: 'Excessive failed login attempts detected'
          }
        });
      }
    }
  }

  /**
   * Send security notification
   */
  private sendSecurityNotification(alert: SecurityAlert): void {
    // In production, this would send real-time notifications via WebSockets,
    // email, SMS, or push notifications based on severity
    console.warn(`[SECURITY ALERT] ${alert.type} - ${alert.severity}`, {
      alertId: alert.id,
      adminEmail: alert.adminEmail,
      ipAddress: alert.ipAddress,
      details: alert.details
    });
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${++this.alertId}`;
  }

  /**
   * Reset security monitor state (for testing purposes)
   */
  resetForTesting(): void {
    this.alerts.clear();
    this.loginAttempts.clear();
    this.blockedIPs.clear();
    this.alertId = 0;
  }
}