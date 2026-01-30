/**
 * Property-based tests for Session Expiration Management
 * **Feature: rwa-lending-protocol, Property 28: Session expiration management**
 * **Validates: Requirements 7.3**
 * 
 * Tests the system's session management capabilities including automatic expiration,
 * cleanup, and secure session handling.
 */

import fc from 'fast-check';
import { AdminAuthService } from '../admin-auth-service';
import { JWTService } from '../jwt-service';
import { AdminSession, AdminPermission } from '@/types/auth';

describe('Session Expiration Management Property Tests', () => {
  let authService: AdminAuthService;

  beforeEach(() => {
    authService = new AdminAuthService();
    // Disable console logging during tests
    (authService as any).auditLogger.config.enableConsoleLogging = false;
  });

  /**
   * **Feature: rwa-lending-protocol, Property 28: Session expiration management**
   * **Validates: Requirements 7.3**
   * 
   * Property: Sessions should automatically expire after the configured timeout
   */
  test('property: sessions should expire after configured timeout', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          adminId: fc.string({ minLength: 5, maxLength: 20 }),
          email: fc.emailAddress(),
          sessionId: fc.string({ minLength: 10, maxLength: 50 }),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 50 }),
          expirationOffset: fc.integer({ min: -60000, max: 60000 }) // -1 to +1 minute from now
        }),
        async ({ adminId, email, sessionId, ipAddress, userAgent, expirationOffset }) => {
          const expiresAt = new Date(Date.now() + expirationOffset);
          
          const session: AdminSession = {
            adminId,
            email,
            roles: [{ name: 'admin', permissions: [AdminPermission.READ_USERS], description: 'Admin' }],
            permissions: [AdminPermission.READ_USERS],
            expiresAt,
            createdAt: new Date(),
            ipAddress,
            userAgent,
            sessionId
          };

          // Manually add session to the service
          const sessionMap = new Map();
          sessionMap.set(sessionId, session);
          (authService as any).activeSessions = sessionMap;

          const validatedSession = await authService.validateSession(sessionId);

          if (expirationOffset > 0) {
            // Session should be valid if it hasn't expired yet
            expect(validatedSession).not.toBeNull();
            expect(validatedSession?.sessionId).toBe(sessionId);
          } else {
            // Session should be invalid if it has expired
            expect(validatedSession).toBeNull();
            // Session should be removed from active sessions
            expect((authService as any).activeSessions.has(sessionId)).toBe(false);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('property: session validation should be consistent across multiple calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          adminId: fc.string({ minLength: 5, maxLength: 20 }),
          email: fc.emailAddress(),
          sessionId: fc.string({ minLength: 10, maxLength: 50 }),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 50 }),
          validationCount: fc.integer({ min: 2, max: 5 })
        }),
        async ({ adminId, email, sessionId, ipAddress, userAgent, validationCount }) => {
          const expiresAt = new Date(Date.now() + 60000); // 1 minute from now
          
          const session: AdminSession = {
            adminId,
            email,
            roles: [{ name: 'admin', permissions: [AdminPermission.READ_USERS], description: 'Admin' }],
            permissions: [AdminPermission.READ_USERS],
            expiresAt,
            createdAt: new Date(),
            ipAddress,
            userAgent,
            sessionId
          };

          // Add session to the service
          const sessionMap = new Map();
          sessionMap.set(sessionId, session);
          (authService as any).activeSessions = sessionMap;

          const validationResults: (AdminSession | null)[] = [];

          // Validate session multiple times
          for (let i = 0; i < validationCount; i++) {
            const result = await authService.validateSession(sessionId);
            validationResults.push(result);
          }

          // All validations should return the same result
          const firstResult = validationResults[0];
          for (const result of validationResults) {
            if (firstResult === null) {
              expect(result).toBeNull();
            } else {
              expect(result).not.toBeNull();
              expect(result?.sessionId).toBe(firstResult.sessionId);
              expect(result?.adminId).toBe(firstResult.adminId);
            }
          }
        }
      ),
      { numRuns: 15 }
    );
  });

  test('property: JWT tokens should have consistent expiration with sessions', () => {
    fc.assert(
      fc.property(
        fc.record({
          adminId: fc.string({ minLength: 5, maxLength: 20 }),
          email: fc.emailAddress(),
          sessionId: fc.string({ minLength: 10, maxLength: 50 }),
          roles: fc.array(fc.constantFrom('admin', 'super_admin'), { minLength: 1, maxLength: 2 }),
          permissions: fc.array(fc.constantFrom(...Object.values(AdminPermission)), { minLength: 1, maxLength: 3 })
        }),
        ({ adminId, email, sessionId, roles, permissions }) => {
          const mockAdmin = {
            id: adminId,
            email,
            passwordHash: 'hashed-password',
            roles: roles.map(role => ({ name: role, permissions, description: role })),
            permissions,
            lastLogin: new Date(),
            mfaEnabled: false,
            isActive: true,
            failedLoginAttempts: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          const token = JWTService.generateAccessToken(mockAdmin, sessionId);
          const payload = JWTService.verifyAccessToken(token);

          // Token should contain session information
          expect(payload.adminId).toBe(adminId);
          expect(payload.email).toBe(email);
          expect(payload.sessionId).toBe(sessionId);
          expect(payload.roles).toEqual(roles);
          expect(payload.permissions).toEqual(permissions);

          // Token should have an expiration time
          expect(payload.exp).toBeDefined();
          expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('property: session cleanup should remove expired sessions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            adminId: fc.string({ minLength: 5, maxLength: 20 }),
            email: fc.emailAddress(),
            sessionId: fc.string({ minLength: 10, maxLength: 50 }),
            ipAddress: fc.ipV4(),
            userAgent: fc.string({ minLength: 10, maxLength: 50 }),
            isExpired: fc.boolean()
          }),
          { minLength: 3, maxLength: 10 }
        ),
        async (sessionConfigs) => {
          const sessionMap = new Map();
          let expiredCount = 0;
          let validCount = 0;

          // Create sessions with different expiration states
          for (const config of sessionConfigs) {
            const expiresAt = config.isExpired 
              ? new Date(Date.now() - 60000) // 1 minute ago (expired)
              : new Date(Date.now() + 60000); // 1 minute from now (valid)

            const session: AdminSession = {
              adminId: config.adminId,
              email: config.email,
              roles: [{ name: 'admin', permissions: [AdminPermission.READ_USERS], description: 'Admin' }],
              permissions: [AdminPermission.READ_USERS],
              expiresAt,
              createdAt: new Date(),
              ipAddress: config.ipAddress,
              userAgent: config.userAgent,
              sessionId: config.sessionId
            };

            sessionMap.set(config.sessionId, session);
            
            if (config.isExpired) {
              expiredCount++;
            } else {
              validCount++;
            }
          }

          // Set sessions in the service
          (authService as any).activeSessions = sessionMap;

          // Validate each session (this should trigger cleanup of expired ones)
          for (const config of sessionConfigs) {
            await authService.validateSession(config.sessionId);
          }

          // Check that expired sessions were removed
          const remainingSessions = (authService as any).activeSessions;
          expect(remainingSessions.size).toBeLessThanOrEqual(validCount);

          // Verify that only valid sessions remain
          for (const [sessionId, session] of remainingSessions.entries()) {
            expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('property: session revocation should immediately invalidate sessions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          adminId: fc.string({ minLength: 5, maxLength: 20 }),
          email: fc.emailAddress(),
          sessionCount: fc.integer({ min: 2, max: 5 }),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 50 })
        }),
        async ({ adminId, email, sessionCount, ipAddress, userAgent }) => {
          const sessionMap = new Map();
          const sessionIds: string[] = [];

          // Create multiple sessions for the same admin
          for (let i = 0; i < sessionCount; i++) {
            const sessionId = `session-${adminId}-${i}`;
            sessionIds.push(sessionId);

            const session: AdminSession = {
              adminId,
              email,
              roles: [{ name: 'admin', permissions: [AdminPermission.READ_USERS], description: 'Admin' }],
              permissions: [AdminPermission.READ_USERS],
              expiresAt: new Date(Date.now() + 60000), // 1 minute from now
              createdAt: new Date(),
              ipAddress,
              userAgent,
              sessionId
            };

            sessionMap.set(sessionId, session);
          }

          // Set sessions in the service
          (authService as any).activeSessions = sessionMap;

          // Verify all sessions are initially valid
          for (const sessionId of sessionIds) {
            const session = await authService.validateSession(sessionId);
            expect(session).not.toBeNull();
          }

          // Revoke all sessions for the admin
          await authService.revokeAllSessions(adminId, ipAddress, userAgent);

          // Verify all sessions are now invalid
          for (const sessionId of sessionIds) {
            const session = await authService.validateSession(sessionId);
            expect(session).toBeNull();
          }

          // Verify sessions were removed from active sessions
          const remainingSessions = (authService as any).activeSessions;
          for (const sessionId of sessionIds) {
            expect(remainingSessions.has(sessionId)).toBe(false);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('property: refresh token should create new session with extended expiration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          adminId: fc.string({ minLength: 5, maxLength: 20 }),
          email: fc.emailAddress(),
          sessionId: fc.string({ minLength: 10, maxLength: 50 }),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 50 })
        }),
        async ({ adminId, email, sessionId, ipAddress, userAgent }) => {
          // Create initial session
          const initialExpiresAt = new Date(Date.now() + 60000); // 1 minute from now
          const session: AdminSession = {
            adminId,
            email,
            roles: [{ name: 'admin', permissions: [AdminPermission.READ_USERS], description: 'Admin' }],
            permissions: [AdminPermission.READ_USERS],
            expiresAt: initialExpiresAt,
            createdAt: new Date(),
            ipAddress,
            userAgent,
            sessionId
          };

          const sessionMap = new Map();
          sessionMap.set(sessionId, session);
          (authService as any).activeSessions = sessionMap;

          // Mock admin lookup for refresh
          const originalFindAdmin = (authService as any).findAdminById;
          (authService as any).findAdminById = jest.fn().mockResolvedValue({
            id: adminId,
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
            // Generate refresh token
            const refreshToken = JWTService.generateRefreshToken(adminId, sessionId);

            // Refresh the token
            const result = await authService.refreshToken(refreshToken, ipAddress, userAgent);

            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();

            // Verify new session was created
            const updatedSessions = (authService as any).activeSessions;
            expect(updatedSessions.size).toBe(1);

            // Old session should be replaced with new one
            expect(updatedSessions.has(sessionId)).toBe(false);

            // New session should have extended expiration
            const newSession = Array.from(updatedSessions.values())[0];
            expect(newSession.expiresAt.getTime()).toBeGreaterThan(initialExpiresAt.getTime());

          } finally {
            (authService as any).findAdminById = originalFindAdmin;
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});