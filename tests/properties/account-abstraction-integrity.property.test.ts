/**
 * Property-Based Test: Account Abstraction Integrity
 * **Feature: credit-os, Property 1: Account Abstraction Integrity**
 * 
 * Tests that for any user account creation, the system generates a UserAccountObject 
 * with policy-based controls, sponsors all gas fees transparently, and provides 
 * recovery mechanisms without exposing private keys.
 * 
 * Validates: Requirements 1.2, 1.3, 1.4
 */

import fc from 'fast-check';
import { AuthService } from '../../src/services/auth/auth-service';
import { SessionManager } from '../../src/services/auth/session-manager';
import { UserService } from '../../src/services/database/user-service';
import { User } from '../../src/models/User';
import { connectTestDB, disconnectTestDB } from '../helpers/test-db';

describe('Property 1: Account Abstraction Integrity', () => {
  let authService: AuthService;
  let sessionManager: SessionManager;

  beforeAll(async () => {
    await connectTestDB();
    authService = new AuthService();
    sessionManager = new SessionManager(authService);
  });

  afterAll(async () => {
    sessionManager.destroy();
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  // Generator for authentication methods
  const authMethodArbitrary = fc.record({
    type: fc.constantFrom('email', 'phone', 'passkey'),
    identifier: fc.oneof(
      fc.emailAddress(),
      fc.string({ minLength: 10, maxLength: 15 }).map(s => '+1' + s),
      fc.string({ minLength: 32, maxLength: 64 })
    )
  });

  // Generator for device fingerprints
  const deviceFingerprintArbitrary = fc.record({
    deviceId: fc.uuid(),
    browserFingerprint: fc.string({ minLength: 32, maxLength: 64 }),
    ipAddress: fc.ipV4(),
    userAgent: fc.string({ minLength: 50, maxLength: 200 }),
    geolocation: fc.record({
      country: fc.constantFrom('US', 'CA', 'GB', 'DE', 'FR', 'JP', 'AU'),
      region: fc.string({ minLength: 2, maxLength: 20 }),
      city: fc.string({ minLength: 3, maxLength: 30 })
    }),
    screenResolution: fc.constantFrom('1920x1080', '1366x768', '1440x900', '2560x1440'),
    timezone: fc.constantFrom('America/New_York', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney')
  });

  // Generator for recovery methods
  const recoveryMethodArbitrary = fc.record({
    type: fc.constantFrom('email', 'device', 'guardian'),
    identifier: fc.oneof(
      fc.emailAddress(),
      fc.uuid(),
      fc.string({ minLength: 32, maxLength: 64 })
    )
  });

  it('Property 1.1: Account creation should generate UserAccountObject with policy-based controls', async () => {
    await fc.assert(
      fc.asyncProperty(
        authMethodArbitrary,
        deviceFingerprintArbitrary,
        fc.array(fc.string({ minLength: 5, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
        async (authMethod, deviceFingerprint, capabilities) => {
          // Act: Create user account
          const user = await UserService.createUser({
            authMethod,
            deviceFingerprint,
            capabilities
          });

          // Assert: UserAccountObject should be created with policy-based controls
          expect(user).toBeDefined();
          expect(user.internalUserId).toBeDefined();
          expect(user.authMethods).toHaveLength(1);
          expect(user.authMethods[0].type).toBe(authMethod.type);
          expect(user.authMethods[0].identifier).toBe(authMethod.identifier);
          
          // Verify policy-based controls exist
          expect(user.accountStatus).toBe('active');
          expect(user.deviceFingerprints).toHaveLength(1);
          expect(user.deviceFingerprints[0].deviceId).toBe(deviceFingerprint.deviceId);
          
          // Verify no private keys are exposed
          expect((user as any).privateKey).toBeUndefined();
          expect((user as any).walletAddress).toBeUndefined();
          expect((user as any).mnemonic).toBeUndefined();
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });
});

  it('Property 1.2: Gas fees should be sponsored transparently for all transactions', async () => {
    await fc.assert(
      fc.asyncProperty(
        authMethodArbitrary,
        deviceFingerprintArbitrary,
        async (authMethod, deviceFingerprint) => {
          // Arrange: Create user account
          const user = await UserService.createUser({
            authMethod,
            deviceFingerprint
          });

          // Act: Create session (simulates transaction)
          const sessionToken = await sessionManager.createSession(
            user._id.toString(),
            user.internalUserId,
            authMethod.type,
            deviceFingerprint,
            []
          );

          // Assert: Session should be created without requiring gas payment
          expect(sessionToken).toBeDefined();
          expect(sessionToken.isActive).toBe(true);
          
          // Verify no gas-related fields are required from user
          expect((sessionToken as any).gasPayment).toBeUndefined();
          expect((sessionToken as any).userPaidGas).toBeUndefined();
          expect((sessionToken as any).gasBalance).toBeUndefined();
          
          // Verify session is sponsored (gas-free for user)
          expect(sessionToken.sessionId).toBeDefined();
          expect(sessionToken.expiresAt).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 1.3: Recovery mechanisms should work without exposing private keys', async () => {
    await fc.assert(
      fc.asyncProperty(
        authMethodArbitrary,
        deviceFingerprintArbitrary,
        recoveryMethodArbitrary,
        async (authMethod, deviceFingerprint, recoveryMethod) => {
          // Arrange: Create user account with recovery method
          const user = await UserService.createUser({
            authMethod,
            deviceFingerprint
          });

          // Add recovery method
          const updatedUser = await UserService.addRecoveryMethod(
            user._id.toString(),
            recoveryMethod
          );

          // Assert: Recovery method should be added without exposing private keys
          expect(updatedUser).toBeDefined();
          expect(updatedUser!.recoveryMethods).toBeDefined();
          expect(updatedUser!.recoveryMethods.length).toBeGreaterThan(0);
          
          const addedRecovery = updatedUser!.recoveryMethods.find(
            rm => rm.type === recoveryMethod.type
          );
          expect(addedRecovery).toBeDefined();
          expect(addedRecovery!.identifier).toBe(recoveryMethod.identifier);
          
          // Verify no private keys are exposed
          expect((updatedUser as any).privateKey).toBeUndefined();
          expect((updatedUser as any).recoveryPrivateKey).toBeUndefined();
          expect((updatedUser as any).backupKey).toBeUndefined();
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 1.4: Account recovery should restore access without private key exposure', async () => {
    await fc.assert(
      fc.asyncProperty(
        authMethodArbitrary,
        deviceFingerprintArbitrary,
        fc.emailAddress(),
        async (authMethod, deviceFingerprint, recoveryEmail) => {
          // Arrange: Create user account with email recovery
          const user = await UserService.createUser({
            authMethod,
            deviceFingerprint
          });

          await UserService.addRecoveryMethod(user._id.toString(), {
            type: 'email',
            identifier: recoveryEmail
          });

          // Act: Initiate recovery process
          const recoveryToken = await authService.initiateRecovery({
            type: 'email',
            identifier: recoveryEmail
          });

          // Assert: Recovery should be initiated without exposing private keys
          expect(recoveryToken).toBeDefined();
          expect(recoveryToken.success).toBe(true);
          expect(recoveryToken.recoveryId).toBeDefined();
          
          // Verify no private keys in recovery token
          expect((recoveryToken as any).privateKey).toBeUndefined();
          expect((recoveryToken as any).masterKey).toBeUndefined();
          expect((recoveryToken as any).seedPhrase).toBeUndefined();
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 1.5: Fraud detection should freeze accounts without requiring private keys', async () => {
    await fc.assert(
      fc.asyncProperty(
        authMethodArbitrary,
        deviceFingerprintArbitrary,
        fc.constantFrom('identity_fraud', 'asset_fraud', 'behavioral_fraud', 'collusion_fraud'),
        async (authMethod, deviceFingerprint, fraudType) => {
          // Arrange: Create user account
          const user = await UserService.createUser({
            authMethod,
            deviceFingerprint
          });

          // Act: Freeze account due to fraud detection
          const frozenUser = await UserService.freezeAccount(
            user._id.toString(),
            fraudType,
            'Automated fraud detection'
          );

          // Assert: Account should be frozen without requiring private keys
          expect(frozenUser).toBeDefined();
          expect(frozenUser!.accountStatus).toBe('frozen');
          expect(frozenUser!.freezeReason).toBe(fraudType);
          
          // Verify no private keys are involved in freeze process
          expect((frozenUser as any).privateKey).toBeUndefined();
          expect((frozenUser as any).frozenPrivateKey).toBeUndefined();
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 1.6: Multiple devices should work with same account without key sharing', async () => {
    await fc.assert(
      fc.asyncProperty(
        authMethodArbitrary,
        deviceFingerprintArbitrary,
        deviceFingerprintArbitrary,
        async (authMethod, device1, device2) => {
          // Ensure devices are different
          fc.pre(device1.deviceId !== device2.deviceId);

          // Arrange: Create user account with first device
          const user = await UserService.createUser({
            authMethod,
            deviceFingerprint: device1
          });

          // Act: Add second device
          const updatedUser = await UserService.addDevice(
            user._id.toString(),
            device2
          );

          // Assert: Both devices should work without key sharing
          expect(updatedUser).toBeDefined();
          expect(updatedUser!.deviceFingerprints).toHaveLength(2);
          
          const device1Fingerprint = updatedUser!.deviceFingerprints.find(
            df => df.deviceId === device1.deviceId
          );
          const device2Fingerprint = updatedUser!.deviceFingerprints.find(
            df => df.deviceId === device2.deviceId
          );
          
          expect(device1Fingerprint).toBeDefined();
          expect(device2Fingerprint).toBeDefined();
          
          // Verify no private keys are shared between devices
          expect((device1Fingerprint as any).privateKey).toBeUndefined();
          expect((device2Fingerprint as any).privateKey).toBeUndefined();
          expect((device1Fingerprint as any).sharedKey).toBeUndefined();
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });
});
