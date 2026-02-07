/**
 * Property-based tests for Rate Limiting Failed Logins
 * **Feature: rwa-lending-protocol, Property 30: Rate limiting for failed logins**
 * **Validates: Requirements 7.5**
 * 
 * Tests the rate limiting system's ability to prevent brute force attacks
 * by limiting failed login attempts within specified time windows.
 */

import fc from 'fast-check';
import { RateLimiter, RateLimiterPresets } from '../../src/services/auth/rate-limiter';
import { AdminAuthService } from '../../src/services/auth/admin-auth-service';
import { SecurityMonitor } from '../../src/services/auth/security-monitor';
import { AuditLogger } from '../../src/services/auth/audit-logger';

describe('Rate Limiting Failed Logins Property Tests', () => {
  let rateLimiter: RateLimiter;
  let authService: AdminAuthService;

  beforeEach(() => {
    rateLimiter = RateLimiterPresets.createLoginLimiter();
    authService = new AdminAuthService();
    // Disable console and database logging during tests
    (authService as any).auditLogger.config.enableConsoleLogging = false;
    (authService as any).auditLogger.config.enableDatabaseLogging = false;
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  /**
   * **Feature: rwa-lending-protocol, Property 30: Rate limiting for failed logins**
   * **Validates: Requirements 7.5**
   * 
   * Property: Rate limiter should block requests after exceeding the configured limit
   */
  test('property: rate limiter should block after exceeding configured attempts', () => {
    fc.assert(
      fc.property(
        fc.record({
          key: fc.string({ minLength: 5, maxLength: 20 }),
          maxAttempts: fc.integer({ min: 3, max: 10 }),
          windowMs: fc.integer({ min: 60000, max: 300000 }), // 1-5 minutes
          attemptCount: fc.integer({ min: 1, max: 20 })
        }),
        ({ key, maxAttempts, windowMs, attemptCount }) => {
          const testLimiter = new RateLimiter({ maxAttempts, windowMs });
          
          let allowedCount = 0;
          let blockedCount = 0;

          // Make attempts
          for (let i = 0; i < attemptCount; i++) {
            if (testLimiter.isAllowed(key, false)) { // false = failed attempt
              allowedCount++;
            } else {
              blockedCount++;
            }
          }

          // Verify rate limiting behavior
          if (attemptCount <= maxAttempts) {
            expect(allowedCount).toBe(attemptCount);
            expect(blockedCount).toBe(0);
          } else {
            expect(allowedCount).toBe(maxAttempts);
            expect(blockedCount).toBe(attemptCount - maxAttempts);
          }

          testLimiter.destroy();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('property: rate limiter should provide accurate rate limit information', () => {
    fc.assert(
      fc.property(
        fc.record({
          key: fc.string({ minLength: 5, maxLength: 20 }),
          maxAttempts: fc.integer({ min: 3, max: 10 }),
          windowMs: fc.integer({ min: 60000, max: 300000 }),
          currentAttempts: fc.integer({ min: 0, max: 15 })
        }),
        ({ key, maxAttempts, windowMs, currentAttempts }) => {
          const testLimiter = new RateLimiter({ maxAttempts, windowMs });

          // Make the specified number of attempts
          for (let i = 0; i < currentAttempts; i++) {
            testLimiter.isAllowed(key, false);
          }

          const rateLimitInfo = testLimiter.getRateLimitInfo(key);

          // Verify rate limit information accuracy
          expect(rateLimitInfo.totalHitsInWindow).toBeLessThanOrEqual(Math.min(currentAttempts, maxAttempts));
          expect(rateLimitInfo.remainingPoints).toBe(Math.max(0, maxAttempts - rateLimitInfo.totalHitsInWindow));
          expect(rateLimitInfo.isBlocked).toBe(currentAttempts >= maxAttempts);

          if (rateLimitInfo.isBlocked) {
            expect(rateLimitInfo.remainingPoints).toBe(0);
            expect(rateLimitInfo.msBeforeNext).toBeGreaterThan(0);
          } else {
            expect(rateLimitInfo.remainingPoints).toBeGreaterThan(0);
          }

          testLimiter.destroy();
        }
      ),
      { numRuns: 15 }
    );
  });

  test('property: rate limiter should reset after time window expires', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          key: fc.string({ minLength: 5, maxLength: 20 }),
          maxAttempts: fc.integer({ min: 2, max: 5 }),
          windowMs: fc.integer({ min: 100, max: 500 }) // Short window for testing
        }),
        async ({ key, maxAttempts, windowMs }) => {
          const testLimiter = new RateLimiter({ maxAttempts, windowMs });

          // Exhaust the rate limit
          for (let i = 0; i < maxAttempts; i++) {
            expect(testLimiter.isAllowed(key, false)).toBe(true);
          }

          // Next attempt should be blocked
          expect(testLimiter.isAllowed(key, false)).toBe(false);

          // Wait for window to expire
          await new Promise(resolve => setTimeout(resolve, windowMs + 50));

          // Should be allowed again after window expires
          expect(testLimiter.isAllowed(key, false)).toBe(true);

          testLimiter.destroy();
        }
      ),
      { numRuns: 10, timeout: 10000 }
    );
  });

  test('property: different keys should have independent rate limits', () => {
    fc.assert(
      fc.property(
        fc.record({
          keys: fc.array(fc.string({ minLength: 5, maxLength: 20 }), { minLength: 2, maxLength: 5 }),
          maxAttempts: fc.integer({ min: 3, max: 8 }),
          windowMs: fc.integer({ min: 60000, max: 300000 }),
          attemptsPerKey: fc.integer({ min: 1, max: 10 })
        }),
        ({ keys, maxAttempts, windowMs, attemptsPerKey }) => {
          const uniqueKeys = [...new Set(keys)]; // Remove duplicates
          if (uniqueKeys.length < 2) return; // Skip if not enough unique keys

          const testLimiter = new RateLimiter({ maxAttempts, windowMs });

          // Make attempts for each key
          const results = new Map<string, { allowed: number; blocked: number }>();
          
          for (const key of uniqueKeys) {
            let allowed = 0;
            let blocked = 0;

            for (let i = 0; i < attemptsPerKey; i++) {
              if (testLimiter.isAllowed(key, false)) {
                allowed++;
              } else {
                blocked++;
              }
            }

            results.set(key, { allowed, blocked });
          }

          // Verify each key has independent limits
          for (const [key, result] of results.entries()) {
            if (attemptsPerKey <= maxAttempts) {
              expect(result.allowed).toBe(attemptsPerKey);
              expect(result.blocked).toBe(0);
            } else {
              expect(result.allowed).toBe(maxAttempts);
              expect(result.blocked).toBe(attemptsPerKey - maxAttempts);
            }
          }

          testLimiter.destroy();
        }
      ),
      { numRuns: 15 }
    );
  });

  test('property: security monitor should detect brute force patterns', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 50 }),
          failedAttempts: fc.integer({ min: 10, max: 15 }) // Above brute force threshold (10)
        }),
        async ({ email, ipAddress, userAgent, failedAttempts }) => {
          const auditLogger = new AuditLogger({ 
            enableConsoleLogging: false,
            enableDatabaseLogging: false
          });
          const testRateLimiter = new RateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 });
          const securityMonitor = new SecurityMonitor(auditLogger, testRateLimiter);

          const initialAlerts = securityMonitor.getActiveAlerts().length;

          // Record multiple failed login attempts
          for (let i = 0; i < failedAttempts; i++) {
            securityMonitor.recordLoginAttempt(
              email,
              ipAddress,
              userAgent,
              false, // failed attempt
              { reason: 'invalid_credentials', attempt: i + 1 }
            );
          }

          const finalAlerts = securityMonitor.getActiveAlerts();
          const newAlerts = finalAlerts.length - initialAlerts;

          // Should generate security alerts for brute force attempts
          expect(newAlerts).toBeGreaterThan(0);

          // Check for brute force alert
          const bruteForceAlert = finalAlerts.find(alert => 
            alert.type === 'BRUTE_FORCE' && 
            alert.adminEmail === email &&
            alert.ipAddress === ipAddress
          );

          if (failedAttempts >= 10) { // Brute force threshold
            expect(bruteForceAlert).toBeDefined();
            expect(bruteForceAlert!.severity).toBe('CRITICAL');
          }

          testRateLimiter.destroy();
        }
      ),
      { numRuns: 10 }
    );
  });

  test('property: authentication service should respect rate limits', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 8, maxLength: 20 }),
          ipAddress: fc.ipV4(),
          userAgent: fc.string({ minLength: 10, maxLength: 50 }),
          attemptCount: fc.integer({ min: 6, max: 12 }) // More than rate limit
        }),
        async ({ email, password, ipAddress, userAgent, attemptCount }) => {
          // Mock admin lookup to return null (user not found)
          const originalFindAdmin = (authService as any).findAdminByEmail;
          (authService as any).findAdminByEmail = jest.fn().mockResolvedValue(null);

          let rateLimitedErrors = 0;
          let invalidCredentialErrors = 0;

          try {
            for (let i = 0; i < attemptCount; i++) {
              try {
                await authService.login({ email, password }, ipAddress, userAgent);
              } catch (error: any) {
                if (error.code === 'RATE_LIMITED') {
                  rateLimitedErrors++;
                } else if (error.code === 'INVALID_CREDENTIALS') {
                  invalidCredentialErrors++;
                }
              }
            }

            // Should have some rate limited errors after exceeding limit
            expect(rateLimitedErrors).toBeGreaterThan(0);
            
            // Total errors should equal attempt count
            expect(rateLimitedErrors + invalidCredentialErrors).toBe(attemptCount);
            
            // Should not have more than 5 invalid credential errors (rate limit)
            expect(invalidCredentialErrors).toBeLessThanOrEqual(5);

          } finally {
            (authService as any).findAdminByEmail = originalFindAdmin;
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('property: rate limiter statistics should be accurate', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            key: fc.string({ minLength: 5, maxLength: 20 }),
            attempts: fc.integer({ min: 1, max: 8 })
          }),
          { minLength: 2, maxLength: 8 }
        ),
        fc.integer({ min: 3, max: 6 }),
        (keyAttempts, maxAttempts) => {
          const testLimiter = new RateLimiter({ 
            maxAttempts, 
            windowMs: 60000 // 1 minute
          });

          let totalExpectedAttempts = 0;
          let expectedBlockedKeys = 0;

          // Make attempts for each key
          for (const { key, attempts } of keyAttempts) {
            for (let i = 0; i < attempts; i++) {
              testLimiter.isAllowed(key, false);
            }

            totalExpectedAttempts += Math.min(attempts, maxAttempts);
            if (attempts >= maxAttempts) {
              expectedBlockedKeys++;
            }
          }

          const stats = testLimiter.getStats();
          const uniqueKeys = new Set(keyAttempts.map(ka => ka.key));

          expect(stats.totalKeys).toBe(uniqueKeys.size);
          expect(stats.totalAttempts).toBe(totalExpectedAttempts);
          expect(stats.blockedKeys).toBe(expectedBlockedKeys);

          testLimiter.destroy();
        }
      ),
      { numRuns: 15 }
    );
  });

  test('property: successful requests should not count against rate limit when configured', () => {
    fc.assert(
      fc.property(
        fc.record({
          key: fc.string({ minLength: 5, maxLength: 20 }),
          successfulAttempts: fc.integer({ min: 1, max: 10 }),
          failedAttempts: fc.integer({ min: 1, max: 8 }),
          maxAttempts: fc.integer({ min: 3, max: 6 })
        }),
        ({ key, successfulAttempts, failedAttempts, maxAttempts }) => {
          const testLimiter = new RateLimiter({ 
            maxAttempts, 
            windowMs: 60000,
            skipSuccessfulRequests: true
          });

          // Make successful attempts (should not count)
          for (let i = 0; i < successfulAttempts; i++) {
            expect(testLimiter.isAllowed(key, true)).toBe(true);
          }

          // Make failed attempts (should count)
          let allowedFailed = 0;
          let blockedFailed = 0;

          for (let i = 0; i < failedAttempts; i++) {
            if (testLimiter.isAllowed(key, false)) {
              allowedFailed++;
            } else {
              blockedFailed++;
            }
          }

          // Only failed attempts should count against the limit
          if (failedAttempts <= maxAttempts) {
            expect(allowedFailed).toBe(failedAttempts);
            expect(blockedFailed).toBe(0);
          } else {
            expect(allowedFailed).toBe(maxAttempts);
            expect(blockedFailed).toBe(failedAttempts - maxAttempts);
          }

          testLimiter.destroy();
        }
      ),
      { numRuns: 15 }
    );
  });
});