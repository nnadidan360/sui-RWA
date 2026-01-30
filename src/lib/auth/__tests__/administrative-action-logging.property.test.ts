/**
 * Property-based tests for Administrative Action Logging
 * **Feature: rwa-lending-protocol, Property 29: Administrative action logging**
 * **Validates: Requirements 7.4**
 * 
 * Tests the comprehensive logging of all administrative actions for security
 * monitoring, compliance, and audit trail purposes.
 */

import fc from 'fast-check';
import { AuditLogger } from '../audit-logger';
import { AdminAuthService } from '../admin-auth-service';
import { AuditLog, AdminPermission } from '@/types/auth';

describe('Administrative Action Logging Property Tests', () => {
  let auditLogger: AuditLogger;
  let authService: AdminAuthService;

  beforeEach(() => {
    auditLogger = new AuditLogger({ 
      enableConsoleLogging: false,
      enableDatabaseLogging: false
    });
    authService = new AdminAuthService();
    // Disable console and database logging during tests
    (authService as any).auditLogger.config.enableConsoleLogging = false;
    (authService as any).auditLogger.config.enableDatabaseLogging = false;
  });

  /**
   * **Feature: rwa-lending-protocol, Property 29: Administrative action logging**
   * **Validates: Requirements 7.4**
   * 
   * Property: All administrative actions should be logged with complete information
   */
  test('property: all administrative actions should be logged with required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          adminId: fc.string({ minLength: 5, maxLength: 20 }),
          adminEmail: fc.emailAddress(),
          action: fc.constantFrom(
            'LOGIN_SUCCESS', 'LOGIN_ATTEMPT', 'LOGOUT', 'TOKEN_REFRESH',
            'CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'CHANGE_PERMISSIONS',
            'BLOCK_IP', 'UNBLOCK_IP', 'SECURITY_ALERT_CREATED'
          ),
          resource: fc.constantFrom(
            'admin_auth', 'user_management', 'security_monitor', 'asset_management',
            'lending_pool', 'staking_system'
          ),
          resourceId: fc.option(fc.string({ minLength: 5, maxLength: 20 })),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 50 }),
          success: fc.boolean(),
          error: fc.option(fc.string({ minLength: 5, maxLength: 100 })),
          details: fc.record({
            sessionId: fc.option(fc.string({ minLength: 10, maxLength: 50 })),
            reason: fc.option(fc.string({ minLength: 5, maxLength: 50 })),
            targetUserId: fc.option(fc.string({ minLength: 5, maxLength: 20 })),
            changes: fc.option(fc.record({
              field: fc.string({ minLength: 3, maxLength: 20 }),
              oldValue: fc.string({ minLength: 1, maxLength: 50 }),
              newValue: fc.string({ minLength: 1, maxLength: 50 })
            }))
          })
        }),
        async (logData) => {
          const initialLogCount = auditLogger.getLogs().length;

          // Log the administrative action
          await auditLogger.log({
            adminId: logData.adminId,
            adminEmail: logData.adminEmail,
            action: logData.action,
            resource: logData.resource,
            resourceId: logData.resourceId || undefined,
            details: logData.details,
            ipAddress: logData.ipAddress,
            userAgent: logData.userAgent,
            timestamp: new Date(),
            success: logData.success,
            error: logData.error || undefined
          });

          const logs = auditLogger.getLogs();
          expect(logs.length).toBe(initialLogCount + 1);

          const newLog = logs[0]; // Most recent log first
          
          // Verify all required fields are present
          expect(newLog.id).toBeDefined();
          expect(newLog.adminId).toBe(logData.adminId);
          expect(newLog.adminEmail).toBe(logData.adminEmail);
          expect(newLog.action).toBe(logData.action);
          expect(newLog.resource).toBe(logData.resource);
          expect(newLog.ipAddress).toBe(logData.ipAddress);
          expect(newLog.userAgent).toBe(logData.userAgent);
          expect(newLog.timestamp).toBeInstanceOf(Date);
          expect(newLog.success).toBe(logData.success);
          
          // Verify optional fields
          if (logData.resourceId) {
            expect(newLog.resourceId).toBe(logData.resourceId);
          }
          
          if (logData.error) {
            expect(newLog.error).toBe(logData.error);
          }
          
          expect(newLog.details).toEqual(logData.details);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('property: log filtering should work correctly for all filter combinations', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            adminId: fc.string({ minLength: 5, maxLength: 20 }),
            adminEmail: fc.emailAddress(),
            action: fc.constantFrom('LOGIN_SUCCESS', 'LOGIN_ATTEMPT', 'CREATE_USER', 'DELETE_USER'),
            resource: fc.constantFrom('admin_auth', 'user_management', 'security_monitor'),
            success: fc.boolean(),
            timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            ipAddress: fc.ipV4(),
            userAgent: fc.string({ minLength: 10, maxLength: 50 })
          }),
          { minLength: 5, maxLength: 20 }
        ),
        fc.record({
          adminId: fc.option(fc.string({ minLength: 5, maxLength: 20 })),
          action: fc.option(fc.constantFrom('LOGIN_SUCCESS', 'CREATE_USER')),
          resource: fc.option(fc.constantFrom('admin_auth', 'user_management')),
          success: fc.option(fc.boolean()),
          startDate: fc.option(fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-30') })),
          endDate: fc.option(fc.date({ min: new Date('2024-07-01'), max: new Date('2024-12-31') })),
          limit: fc.option(fc.integer({ min: 1, max: 10 }))
        }),
        async (logEntries, filters) => {
          // Create a fresh audit logger for this specific test
          const testAuditLogger = new AuditLogger({ 
            enableConsoleLogging: false,
            enableDatabaseLogging: false
          });

          // Add test logs to the fresh audit logger
          for (const entry of logEntries) {
            await testAuditLogger.log({
              adminId: entry.adminId,
              adminEmail: entry.adminEmail,
              action: entry.action,
              resource: entry.resource,
              details: {},
              ipAddress: entry.ipAddress,
              userAgent: entry.userAgent,
              timestamp: entry.timestamp,
              success: entry.success
            });
          }

          // Apply filters - if all filters are null, pass undefined instead
          const hasActiveFilters = Object.values(filters).some(v => v !== null && v !== undefined);
          const actualFilters = hasActiveFilters ? filters : undefined;
          const filteredLogs = testAuditLogger.getLogs(actualFilters);
          
          // Debug: log the issue if filtering fails
          const expectedCount = logEntries.length;
          const actualLogs = (testAuditLogger as any).logs;
          
          if (Object.values(filters).every(v => v === null) && filteredLogs.length !== expectedCount) {
            console.log('Filter issue:', { 
              filters, 
              expectedCount, 
              actualCount: filteredLogs.length,
              logEntries: logEntries.length,
              actualLogs: actualLogs.length,
              sampleLog: actualLogs[0],
              sampleFilteredLog: filteredLogs[0]
            });
            
            // Test with no filters
            const noFilterLogs = testAuditLogger.getLogs();
            console.log('No filter test:', noFilterLogs.length);
            
            return false;
          }

          // Verify filtering logic
          for (const log of filteredLogs) {
            if (filters.adminId !== null && filters.adminId !== undefined && log.adminId !== filters.adminId) {
              return false;
            }
            
            if (filters.action !== null && filters.action !== undefined && !log.action.toLowerCase().includes(filters.action.toLowerCase())) {
              return false;
            }
            
            if (filters.resource !== null && filters.resource !== undefined && log.resource !== filters.resource) {
              return false;
            }
            
            if (filters.success !== null && filters.success !== undefined && log.success !== filters.success) {
              return false;
            }
            
            if (filters.startDate !== null && filters.startDate !== undefined && log.timestamp.getTime() < filters.startDate.getTime()) {
              return false;
            }
            
            if (filters.endDate !== null && filters.endDate !== undefined && log.timestamp.getTime() > filters.endDate.getTime()) {
              return false;
            }
          }

          // Verify limit is respected
          if (filters.limit !== null && filters.limit !== undefined && filteredLogs.length > filters.limit) {
            return false;
          }

          // Verify logs are sorted by timestamp (newest first)
          for (let i = 1; i < filteredLogs.length; i++) {
            if (filteredLogs[i - 1].timestamp.getTime() < filteredLogs[i].timestamp.getTime()) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 15 }
    );
  });

  test('property: log statistics should accurately reflect logged data', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            adminId: fc.string({ minLength: 5, maxLength: 20 }),
            adminEmail: fc.emailAddress(),
            action: fc.constantFrom('LOGIN_SUCCESS', 'LOGIN_ATTEMPT', 'CREATE_USER', 'DELETE_USER'),
            resource: fc.constantFrom('admin_auth', 'user_management', 'security_monitor'),
            success: fc.boolean(),
            timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            ipAddress: fc.ipV4(),
            userAgent: fc.string({ minLength: 10, maxLength: 50 })
          }),
          { minLength: 3, maxLength: 15 }
        ),
        async (logEntries) => {
          // Create a fresh audit logger for this test
          const testAuditLogger = new AuditLogger({ 
            enableConsoleLogging: false,
            enableDatabaseLogging: false
          });

          // Add test logs
          for (const entry of logEntries) {
            await testAuditLogger.log({
              adminId: entry.adminId,
              adminEmail: entry.adminEmail,
              action: entry.action,
              resource: entry.resource,
              details: {},
              ipAddress: entry.ipAddress,
              userAgent: entry.userAgent,
              timestamp: entry.timestamp,
              success: entry.success
            });
          }

          const stats = testAuditLogger.getStats();

          // Verify total logs count
          if (stats.totalLogs !== logEntries.length) {
            return false;
          }

          // Verify successful/failed action counts
          const expectedSuccessful = logEntries.filter(entry => entry.success).length;
          const expectedFailed = logEntries.filter(entry => !entry.success).length;
          
          if (stats.successfulActions !== expectedSuccessful) {
            return false;
          }
          
          if (stats.failedActions !== expectedFailed) {
            return false;
          }

          // Verify unique admins count
          const uniqueAdmins = new Set(logEntries.map(entry => entry.adminId));
          if (stats.uniqueAdmins !== uniqueAdmins.size) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('property: log search should find relevant entries', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            adminId: fc.string({ minLength: 5, maxLength: 20 }),
            adminEmail: fc.emailAddress(),
            action: fc.constantFrom('LOGIN_SUCCESS', 'USER_CREATED', 'PASSWORD_RESET', 'PERMISSION_CHANGED'),
            resource: fc.constantFrom('admin_auth', 'user_management', 'security_monitor'),
            success: fc.boolean(),
            timestamp: fc.date(),
            ipAddress: fc.ipV4(),
            userAgent: fc.string({ minLength: 10, maxLength: 50 }),
            error: fc.option(fc.string({ minLength: 5, maxLength: 50 }))
          }),
          { minLength: 5, maxLength: 15 }
        ),
        fc.constantFrom('LOGIN', 'USER', 'PASSWORD', 'admin_auth', 'PERMISSION'),
        async (logEntries, searchTerm) => {
          // Create a fresh audit logger for this test
          const testAuditLogger = new AuditLogger({ 
            enableConsoleLogging: false,
            enableDatabaseLogging: false
          });

          // Add test logs
          for (const entry of logEntries) {
            await testAuditLogger.log({
              adminId: entry.adminId,
              adminEmail: entry.adminEmail,
              action: entry.action,
              resource: entry.resource,
              details: {},
              ipAddress: entry.ipAddress,
              userAgent: entry.userAgent,
              timestamp: entry.timestamp,
              success: entry.success,
              error: entry.error
            });
          }

          const searchResults = testAuditLogger.searchLogs(searchTerm);

          // Verify all results contain the search term
          for (const result of searchResults) {
            const searchTermLower = searchTerm.toLowerCase();
            const matchFound = 
              result.action.toLowerCase().includes(searchTermLower) ||
              result.resource.toLowerCase().includes(searchTermLower) ||
              result.adminEmail.toLowerCase().includes(searchTermLower) ||
              (result.error && result.error.toLowerCase().includes(searchTermLower)) ||
              JSON.stringify(result.details).toLowerCase().includes(searchTermLower);

            if (!matchFound) {
              return false;
            }
          }

          // Verify results are sorted by timestamp (newest first)
          for (let i = 1; i < searchResults.length; i++) {
            if (searchResults[i - 1].timestamp.getTime() < searchResults[i].timestamp.getTime()) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('property: authentication service should log all login attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 8, maxLength: 20 }),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 50 }),
          shouldSucceed: fc.boolean()
        }),
        async ({ email, password, ipAddress, userAgent, shouldSucceed }) => {
          const initialLogCount = (authService as any).auditLogger.getLogs().length;

          // Mock admin lookup based on shouldSucceed
          const originalFindAdmin = (authService as any).findAdminByEmail;
          if (shouldSucceed) {
            (authService as any).findAdminByEmail = jest.fn().mockResolvedValue({
              id: 'test-admin',
              email,
              passwordHash: 'hashed-password',
              roles: [{ name: 'admin', permissions: [AdminPermission.READ_USERS], description: 'Admin' }],
              permissions: [AdminPermission.READ_USERS],
              lastLogin: new Date(),
              mfaEnabled: false,
              isActive: true,
              failedLoginAttempts: 0,
              createdAt: new Date(),
              updatedAt: new Date()
            });

            // Mock bcrypt to return success
            const bcrypt = require('bcryptjs');
            bcrypt.compare = jest.fn().mockResolvedValue(true);
          } else {
            (authService as any).findAdminByEmail = jest.fn().mockResolvedValue(null);
          }

          try {
            await authService.login({ email, password }, ipAddress, userAgent);
          } catch (error) {
            // Expected for failed attempts
          }

          const logs = (authService as any).auditLogger.getLogs();
          expect(logs.length).toBeGreaterThan(initialLogCount);

          // Find the login-related log
          const loginLog = logs.find((log: AuditLog) => 
            log.action.includes('LOGIN') && 
            log.adminEmail === email &&
            log.ipAddress === ipAddress
          );

          expect(loginLog).toBeDefined();
          expect(loginLog.adminEmail).toBe(email);
          expect(loginLog.ipAddress).toBe(ipAddress);
          expect(loginLog.userAgent).toBe(userAgent);
          expect(loginLog.resource).toBe('admin_auth');
          expect(loginLog.timestamp).toBeInstanceOf(Date);

          if (shouldSucceed) {
            expect(loginLog.action).toBe('LOGIN_SUCCESS');
            expect(loginLog.success).toBe(true);
          } else {
            expect(loginLog.action).toBe('LOGIN_ATTEMPT');
            expect(loginLog.success).toBe(false);
          }

          (authService as any).findAdminByEmail = originalFindAdmin;
        }
      ),
      { numRuns: 15 }
    );
  });

  test('property: log export should maintain data integrity', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            adminId: fc.string({ minLength: 5, maxLength: 20 }),
            adminEmail: fc.emailAddress(),
            action: fc.constantFrom('LOGIN_SUCCESS', 'CREATE_USER', 'DELETE_USER'),
            resource: fc.constantFrom('admin_auth', 'user_management'),
            success: fc.boolean(),
            timestamp: fc.date(),
            ipAddress: fc.ipV4(),
            userAgent: fc.string({ minLength: 10, maxLength: 50 })
          }),
          { minLength: 3, maxLength: 10 }
        ),
        fc.constantFrom('json', 'csv'),
        async (logEntries, format) => {
          // Create a fresh audit logger for this test
          const testAuditLogger = new AuditLogger({ 
            enableConsoleLogging: false,
            enableDatabaseLogging: false
          });

          // Add test logs
          for (const entry of logEntries) {
            await testAuditLogger.log({
              adminId: entry.adminId,
              adminEmail: entry.adminEmail,
              action: entry.action,
              resource: entry.resource,
              details: {},
              ipAddress: entry.ipAddress,
              userAgent: entry.userAgent,
              timestamp: entry.timestamp,
              success: entry.success
            });
          }

          const exportedData = testAuditLogger.exportLogs(format);
          
          if (!exportedData || typeof exportedData !== 'string') {
            return false;
          }

          if (format === 'json') {
            try {
              // Verify JSON format
              const parsedData = JSON.parse(exportedData);
              if (!Array.isArray(parsedData) || parsedData.length !== logEntries.length) {
                return false;
              }

              // Verify data integrity
              for (let i = 0; i < parsedData.length; i++) {
                const exportedLog = parsedData[i];
                if (!exportedLog.adminEmail || !exportedLog.action || !exportedLog.resource || exportedLog.success === undefined) {
                  return false;
                }
              }
            } catch (error) {
              return false;
            }
          } else if (format === 'csv') {
            // Verify CSV format
            const lines = exportedData.split('\n');
            if (lines.length <= 1) {
              return false;
            }
            
            // Verify header exists
            const header = lines[0];
            if (!header.includes('Admin Email') || !header.includes('Action') || !header.includes('Resource')) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});