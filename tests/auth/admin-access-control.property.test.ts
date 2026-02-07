/**
 * Property-based tests for Administrative Access Control system
 * **Feature: rwa-lending-protocol, Property 26: Admin access control**
 * **Validates: Requirements 7.1**
 * 
 * Tests the administrative authentication system to ensure only users with verified 
 * administrative privileges are granted access to administrative functions.
 */

import fc from 'fast-check';
import bcrypt from 'bcryptjs';
import { AdminAuthService, AdminAuthenticationError } from '../../src/services/auth/admin-auth-service';
import { JWTService, JWTAuthenticationError } from '../../src/services/auth/jwt-service';
import { AdminUser, AdminRole, AdminPermission, LoginCredentials, AdminSession } from '../../../shared-types/src/entities';

// Mock bcrypt for testing
jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock generators for property-based testing
const adminPermissionArb = fc.constantFrom(...Object.values(AdminPermission));

const adminRoleArb = fc.record({
  name: fc.constantFrom('super_admin', 'admin', 'moderator', 'verifier'),
  permissions: fc.array(adminPermissionArb, { minLength: 1, maxLength: 5 }),
  description: fc.string({ minLength: 5, maxLength: 50 })
});

const adminUserArb = fc.record({
  id: fc.string({ minLength: 5, maxLength: 20 }).map(s => `admin-${s}`),
  email: fc.emailAddress(),
  passwordHash: fc.string({ minLength: 60, maxLength: 60 }), // bcrypt hash length
  roles: fc.array(adminRoleArb, { minLength: 1, maxLength: 3 }),
  permissions: fc.array(adminPermissionArb, { minLength: 1, maxLength: 8 }),
  lastLogin: fc.date(),
  mfaEnabled: fc.boolean(),
  isActive: fc.boolean(),
  failedLoginAttempts: fc.integer({ min: 0, max: 10 }),
  createdAt: fc.date(),
  updatedAt: fc.date()
});

const loginCredentialsArb = fc.record({
  email: fc.emailAddress(),
  password: fc.string({ minLength: 6, maxLength: 50 }),
  mfaToken: fc.option(fc.integer({ min: 100000, max: 999999 }).map(n => n.toString())) // Generate valid 6-digit MFA tokens
});

const sessionArb = fc.record({
  adminId: fc.string({ minLength: 5, maxLength: 20 }),
  email: fc.emailAddress(),
  roles: fc.array(adminRoleArb, { minLength: 1, maxLength: 3 }),
  permissions: fc.array(adminPermissionArb, { minLength: 1, maxLength: 8 }),
  expiresAt: fc.date({ min: new Date(Date.now() + 60000) }), // Future date
  createdAt: fc.date({ max: new Date() }),
  ipAddress: fc.ipV4(),
  userAgent: fc.string({ minLength: 10, maxLength: 100 }),
  sessionId: fc.string({ minLength: 10, maxLength: 50 })
});

describe('Administrative Access Control Property Tests', () => {
  let authService: AdminAuthService;

  beforeEach(() => {
    authService = new AdminAuthService();
    // Create a fresh rate limiter for each test to avoid conflicts
    const { RateLimiter } = require('../rate-limiter');
    const { AuditLogger } = require('../audit-logger');
    
    // Create a mock rate limiter that always allows requests for successful login tests
    const mockRateLimiter = {
      isAllowed: jest.fn().mockReturnValue(true), // Always allow requests in tests
      getRateLimitInfo: jest.fn().mockReturnValue({
        totalHits: 0,
        totalHitsInWindow: 0,
        remainingPoints: 5,
        msBeforeNext: 0,
        isBlocked: false
      }),
      resetAll: jest.fn()
    };
    
    const auditLogger = new AuditLogger();
    
    // Disable console and database logging during tests
    auditLogger.config = {
      enableConsoleLogging: false,
      enableDatabaseLogging: false
    };
    
    (authService as any).rateLimiter = mockRateLimiter;
    (authService as any).auditLogger = auditLogger;
    
    // Create a mock security monitor that doesn't block IPs during testing
    const mockSecurityMonitor = {
      recordLoginAttempt: jest.fn(),
      isIPBlocked: jest.fn().mockReturnValue(false), // Never block IPs in tests
      blockIP: jest.fn(),
      unblockIP: jest.fn(),
      getActiveAlerts: jest.fn().mockReturnValue([]),
      getSecurityMetrics: jest.fn().mockReturnValue({
        totalLoginAttempts: 0,
        failedLoginAttempts: 0,
        successfulLogins: 0,
        blockedIPs: 0,
        activeAlerts: 0,
        accountLockouts: 0,
        suspiciousActivities: 0
      }),
      getBlockedIPs: jest.fn().mockReturnValue([]),
      resetForTesting: jest.fn()
    };
    
    (authService as any).securityMonitor = mockSecurityMonitor;
    
    // Mock bcrypt to always return true for password comparison in successful tests
    mockedBcrypt.compare.mockResolvedValue(true);
  });

  /**
   * **Feature: rwa-lending-protocol, Property 26: Admin access control**
   * **Validates: Requirements 7.1**
   * 
   * Property: Only users with verified administrative privileges should be granted access
   */
  describe('Administrative Privilege Verification', () => {
    test('property: active admin users with valid credentials should always be granted access', async () => {
      await fc.assert(
        fc.asyncProperty(
          adminUserArb.filter(user => user.isActive && user.failedLoginAttempts < 5),
          loginCredentialsArb,
          fc.integer({ min: 1000, max: 9999 }), // Add unique suffix
          async (admin, credentials, uniqueId) => {
            // Make email unique to avoid rate limiting conflicts
            const uniqueEmail = `test${uniqueId}@example.com`;
            
            // Ensure MFA token is provided if MFA is enabled
            const adjustedCredentials = {
              ...credentials,
              email: uniqueEmail,
              mfaToken: admin.mfaEnabled ? (credentials.mfaToken || '123456') : credentials.mfaToken
            };
            
            // Mock the admin lookup to return our test admin
            const originalFindAdmin = (authService as any).findAdminByEmail;
            (authService as any).findAdminByEmail = jest.fn().mockResolvedValue({
              ...admin,
              email: uniqueEmail // Ensure email matches
            });

            try {
              const result = await authService.login(
                adjustedCredentials,
                `192.168.1.${uniqueId % 255}`, // Use unique IP address
                'test-user-agent'
              );

              // Active admin with valid credentials should succeed or require MFA
              expect(result.success || result.requiresMfa).toBe(true);
              
              if (result.success) {
                expect(result.token).toBeDefined();
                expect(result.admin).toBeDefined();
                expect(result.admin?.id).toBe(admin.id);
              }
            } finally {
              // Restore original method
              (authService as any).findAdminByEmail = originalFindAdmin;
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('property: inactive admin users should never be granted access', async () => {
      await fc.assert(
        fc.asyncProperty(
          adminUserArb.filter(user => !user.isActive),
          loginCredentialsArb,
          async (admin, credentials) => {
            const originalFindAdmin = (authService as any).findAdminByEmail;
            (authService as any).findAdminByEmail = jest.fn().mockResolvedValue({
              ...admin,
              email: credentials.email
            });

            try {
              await expect(
                authService.login(credentials, `192.168.2.${Math.floor(Math.random() * 255)}`, 'test-user-agent')
              ).rejects.toThrow(AdminAuthenticationError);
            } finally {
              // Restore original method
              (authService as any).findAdminByEmail = originalFindAdmin;
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('property: locked admin accounts should be denied access', async () => {
      await fc.assert(
        fc.asyncProperty(
          adminUserArb.filter(user => user.isActive),
          loginCredentialsArb,
          async (admin, credentials) => {
            // Set account as locked
            const lockedAdmin = {
              ...admin,
              email: credentials.email,
              lockedUntil: new Date(Date.now() + 60000) // Locked for 1 minute
            };

            const originalFindAdmin = (authService as any).findAdminByEmail;
            (authService as any).findAdminByEmail = jest.fn().mockResolvedValue(lockedAdmin);

            try {
              await expect(
                authService.login(credentials, `192.168.3.${Math.floor(Math.random() * 255)}`, 'test-user-agent')
              ).rejects.toThrow(AdminAuthenticationError);
            } finally {
              (authService as any).findAdminByEmail = originalFindAdmin;
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property: JWT tokens should be valid and contain correct admin information
   */
  describe('JWT Token Validation Properties', () => {
    test('property: generated JWT tokens should always be valid and decodable', () => {
      fc.assert(
        fc.property(
          adminUserArb.filter(user => user.isActive),
          fc.string({ minLength: 10, maxLength: 50 }),
          (admin, sessionId) => {
            const token = JWTService.generateAccessToken(admin, sessionId);
            
            // Token should be valid format
            expect(JWTService.isValidTokenFormat(token)).toBe(true);
            
            // Token should be verifiable
            const payload = JWTService.verifyAccessToken(token);
            
            expect(payload.adminId).toBe(admin.id);
            expect(payload.email).toBe(admin.email);
            expect(payload.sessionId).toBe(sessionId);
            expect(payload.roles).toEqual(admin.roles.map(r => r.name));
            expect(payload.permissions).toEqual(admin.permissions);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('property: malformed tokens should always be rejected', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('.')),
          (invalidToken) => {
            expect(() => {
              JWTService.verifyAccessToken(invalidToken);
            }).toThrow(JWTAuthenticationError);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('property: token format validation should be consistent', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          (tokenString) => {
            const isValid = JWTService.isValidTokenFormat(tokenString);
            const parts = tokenString.split('.');
            
            // Should be valid if and only if it has exactly 3 parts
            expect(isValid).toBe(parts.length === 3);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Session validation should be consistent and secure
   */
  describe('Session Validation Properties', () => {
    test('property: valid sessions should always pass validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          sessionArb,
          async (session) => {
            // Mock the session storage
            const sessionMap = new Map();
            sessionMap.set(session.sessionId, session);
            (authService as any).activeSessions = sessionMap;

            const validatedSession = await authService.validateSession(session.sessionId);
            
            expect(validatedSession).not.toBeNull();
            expect(validatedSession?.adminId).toBe(session.adminId);
            expect(validatedSession?.email).toBe(session.email);
            expect(validatedSession?.sessionId).toBe(session.sessionId);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('property: expired sessions should always be rejected and cleaned up', async () => {
      await fc.assert(
        fc.asyncProperty(
          sessionArb,
          async (session) => {
            // Create expired session
            const expiredSession = {
              ...session,
              expiresAt: new Date(Date.now() - 60000) // 1 minute ago
            };

            const sessionMap = new Map();
            sessionMap.set(expiredSession.sessionId, expiredSession);
            (authService as any).activeSessions = sessionMap;

            const validatedSession = await authService.validateSession(expiredSession.sessionId);
            
            expect(validatedSession).toBeNull();
            // Session should be cleaned up
            expect(sessionMap.has(expiredSession.sessionId)).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('property: non-existent sessions should always return null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 50 }),
          async (randomSessionId) => {
            // Ensure session doesn't exist
            (authService as any).activeSessions = new Map();

            const validatedSession = await authService.validateSession(randomSessionId);
            expect(validatedSession).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property: Permission checking should be consistent and accurate
   */
  describe('Permission Checking Properties', () => {
    test('property: sessions with specific permissions should always pass permission checks', () => {
      fc.assert(
        fc.property(
          sessionArb,
          adminPermissionArb,
          (session, permission) => {
            // Add the permission to the session
            const sessionWithPermission = {
              ...session,
              permissions: [...session.permissions, permission]
            };

            const hasPermission = authService.hasPermission(sessionWithPermission, permission);
            expect(hasPermission).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('property: sessions without specific permissions should always fail permission checks', () => {
      fc.assert(
        fc.property(
          sessionArb,
          adminPermissionArb,
          (session, permission) => {
            // Ensure the permission is not in the session
            const sessionWithoutPermission = {
              ...session,
              permissions: session.permissions.filter(p => p !== permission)
            };

            const hasPermission = authService.hasPermission(sessionWithoutPermission, permission);
            expect(hasPermission).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property: Rate limiting should consistently prevent brute force attacks
   */
  describe('Rate Limiting Properties', () => {
    test('property: multiple failed login attempts should trigger rate limiting', async () => {
      // Create a separate auth service instance for rate limiting tests
      const rateLimitAuthService = new AdminAuthService();
      
      // Set up real rate limiter for this test
      const { RateLimiter } = require('../rate-limiter');
      const { AuditLogger } = require('../audit-logger');
      
      const rateLimiter = new RateLimiter({
        windowMs: 15 * 60 * 1000,
        maxAttempts: 5,
        skipSuccessfulRequests: true
      });
      
      const auditLogger = new AuditLogger();
      auditLogger.config = {
        enableConsoleLogging: false,
        enableDatabaseLogging: false
      };
      
      // Use mock security monitor that doesn't interfere
      const mockSecurityMonitor = {
        recordLoginAttempt: jest.fn(),
        isIPBlocked: jest.fn().mockReturnValue(false),
        blockIP: jest.fn(),
        unblockIP: jest.fn(),
        getActiveAlerts: jest.fn().mockReturnValue([]),
        getSecurityMetrics: jest.fn().mockReturnValue({
          totalLoginAttempts: 0,
          failedLoginAttempts: 0,
          successfulLogins: 0,
          blockedIPs: 0,
          activeAlerts: 0,
          accountLockouts: 0,
          suspiciousActivities: 0
        }),
        getBlockedIPs: jest.fn().mockReturnValue([]),
        resetForTesting: jest.fn()
      };
      
      (rateLimitAuthService as any).rateLimiter = rateLimiter;
      (rateLimitAuthService as any).auditLogger = auditLogger;
      (rateLimitAuthService as any).securityMonitor = mockSecurityMonitor;

      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.ipV4(),
          fc.integer({ min: 6, max: 20 }), // More than the limit of 5
          async (email, ipAddress, attemptCount) => {
            const credentials = { email, password: 'wrong-password' };
            
            // Mock admin lookup to return null (user not found)
            const originalFindAdmin = (rateLimitAuthService as any).findAdminByEmail;
            (rateLimitAuthService as any).findAdminByEmail = jest.fn().mockResolvedValue(null);

            try {
              let rateLimitHit = false;
              
              for (let i = 0; i < attemptCount; i++) {
                try {
                  await rateLimitAuthService.login(credentials, ipAddress, 'test-agent');
                } catch (error) {
                  if (error instanceof AdminAuthenticationError && error.code === 'RATE_LIMITED') {
                    rateLimitHit = true;
                    break;
                  }
                }
              }
              
              // Should hit rate limit before completing all attempts
              expect(rateLimitHit).toBe(true);
            } finally {
              (rateLimitAuthService as any).findAdminByEmail = originalFindAdmin;
              // Reset rate limiter for next test
              rateLimiter.resetAll();
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property: Session cleanup should maintain system integrity
   */
  describe('Session Cleanup Properties', () => {
    test('property: session revocation should remove all sessions for target admin', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }),
          fc.array(sessionArb, { minLength: 2, maxLength: 5 }),
          async (targetAdminId, sessions) => {
            // Set some sessions to belong to target admin
            const targetSessions = sessions.map((session, index) => ({
              ...session,
              adminId: index < 2 ? targetAdminId : session.adminId
            }));

            const sessionMap = new Map();
            targetSessions.forEach(session => {
              sessionMap.set(session.sessionId, session);
            });
            (authService as any).activeSessions = sessionMap;

            await authService.revokeAllSessions(targetAdminId, `192.168.4.${Math.floor(Math.random() * 255)}`, 'test-agent');

            // No sessions should remain for the target admin
            const remainingSessions = Array.from(sessionMap.values());
            const targetAdminSessions = remainingSessions.filter(s => s.adminId === targetAdminId);
            
            expect(targetAdminSessions).toHaveLength(0);
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  /**
   * Property: Authentication state transitions should be consistent
   */
  describe('Authentication State Transition Properties', () => {
    test('property: successful login should create valid session state', async () => {
      await fc.assert(
        fc.asyncProperty(
          adminUserArb.filter(user => user.isActive && user.failedLoginAttempts < 5),
          loginCredentialsArb,
          fc.integer({ min: 1000, max: 9999 }), // Add unique suffix
          async (admin, credentials, uniqueId) => {
            // Make email unique to avoid rate limiting conflicts
            const uniqueEmail = `test${uniqueId}@example.com`;
            
            // Ensure MFA token is provided if MFA is enabled
            const adjustedCredentials = {
              ...credentials,
              email: uniqueEmail,
              mfaToken: admin.mfaEnabled ? (credentials.mfaToken || '123456') : credentials.mfaToken
            };
            
            // Mock successful login
            const originalFindAdmin = (authService as any).findAdminByEmail;
            (authService as any).findAdminByEmail = jest.fn().mockResolvedValue({
              ...admin,
              email: uniqueEmail
            });

            try {
              const loginResult = await authService.login(
                adjustedCredentials,
                `192.168.5.${uniqueId % 255}`,
                'test-user-agent'
              );

              if (loginResult.success) {
                // Should have valid token
                expect(loginResult.token).toBeDefined();
                expect(loginResult.refreshToken).toBeDefined();
                expect(loginResult.admin).toBeDefined();
                
                // Token should be verifiable
                const payload = JWTService.verifyAccessToken(loginResult.token!);
                expect(payload.adminId).toBe(admin.id);
                
                // Session should exist and be valid
                const session = await authService.validateSession(payload.sessionId);
                expect(session).not.toBeNull();
                expect(session?.adminId).toBe(admin.id);
              }
            } finally {
              (authService as any).findAdminByEmail = originalFindAdmin;
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    test('property: logout should clean up all session state', async () => {
      await fc.assert(
        fc.asyncProperty(
          sessionArb,
          async (session) => {
            // Set up session
            const sessionMap = new Map();
            sessionMap.set(session.sessionId, session);
            (authService as any).activeSessions = sessionMap;

            // Verify session exists
            const beforeLogout = await authService.validateSession(session.sessionId);
            expect(beforeLogout).not.toBeNull();

            // Logout
            await authService.logout(session.sessionId, `192.168.6.${Math.floor(Math.random() * 255)}`, 'test-agent');

            // Session should be gone
            const afterLogout = await authService.validateSession(session.sessionId);
            expect(afterLogout).toBeNull();
            expect(sessionMap.has(session.sessionId)).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

/**
 * Integration property tests for complete authentication flows
 */
describe('Authentication Flow Integration Properties', () => {
  let authService: AdminAuthService;

  beforeEach(() => {
    authService = new AdminAuthService();
    
    // Create fresh instances for each test
    const { RateLimiter } = require('../rate-limiter');
    const { AuditLogger } = require('../audit-logger');
    
    // Create a mock rate limiter that always allows requests for successful login tests
    const mockRateLimiter = {
      isAllowed: jest.fn().mockReturnValue(true), // Always allow requests in tests
      getRateLimitInfo: jest.fn().mockReturnValue({
        totalHits: 0,
        totalHitsInWindow: 0,
        remainingPoints: 5,
        msBeforeNext: 0,
        isBlocked: false
      }),
      resetAll: jest.fn()
    };
    
    const auditLogger = new AuditLogger();
    auditLogger.config = {
      enableConsoleLogging: false,
      enableDatabaseLogging: false
    };
    
    (authService as any).rateLimiter = mockRateLimiter;
    (authService as any).auditLogger = auditLogger;
    
    // Create a mock security monitor that doesn't block IPs during testing
    const mockSecurityMonitor = {
      recordLoginAttempt: jest.fn(),
      isIPBlocked: jest.fn().mockReturnValue(false), // Never block IPs in tests
      blockIP: jest.fn(),
      unblockIP: jest.fn(),
      getActiveAlerts: jest.fn().mockReturnValue([]),
      getSecurityMetrics: jest.fn().mockReturnValue({
        totalLoginAttempts: 0,
        failedLoginAttempts: 0,
        successfulLogins: 0,
        blockedIPs: 0,
        activeAlerts: 0,
        accountLockouts: 0,
        suspiciousActivities: 0
      }),
      getBlockedIPs: jest.fn().mockReturnValue([]),
      resetForTesting: jest.fn()
    };
    
    (authService as any).securityMonitor = mockSecurityMonitor;
    
    // Mock bcrypt to always return true for password comparison in successful tests
    mockedBcrypt.compare.mockResolvedValue(true);
  });

  test('property: complete login-logout cycle should be consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        adminUserArb.filter(user => user.isActive && user.failedLoginAttempts < 5),
        loginCredentialsArb,
        fc.integer({ min: 1000, max: 9999 }), // Add unique suffix
        async (admin, credentials, uniqueId) => {
          // Make email unique to avoid rate limiting conflicts
          const uniqueEmail = `test${uniqueId}@example.com`;
          
          // Ensure MFA token is provided if MFA is enabled
          const adjustedCredentials = {
            ...credentials,
            email: uniqueEmail,
            mfaToken: admin.mfaEnabled ? (credentials.mfaToken || '123456') : credentials.mfaToken
          };
          
          // Mock successful login
          const originalFindAdmin = (authService as any).findAdminByEmail;
          (authService as any).findAdminByEmail = jest.fn().mockResolvedValue({
            ...admin,
            email: uniqueEmail
          });

          try {
            const loginResult = await authService.login(
              adjustedCredentials,
              `192.168.7.${uniqueId % 255}`,
              'test-user-agent'
            );

            if (loginResult.success) {
              const sessionId = JWTService.verifyAccessToken(loginResult.token!).sessionId;
              
              // Session should exist
              const session = await authService.validateSession(sessionId);
              expect(session).not.toBeNull();
              
              // Logout should clean up session
              await authService.logout(sessionId, `192.168.8.${uniqueId % 255}`, 'test-user-agent');
              
              // Session should no longer exist
              const sessionAfterLogout = await authService.validateSession(sessionId);
              expect(sessionAfterLogout).toBeNull();
            }
          } finally {
            (authService as any).findAdminByEmail = originalFindAdmin;
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('property: token refresh should maintain session continuity', async () => {
    await fc.assert(
      fc.asyncProperty(
        adminUserArb.filter(user => user.isActive),
        fc.string({ minLength: 10, maxLength: 50 }),
        async (admin, sessionId) => {
          // Create initial session
          const session = {
            adminId: admin.id,
            email: admin.email,
            roles: admin.roles,
            permissions: admin.permissions,
            expiresAt: new Date(Date.now() + 900000), // 15 minutes
            createdAt: new Date(),
            ipAddress: `192.168.9.${Math.floor(Math.random() * 255)}`,
            userAgent: 'test-agent',
            sessionId
          };

          const sessionMap = new Map();
          sessionMap.set(sessionId, session);
          (authService as any).activeSessions = sessionMap;

          // Mock admin lookup for refresh
          const originalFindAdmin = (authService as any).findAdminById;
          (authService as any).findAdminById = jest.fn().mockResolvedValue(admin);

          try {
            const refreshToken = JWTService.generateRefreshToken(admin.id, sessionId);
            const tokens = await authService.refreshToken(refreshToken, `192.168.10.${Math.floor(Math.random() * 255)}`, 'test-agent');

            // Should get new tokens
            expect(tokens.accessToken).toBeDefined();
            expect(tokens.refreshToken).toBeDefined();

            // New tokens should be different from old ones
            expect(tokens.accessToken).not.toBe(refreshToken);
            expect(tokens.refreshToken).not.toBe(refreshToken);

            // New access token should be valid
            const newPayload = JWTService.verifyAccessToken(tokens.accessToken);
            expect(newPayload.adminId).toBe(admin.id);
          } finally {
            (authService as any).findAdminById = originalFindAdmin;
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});