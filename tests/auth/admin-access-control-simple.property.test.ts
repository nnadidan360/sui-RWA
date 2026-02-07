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
import { AdminUser, AdminRole, AdminPermission, AdminSession } from '../../../shared-types/src/entities';

// Mock bcrypt for testing
jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('Administrative Access Control Property Tests', () => {
  let authService: AdminAuthService;

  beforeEach(() => {
    authService = new AdminAuthService();
    // Disable rate limiting for property tests
    (authService as any).rateLimiter = {
      isAllowed: () => true,
      getRateLimitInfo: () => ({ isBlocked: false }),
      reset: () => {},
      resetAll: () => {}
    };
    // Disable console logging during tests
    (authService as any).auditLogger.config.enableConsoleLogging = false;
    
    // Mock bcrypt to always return true for password comparison in successful tests
    mockedBcrypt.compare.mockResolvedValue(true);
  });

  /**
   * **Feature: rwa-lending-protocol, Property 26: Admin access control**
   * **Validates: Requirements 7.1**
   * 
   * Property: Only users with verified administrative privileges should be granted access
   */
  test('property: active admin users with valid credentials should always be granted access', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 5, maxLength: 20 }).map(s => `admin-${s}`),
          email: fc.emailAddress(),
          passwordHash: fc.string({ minLength: 60, maxLength: 60 }),
          roles: fc.array(fc.record({
            name: fc.constantFrom('super_admin', 'admin'),
            permissions: fc.array(fc.constantFrom(...Object.values(AdminPermission)), { minLength: 1, maxLength: 3 }),
            description: fc.string({ minLength: 5, maxLength: 20 })
          }), { minLength: 1, maxLength: 2 }),
          permissions: fc.array(fc.constantFrom(...Object.values(AdminPermission)), { minLength: 1, maxLength: 5 }),
          lastLogin: fc.date(),
          mfaEnabled: fc.boolean(),
          isActive: fc.constant(true), // Always active for this test
          failedLoginAttempts: fc.constant(0), // No failed attempts
          createdAt: fc.date(),
          updatedAt: fc.date()
        }),
        fc.integer({ min: 1000, max: 9999 }),
        async (admin, uniqueId) => {
          const uniqueEmail = `test${uniqueId}@example.com`;
          const credentials = { email: uniqueEmail, password: 'test123' };
          
          // Mock the admin lookup to return our test admin
          const originalFindAdmin = (authService as any).findAdminByEmail;
          (authService as any).findAdminByEmail = jest.fn().mockResolvedValue({
            ...admin,
            email: uniqueEmail
          });

          try {
            const result = await authService.login(
              credentials,
              '127.0.0.1',
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
            (authService as any).findAdminByEmail = originalFindAdmin;
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('property: inactive admin users should never be granted access', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 5, maxLength: 20 }).map(s => `admin-${s}`),
          email: fc.emailAddress(),
          passwordHash: fc.string({ minLength: 60, maxLength: 60 }),
          roles: fc.array(fc.record({
            name: fc.constantFrom('admin'),
            permissions: fc.array(fc.constantFrom(...Object.values(AdminPermission)), { minLength: 1, maxLength: 3 }),
            description: fc.string({ minLength: 5, maxLength: 20 })
          }), { minLength: 1, maxLength: 1 }),
          permissions: fc.array(fc.constantFrom(...Object.values(AdminPermission)), { minLength: 1, maxLength: 3 }),
          lastLogin: fc.date(),
          mfaEnabled: fc.boolean(),
          isActive: fc.constant(false), // Always inactive for this test
          failedLoginAttempts: fc.integer({ min: 0, max: 3 }),
          createdAt: fc.date(),
          updatedAt: fc.date()
        }),
        fc.integer({ min: 1000, max: 9999 }),
        async (admin, uniqueId) => {
          const uniqueEmail = `test${uniqueId}@example.com`;
          const credentials = { email: uniqueEmail, password: 'test123' };
          
          // Mock the admin lookup to return our inactive test admin
          const originalFindAdmin = (authService as any).findAdminByEmail;
          (authService as any).findAdminByEmail = jest.fn().mockResolvedValue({
            ...admin,
            email: uniqueEmail
          });

          try {
            await expect(
              authService.login(credentials, '127.0.0.1', 'test-user-agent')
            ).rejects.toThrow(AdminAuthenticationError);
          } finally {
            (authService as any).findAdminByEmail = originalFindAdmin;
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('property: JWT tokens should be valid and contain correct admin information', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 5, maxLength: 20 }).map(s => `admin-${s}`),
          email: fc.emailAddress(),
          passwordHash: fc.string({ minLength: 60, maxLength: 60 }),
          roles: fc.array(fc.record({
            name: fc.constantFrom('super_admin', 'admin'),
            permissions: fc.array(fc.constantFrom(...Object.values(AdminPermission)), { minLength: 1, maxLength: 3 }),
            description: fc.string({ minLength: 5, maxLength: 20 })
          }), { minLength: 1, maxLength: 2 }),
          permissions: fc.array(fc.constantFrom(...Object.values(AdminPermission)), { minLength: 1, maxLength: 5 }),
          lastLogin: fc.date(),
          mfaEnabled: fc.boolean(),
          isActive: fc.constant(true),
          failedLoginAttempts: fc.constant(0),
          createdAt: fc.date(),
          updatedAt: fc.date()
        }),
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
      { numRuns: 25 }
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
      { numRuns: 20 }
    );
  });

  test('property: session validation should be consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          adminId: fc.string({ minLength: 5, maxLength: 20 }),
          email: fc.emailAddress(),
          roles: fc.array(fc.record({
            name: fc.constantFrom('admin'),
            permissions: fc.array(fc.constantFrom(...Object.values(AdminPermission)), { minLength: 1, maxLength: 3 }),
            description: fc.string({ minLength: 5, maxLength: 20 })
          }), { minLength: 1, maxLength: 1 }),
          permissions: fc.array(fc.constantFrom(...Object.values(AdminPermission)), { minLength: 1, maxLength: 3 }),
          expiresAt: fc.date({ min: new Date(Date.now() + 60000) }), // Future date
          createdAt: fc.date({ max: new Date() }),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 50 }),
          sessionId: fc.string({ minLength: 10, maxLength: 50 })
        }),
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
      { numRuns: 15 }
    );
  });

  test('property: permission checking should be accurate', () => {
    fc.assert(
      fc.property(
        fc.record({
          adminId: fc.string({ minLength: 5, maxLength: 20 }),
          email: fc.emailAddress(),
          roles: fc.array(fc.record({
            name: fc.constantFrom('admin'),
            permissions: fc.array(fc.constantFrom(...Object.values(AdminPermission)), { minLength: 1, maxLength: 3 }),
            description: fc.string({ minLength: 5, maxLength: 20 })
          }), { minLength: 1, maxLength: 1 }),
          permissions: fc.array(fc.constantFrom(...Object.values(AdminPermission)), { minLength: 1, maxLength: 3 }),
          expiresAt: fc.date({ min: new Date(Date.now() + 60000) }),
          createdAt: fc.date({ max: new Date() }),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 50 }),
          sessionId: fc.string({ minLength: 10, maxLength: 50 })
        }),
        fc.constantFrom(...Object.values(AdminPermission)),
        (session, permission) => {
          // Add the permission to the session
          const sessionWithPermission = {
            ...session,
            permissions: [...session.permissions, permission]
          };

          const hasPermission = authService.hasPermission(sessionWithPermission, permission);
          expect(hasPermission).toBe(true);

          // Remove the permission from the session
          const sessionWithoutPermission = {
            ...session,
            permissions: session.permissions.filter(p => p !== permission)
          };

          const lacksPermission = authService.hasPermission(sessionWithoutPermission, permission);
          expect(lacksPermission).toBe(false);
        }
      ),
      { numRuns: 25 }
    );
  });
});