/**
 * Audit Logger for Administrative Actions
 * 
 * Logs all administrative actions for security monitoring and compliance
 */

import { AuditLog } from '@/types/auth';

export interface AuditLoggerConfig {
  enableConsoleLogging?: boolean;
  enableFileLogging?: boolean;
  enableDatabaseLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  maxLogSize?: number;
  retentionDays?: number;
}

export class AuditLogger {
  private config: AuditLoggerConfig;
  private logs: AuditLog[] = [];
  private logId = 0;

  constructor(config: AuditLoggerConfig = {}) {
    this.config = {
      enableConsoleLogging: true,
      enableFileLogging: false,
      enableDatabaseLogging: true,
      logLevel: 'info',
      maxLogSize: 10000,
      retentionDays: 90,
      ...config
    };
  }

  /**
   * Log an administrative action
   */
  async log(logEntry: Omit<AuditLog, 'id'>): Promise<void> {
    const auditLog: AuditLog = {
      id: this.generateLogId(),
      ...logEntry
    };

    // Store in memory (in production, this would go to a database)
    this.logs.push(auditLog);
    this.enforceLogSizeLimit();

    // Console logging
    if (this.config.enableConsoleLogging) {
      this.logToConsole(auditLog);
    }

    // File logging (would be implemented in production)
    if (this.config.enableFileLogging) {
      await this.logToFile(auditLog);
    }

    // Database logging (would be implemented in production)
    if (this.config.enableDatabaseLogging) {
      await this.logToDatabase(auditLog);
    }
  }

  /**
   * Log successful administrative action
   */
  async logSuccess(
    adminId: string,
    adminEmail: string,
    action: string,
    resource: string,
    details: Record<string, any>,
    ipAddress: string,
    userAgent: string,
    resourceId?: string
  ): Promise<void> {
    await this.log({
      adminId,
      adminEmail,
      action,
      resource,
      resourceId,
      details,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      success: true
    });
  }

  /**
   * Log failed administrative action
   */
  async logFailure(
    adminId: string,
    adminEmail: string,
    action: string,
    resource: string,
    error: string,
    details: Record<string, any>,
    ipAddress: string,
    userAgent: string,
    resourceId?: string
  ): Promise<void> {
    await this.log({
      adminId,
      adminEmail,
      action,
      resource,
      resourceId,
      details,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      success: false,
      error
    });
  }

  /**
   * Get audit logs with filtering
   */
  getLogs(filters?: {
    adminId?: string;
    action?: string;
    resource?: string;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): AuditLog[] {
    let filteredLogs = [...this.logs];

    if (filters) {
      if (filters.adminId) {
        filteredLogs = filteredLogs.filter(log => log.adminId === filters.adminId);
      }
      
      if (filters.action) {
        filteredLogs = filteredLogs.filter(log => 
          log.action.toLowerCase().includes(filters.action!.toLowerCase())
        );
      }
      
      if (filters.resource) {
        filteredLogs = filteredLogs.filter(log => log.resource === filters.resource);
      }
      
      if (filters.success !== undefined) {
        filteredLogs = filteredLogs.filter(log => log.success === filters.success);
      }
      
      if (filters.startDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startDate!);
      }
      
      if (filters.endDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endDate!);
      }
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    if (filters?.offset) {
      filteredLogs = filteredLogs.slice(filters.offset);
    }
    
    if (filters?.limit) {
      filteredLogs = filteredLogs.slice(0, filters.limit);
    }

    return filteredLogs;
  }

  /**
   * Get audit log statistics
   */
  getStats(timeRange?: { startDate: Date; endDate: Date }): {
    totalLogs: number;
    successfulActions: number;
    failedActions: number;
    uniqueAdmins: number;
    topActions: Array<{ action: string; count: number }>;
    topResources: Array<{ resource: string; count: number }>;
  } {
    let logs = this.logs;

    if (timeRange) {
      logs = logs.filter(log => 
        log.timestamp >= timeRange.startDate && log.timestamp <= timeRange.endDate
      );
    }

    const successfulActions = logs.filter(log => log.success).length;
    const failedActions = logs.filter(log => !log.success).length;
    const uniqueAdmins = new Set(logs.map(log => log.adminId)).size;

    // Count actions
    const actionCounts = new Map<string, number>();
    logs.forEach(log => {
      actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
    });

    // Count resources
    const resourceCounts = new Map<string, number>();
    logs.forEach(log => {
      resourceCounts.set(log.resource, (resourceCounts.get(log.resource) || 0) + 1);
    });

    // Get top actions and resources
    const topActions = Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topResources = Array.from(resourceCounts.entries())
      .map(([resource, count]) => ({ resource, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalLogs: logs.length,
      successfulActions,
      failedActions,
      uniqueAdmins,
      topActions,
      topResources
    };
  }

  /**
   * Search audit logs
   */
  searchLogs(query: string, limit: number = 100): AuditLog[] {
    const searchTerm = query.toLowerCase();
    
    return this.logs
      .filter(log => 
        log.action.toLowerCase().includes(searchTerm) ||
        log.resource.toLowerCase().includes(searchTerm) ||
        log.adminEmail.toLowerCase().includes(searchTerm) ||
        log.details && JSON.stringify(log.details).toLowerCase().includes(searchTerm) ||
        (log.error && log.error.toLowerCase().includes(searchTerm))
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Export audit logs
   */
  exportLogs(format: 'json' | 'csv' = 'json', filters?: any): string {
    const logs = this.getLogs(filters);

    if (format === 'csv') {
      return this.exportToCsv(logs);
    }

    return JSON.stringify(logs, null, 2);
  }

  /**
   * Clear old logs based on retention policy
   */
  cleanupOldLogs(): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays!);

    const initialCount = this.logs.length;
    this.logs = this.logs.filter(log => log.timestamp >= cutoffDate);
    
    return initialCount - this.logs.length;
  }

  // Private helper methods

  private generateLogId(): string {
    return `audit_${Date.now()}_${++this.logId}`;
  }

  private logToConsole(auditLog: AuditLog): void {
    const logLevel = auditLog.success ? 'info' : 'warn';
    const message = `[AUDIT] ${auditLog.action} on ${auditLog.resource} by ${auditLog.adminEmail}`;
    
    console[logLevel]({
      message,
      auditLog: {
        id: auditLog.id,
        adminId: auditLog.adminId,
        action: auditLog.action,
        resource: auditLog.resource,
        success: auditLog.success,
        timestamp: auditLog.timestamp,
        ipAddress: auditLog.ipAddress
      }
    });
  }

  private async logToFile(auditLog: AuditLog): Promise<void> {
    // In production, this would write to a log file
    // For now, we'll just simulate it
    console.log(`[FILE LOG] ${JSON.stringify(auditLog)}`);
  }

  private async logToDatabase(auditLog: AuditLog): Promise<void> {
    // In production, this would save to MongoDB or another database
    // For now, we'll just simulate it
    console.log(`[DB LOG] Saved audit log ${auditLog.id} to database`);
  }

  private enforceLogSizeLimit(): void {
    if (this.logs.length > this.config.maxLogSize!) {
      // Remove oldest logs
      const excessLogs = this.logs.length - this.config.maxLogSize!;
      this.logs.splice(0, excessLogs);
    }
  }

  private exportToCsv(logs: AuditLog[]): string {
    if (logs.length === 0) {
      return 'No logs to export';
    }

    const headers = [
      'ID', 'Admin ID', 'Admin Email', 'Action', 'Resource', 'Resource ID',
      'Success', 'Error', 'IP Address', 'User Agent', 'Timestamp', 'Details'
    ];

    const csvRows = [
      headers.join(','),
      ...logs.map(log => [
        log.id,
        log.adminId,
        log.adminEmail,
        log.action,
        log.resource,
        log.resourceId || '',
        log.success,
        log.error || '',
        log.ipAddress,
        `"${log.userAgent}"`,
        log.timestamp.toISOString(),
        `"${JSON.stringify(log.details).replace(/"/g, '""')}"`
      ].join(','))
    ];

    return csvRows.join('\n');
  }
}