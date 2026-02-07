/**
 * Property-based tests for Authentication Failure Handling
 * **Feature: rwa-lending-protocol, Property 27: Authentication failure handling**
 * **Validates: Requirements 7.2**
 * 
 * Tests the system's ability to handle authentication failures gracefully,
 * including rate limiting, account lockouts, and security monitoring.
 */

import fc from 'fast-check';
import bcrypt from 'bcryptjs';
import { AdminAuthService, AdminAuthenticationError } from '../../src/services/auth/admin-auth-service';
import { AdminUser, AdminPermission } from '../../../shared-types/src/entities';

// Mock bcrypt for testing
jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('Authentication Failure Handling Property Tests', () => {
  let authService: AdminAuthService;

  beforeEach(() => {
    authService = new AdminAuthService();
    
    // Create fresh instances for each test to avoid state pollution
    const { RateLimiter } = require('../rate-limiter');
    const { SecurityMonitor } = require('../security-monitor');
    
    (authService as any).rateLimiter = new RateLimiter({
      windowMs: 15 * 60 * 1000,
      maxAttempts: 5,
      skipSuccessfulRequests: true
    });
    
    (authService as any).securityMonitor = new SecurityMonitor();
    
    // Disable console logging during tests
    (authService as any).auditLogger.config.enableConsoleLogging = false;
    (authService as any).auditLogger.config.enableDatabaseLogging = false;
    if ((authService as any).securityMonitor?.auditLogger?.config) {
      (authService as any).securityMonitor.auditLogger.config.enableConsoleLogging = false;
      (authService as any).securityMonitor.auditLogger.config.enableDatabaseLogging = false;
    }
  });

  /**
   * **Feature: rwa-lending-protocol, Property 27: Authentication failure handling**
   * **Validates: Requirements 7.2**
   * 
   * Property: Rate limiting should consistently block excessive login attempts
   */
  test('property: rate limiting should block excessive login attempts from same IP', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 8, maxLength: 20 }),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 50 }),
          attemptCount: fc.integer({ min: 6, max: 15 }) // More than rate limit
        }),
        async ({ email, password, ipAddress, userAgent, attemptCount }) => {
          // Mock bcrypt to always return false for failed attempts
          mockedBcrypt.compare.mockResolvedValue(false);

          // Mock admin lookup to return a valid admin
          const originalFindAdmin = (authService as any).findAdminByEmail;
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

          let rateLimitedCount = 0;
          let invalidCredentialsCount = 0;

          try {
            // Attempt multiple logins
            for (let i = 0; i < attemptCount; i++) {
              try {
                await authService.login(
                  { email, password },
                  ipAddress,
                  userAgent
                );
              } catch (error) {
                if (error instanceof AdminAuthenticationError) {
                  if (error.code === 'RATE_LIMITED') {
                    rateLimitedCount++;
                  } else if (error.code === 'INVALID_CREDENTIALS') {
                    invalidCredentialsCount++;
                  }
                }
              }
            }

            // After exceeding rate limit (5 attempts), subsequent attempts should be rate limited
            expect(rateLimitedCount).toBeGreaterThan(0);
            expect(invalidCredentialsCount).toBeLessThanOrEqual(5);
            expect(rateLimitedCount + invalidCredentialsCount).toBe(attemptCount);

          } finally {
            (authService as any).findAdminByEmail = originalFindAdmin;
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('property: account lockout should occur after maximum failed attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          adminId: fc.string({ minLength: 5, maxLength: 20 }),
          email: fc.emailAddress(),
          password: fc.string({ minLength: 8, maxLength: 20 }),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 50 })
        }),
        async ({ adminId, email, password, ipAddress, userAgent }) => {
          // Mock bcrypt to always return false for failed attempts
          mockedBcrypt.compare.mockResolvedValue(false);

          // Create admin with some failed attempts already
          const admin: AdminUser = {
            id: adminId,
            email,
            passwordHash: 'hashed-password',
            roles: [{ name: 'admin', permissions: [AdminPermission.READ_USERS], description: 'Admin' }],
            permissions: [AdminPermission.READ_USERS],
            lastLogin: new Date(),
            mfaEnabled: false,
            isActive: true,
            failedLoginAttempts: 4, // One less than max
            createdAt: new Date(),
            updatedAt: new Date()
          };

          // Mock admin lookup
          const originalFindAdmin = (authService as any).findAdminByEmail;
          (authService as any).findAdminByEmail = jest.fn().mockResolvedValue(admin);

          try {
            // This attempt should trigger account lockout
            await expect(
              authService.login({ email, password }, ipAddress, userAgent)
            ).rejects.toThrow(AdminAuthenticationError);

            // Verify the admin's failed attempts were incremented and lockout was set
            expect(admin.failedLoginAttempts).toBe(5);
            expect(admin.lockedUntil).toBeDefined();
            expect(admin.lockedUntil).toBeInstanceOf(Date);
            expect(admin.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

          } finally {
            (authService as any).findAdminByEmail = originalFindAdmin;
          }
        }
      ),
      { numRuns: 15 }
    );
  });

  test('property: security monitoring should record all failed attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 8, maxLength: 20 }),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 50 }),
          attemptCount: fc.integer({ min: 3, max: 8 })
        }),
        async ({ email, password, ipAddress, userAgent, attemptCount }) => {
          // Mock bcrypt to always return false
          mockedBcrypt.compare.mockResolvedValue(false);

          // Mock admin lookup to return valid admin
          const originalFindAdmin = (authService as any).findAdminByEmail;
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

          const securityMonitor = authService.getSecurityMonitor();
          const initialMetrics = securityMonitor.getSecurityMetrics();

          try {
            // Attempt multiple failed logins
            for (let i = 0; i < attemptCount; i++) {
              try {
                await authService.login({ email, password }, ipAddress, userAgent);
              } catch (error) {
                // Expected to fail
              }
            }

            // Check that security monitor recorded the attempts
            const finalMetrics = securityMonitor.getSecurityMetrics();
            const recordedAttempts = finalMetrics.failedLoginAttempts - initialMetrics.failedLoginAttempts;
            
            // Should record at least the attempts that weren't rate limited
            expect(recordedAttempts).toBeGreaterThan(0);
            expect(recordedAttempts).toBeLessThanOrEqual(attemptCount);

          } finally {
            (authService as any).findAdminByEmail = originalFindAdmin;
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('property: different error codes should be returned for different failure types', () => {
    fc.assert(
      fc.property(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 8, maxLength: 20 }),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 50 })
        }),
        async ({ email, password, ipAddress, userAgent }) => {
          // Test different failure scenarios
          const scenarios = [
            {
              name: 'user_not_found',
              mockAdmin: null,
              expectedCode: 'INVALID_CREDENTIALS'
            },
            {
              name: 'account_inactive',
              mockAdmin: {
                id: 'test-admin',
                email,
                passwordHash: 'hashed-password',
                roles: [{ name: 'admin', permissions: [AdminPermission.READ_USERS], description: 'Admin' }],
                permissions: [AdminPermission.READ_USERS],
                lastLogin: new Date(),
                mfaEnabled: false,
                isActive: false, // Inactive account
                failedLoginAttempts: 0,
                createdAt: new Date(),
                updatedAt: new Date()
              },
              expectedCode: 'ACCOUNT_INACTIVE'
            },
            {
              name: 'account_locked',
              mockAdmin: {
                id: 'test-admin',
                email,
                passwordHash: 'hashed-password',
                roles: [{ name: 'admin', permissions: [AdminPermission.READ_USERS], description: 'Admin' }],
                permissions: [AdminPermission.READ_USERS],
                lastLogin: new Date(),
                mfaEnabled: false,
                isActive: true,
                failedLoginAttempts: 5,
                lockedUntil: new Date(Date.now() + 60000), // Locked for 1 minute
                createdAt: new Date(),
                updatedAt: new Date()
              },
              expectedCode: 'ACCOUNT_LOCKED'
            }
          ];

          const originalFindAdmin = (authService as any).findAdminByEmail;

          for (const scenario of scenarios) {
            (authService as any).findAdminByEmail = jest.fn().mockResolvedValue(scenario.mockAdmin);

            try {
              await authService.login({ email, password }, ipAddress, userAgent);
              // Should not reach here
              expect(false).toBe(true);
            } catch (error) {
              expect(error).toBeInstanceOf(AdminAuthenticationError);
              expect((error as AdminAuthenticationError).code).toBe(scenario.expectedCode);
            }
          }

          (authService as any).findAdminByEmail = originalFindAdmin;
        }
      ),
      { numRuns: 5 }
    );
  });

  test('property: IP blocking should prevent all login attempts from blocked IPs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 8, maxLength: 20 }),
          blockedIP: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 50 })
        }),
        async ({ email, password, blockedIP, userAgent }) => {
          // Block the IP address
          const securityMonitor = authService.getSecurityMonitor();
          securityMonitor.blockIP(blockedIP, 'Test block');

          // Mock admin lookup to return valid admin
          const originalFindAdmin = (authService as any).findAdminByEmail;
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

          try {
            // Attempt login from blocked IP
            await expect(
              authService.login({ email, password }, blockedIP, userAgent)
            ).rejects.toThrow(AdminAuthenticationError);

            // Verify it was blocked due to IP
            try {
              await authService.login({ email, password }, blockedIP, userAgent);
            } catch (error) {
              expect(error).toBeInstanceOf(AdminAuthenticationError);
              expect((error as AdminAuthenticationError).code).toBe('IP_BLOCKED');
            }

          } finally {
            (authService as any).findAdminByEmail = originalFindAdmin;
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('property: error messages should be consistent and not leak sensitive information', () => {
    fc.assert(
      fc.property(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 1, maxLength: 50 }),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 50 })
        }),
        async ({ email, password, ipAddress, userAgent }) => {
          // Test that error messages don't reveal whether user exists
          const originalFindAdmin = (authService as any).findAdminByEmail;
          
          // Test with non-existent user
          (authService as any).findAdminByEmail = jest.fn().mockResolvedValue(null);
          
          let nonExistentUserError: AdminAuthenticationError | null = null;
          try {
            await authService.login({ email, password }, ipAddress, userAgent);
          } catch (error) {
            nonExistentUserError = error as AdminAuthenticationError;
          }

          // Test with existing user but wrong password
          mockedBcrypt.compare.mockResolvedValue(false);
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

          let wrongPasswordError: AdminAuthenticationError | null = null;
          try {
            await authService.login({ email, password }, ipAddress, userAgent);
          } catch (error) {
            wrongPasswordError = error as AdminAuthenticationError;
          }

          // Both errors should have the same message to prevent user enumeration
          expect(nonExistentUserError).not.toBeNull();
          expect(wrongPasswordError).not.toBeNull();
          expect(nonExistentUserError!.message).toBe(wrongPasswordError!.message);
          expect(nonExistentUserError!.code).toBe('INVALID_CREDENTIALS');
          expect(wrongPasswordError!.code).toBe('INVALID_CREDENTIALS');

          (authService as any).findAdminByEmail = originalFindAdmin;
        }
      ),
      { numRuns: 15 }
    );
  });
});