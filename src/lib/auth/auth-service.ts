/**
 * Credit OS Authentication Service
 * Implements multiple authentication methods for account abstraction
 * Requirements: 1.1, 1.3, 6.1
 */

import { createHash, randomBytes } from 'crypto';
import { sign, verify } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getCreditOSConfig } from '../../config/credit-os';
import { getSuiService } from '../blockchain/sui-service';
import { 
  CreditOSUserModel, 
  CreditOSUser, 
  AuthMethod, 
  DeviceFingerprint, 
  SessionInfo 
} from '../database/credit-os-models';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface AuthCredentials {
  type: 'email' | 'phone' | 'passkey';
  identifier: string;
  proof: string; // password, OTP, or passkey signature
  deviceFingerprint?: string;
}

export interface AuthResult {
  success: boolean;
  user?: CreditOSUser;
  sessionToken?: string;
  suiAccountObjectId?: string;
  error?: string;
  requiresMFA?: boolean;
  mfaToken?: string;
}

export interface SessionToken {
  sessionId: string;
  userId: string;
  deviceId: string;
  expiresAt: Date;
  permissions: string[];
}

export interface MFAChallenge {
  token: string;
  type: 'sms' | 'email' | 'totp';
  expiresAt: Date;
  attempts: number;
}

export interface DeviceFingerprintData {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  cookiesEnabled: boolean;
  localStorageEnabled: boolean;
  sessionStorageEnabled: boolean;
  indexedDBEnabled: boolean;
  webGLRenderer?: string;
  canvasFingerprint?: string;
}

// ============================================================================
// AUTHENTICATION SERVICE CLASS
// ============================================================================

export class AuthService {
  private config = getCreditOSConfig();
  private suiService = getSuiService();
  private activeSessions = new Map<string, SessionInfo>();
  private mfaChallenges = new Map<string, MFAChallenge>();

  // ============================================================================
  // ACCOUNT CREATION
  // ============================================================================

  /**
   * Create new user account with account abstraction
   * Requirements: 1.1, 1.2
   */
  async createAccount(
    authMethods: Omit<AuthMethod, 'createdAt'>[],
    deviceFingerprint: DeviceFingerprintData,
    ipAddress: string
  ): Promise<AuthResult> {
    try {
      // Generate internal user ID
      const internalUserId = this.generateUserId();
      
      // Hash sensitive data
      const hashedIP = this.hashData(ipAddress);
      const deviceFP = this.createDeviceFingerprint(deviceFingerprint, hashedIP);
      
      // Process auth methods
      const processedAuthMethods: AuthMethod[] = [];
      for (const method of authMethods) {
        const processedMethod: AuthMethod = {
          ...method,
          identifier: await this.hashAuthIdentifier(method.type, method.identifier),
          verified: false,
          createdAt: new Date(),
        };
        processedAuthMethods.push(processedMethod);
      }
      
      // Create Sui account object
      const suiResult = await this.createSuiAccount();
      
      // Create user record
      const user: CreditOSUser = {
        internalUserId,
        authMethods: processedAuthMethods,
        deviceFingerprints: [deviceFP],
        activeSessions: [],
        recoveryPolicy: {
          emailRecovery: authMethods.some(m => m.type === 'email'),
          deviceRecovery: true,
          guardianRecovery: false,
          guardianEmails: [],
          recoveryAttempts: [],
        },
        suiAccountObjectId: suiResult.objectId,
        consentScope: {
          dataProcessing: true,
          creditReporting: false,
          externalReporting: false,
          marketingCommunications: false,
          grantedAt: new Date(),
          updatedAt: new Date(),
        },
        jurisdictionCode: this.detectJurisdiction(ipAddress),
        fraudStatus: 'clean',
        lastFraudCheck: new Date(),
        kycStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        preferences: {
          language: 'en',
          currency: 'USD',
          notifications: true,
        },
      };
      
      // Save to database
      await CreditOSUserModel.insertOne(user);
      
      // Create initial session
      const sessionToken = await this.createSession(user, deviceFP);
      
      return {
        success: true,
        user,
        sessionToken,
        suiAccountObjectId: suiResult.objectId,
      };
      
    } catch (error) {
      console.error('Account creation failed:', error);
      return {
        success: false,
        error: 'Account creation failed',
      };
    }
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  /**
   * Authenticate user with credentials
   * Requirements: 1.1
   */
  async authenticate(
    credentials: AuthCredentials,
    ipAddress: string
  ): Promise<AuthResult> {
    try {
      // Hash the identifier for lookup
      const hashedIdentifier = await this.hashAuthIdentifier(
        credentials.type, 
        credentials.identifier
      );
      
      // Find user by auth method
      const user = await CreditOSUserModel.findOne({
        'authMethods.type': credentials.type,
        'authMethods.identifier': hashedIdentifier,
      });
      
      if (!user) {
        return {
          success: false,
          error: 'Invalid credentials',
        };
      }
      
      // Check if account is frozen
      if (user.fraudStatus === 'frozen') {
        return {
          success: false,
          error: 'Account is frozen',
        };
      }
      
      // Verify credentials
      const authMethod = user.authMethods.find(
        m => m.type === credentials.type && m.identifier === hashedIdentifier
      );
      
      if (!authMethod || !authMethod.verified) {
        return {
          success: false,
          error: 'Authentication method not verified',
        };
      }
      
      // Verify proof (password, OTP, etc.)
      const proofValid = await this.verifyAuthProof(
        credentials.type,
        credentials.proof,
        authMethod
      );
      
      if (!proofValid) {
        await this.recordFailedAuth(user.internalUserId, credentials.type, ipAddress);
        return {
          success: false,
          error: 'Invalid credentials',
        };
      }
      
      // Check if MFA is required
      const requiresMFA = this.shouldRequireMFA(user, credentials.type);
      if (requiresMFA) {
        const mfaToken = await this.initiateMFA(user, credentials.type);
        return {
          success: false,
          requiresMFA: true,
          mfaToken,
        };
      }
      
      // Validate device fingerprint
      const deviceFP = this.createDeviceFingerprint(
        credentials.deviceFingerprint ? JSON.parse(credentials.deviceFingerprint) : {},
        this.hashData(ipAddress)
      );
      
      const deviceValid = await this.validateDeviceFingerprint(user, deviceFP);
      if (!deviceValid) {
        // New device - may require additional verification
        await this.addDeviceFingerprint(user, deviceFP);
      }
      
      // Create session
      const sessionToken = await this.createSession(user, deviceFP);
      
      // Update last activity
      await this.updateUserActivity(user.internalUserId, ipAddress);
      
      return {
        success: true,
        user,
        sessionToken,
        suiAccountObjectId: user.suiAccountObjectId,
      };
      
    } catch (error) {
      console.error('Authentication failed:', error);
      return {
        success: false,
        error: 'Authentication failed',
      };
    }
  }

  /**
   * Verify MFA challenge
   * Requirements: 1.1
   */
  async verifyMFA(
    mfaToken: string,
    code: string,
    deviceFingerprint: DeviceFingerprintData,
    ipAddress: string
  ): Promise<AuthResult> {
    try {
      const challenge = this.mfaChallenges.get(mfaToken);
      if (!challenge || challenge.expiresAt < new Date()) {
        return {
          success: false,
          error: 'Invalid or expired MFA token',
        };
      }
      
      // Verify MFA code
      const codeValid = await this.verifyMFACode(challenge, code);
      if (!codeValid) {
        challenge.attempts++;
        if (challenge.attempts >= 3) {
          this.mfaChallenges.delete(mfaToken);
        }
        return {
          success: false,
          error: 'Invalid MFA code',
        };
      }
      
      // Get user and complete authentication
      const userId = this.extractUserIdFromMFAToken(mfaToken);
      const user = await CreditOSUserModel.findOne({ internalUserId: userId });
      
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }
      
      // Create device fingerprint and session
      const deviceFP = this.createDeviceFingerprint(
        deviceFingerprint,
        this.hashData(ipAddress)
      );
      
      const sessionToken = await this.createSession(user, deviceFP);
      
      // Clean up MFA challenge
      this.mfaChallenges.delete(mfaToken);
      
      return {
        success: true,
        user,
        sessionToken,
        suiAccountObjectId: user.suiAccountObjectId,
      };
      
    } catch (error) {
      console.error('MFA verification failed:', error);
      return {
        success: false,
        error: 'MFA verification failed',
      };
    }
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Create new session token
   * Requirements: 1.3
   */
  async createSession(
    user: CreditOSUser,
    deviceFingerprint: DeviceFingerprint
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + this.config.auth.sessionDuration);
    
    const sessionInfo: SessionInfo = {
      sessionId,
      deviceId: deviceFingerprint.deviceId,
      createdAt: new Date(),
      expiresAt,
      lastActivity: new Date(),
      ipAddress: deviceFingerprint.ipAddress,
      active: true,
    };
    
    // Store session
    this.activeSessions.set(sessionId, sessionInfo);
    
    // Update user's active sessions
    user.activeSessions.push(sessionInfo);
    
    // Limit number of active sessions
    if (user.activeSessions.length > this.config.auth.maxActiveSessions) {
      const oldestSession = user.activeSessions.shift();
      if (oldestSession) {
        this.activeSessions.delete(oldestSession.sessionId);
      }
    }
    
    // Update user in database
    await CreditOSUserModel.updateOne(
      { internalUserId: user.internalUserId },
      { 
        $set: { 
          activeSessions: user.activeSessions,
          updatedAt: new Date(),
        }
      }
    );
    
    // Create Sui session token
    await this.createSuiSession(user.suiAccountObjectId!, sessionId, deviceFingerprint);
    
    // Generate JWT token
    const tokenPayload: SessionToken = {
      sessionId,
      userId: user.internalUserId,
      deviceId: deviceFingerprint.deviceId,
      expiresAt,
      permissions: ['basic'], // Can be expanded based on user capabilities
    };
    
    return sign(tokenPayload, this.config.auth.sessionSecret || 'default-secret', {
      expiresIn: '24h',
    });
  }

  /**
   * Validate session token
   * Requirements: 1.3
   */
  async validateSession(
    token: string,
    deviceFingerprint?: string,
    ipAddress?: string
  ): Promise<{ valid: boolean; user?: CreditOSUser; sessionInfo?: SessionInfo }> {
    try {
      // Verify JWT token
      const decoded = verify(
        token, 
        this.config.auth.sessionSecret || 'default-secret'
      ) as SessionToken;
      
      // Check if session exists and is active
      const sessionInfo = this.activeSessions.get(decoded.sessionId);
      if (!sessionInfo || !sessionInfo.active) {
        return { valid: false };
      }
      
      // Check expiry
      if (sessionInfo.expiresAt < new Date()) {
        await this.revokeSession(decoded.sessionId);
        return { valid: false };
      }
      
      // Validate device consistency if provided
      if (deviceFingerprint && sessionInfo.deviceId !== deviceFingerprint) {
        return { valid: false };
      }
      
      // Get user
      const user = await CreditOSUserModel.findOne({
        internalUserId: decoded.userId,
      });
      
      if (!user || user.fraudStatus === 'frozen') {
        return { valid: false };
      }
      
      // Update last activity
      sessionInfo.lastActivity = new Date();
      if (ipAddress) {
        await this.updateUserActivity(user.internalUserId, ipAddress);
      }
      
      return {
        valid: true,
        user,
        sessionInfo,
      };
      
    } catch (error) {
      console.error('Session validation failed:', error);
      return { valid: false };
    }
  }

  /**
   * Revoke session token
   */
  async revokeSession(sessionId: string): Promise<void> {
    const sessionInfo = this.activeSessions.get(sessionId);
    if (sessionInfo) {
      sessionInfo.active = false;
      this.activeSessions.delete(sessionId);
      
      // Update user's active sessions
      // This would require finding the user and updating their session list
      // Implementation depends on specific requirements
    }
  }

  /**
   * Revoke all sessions for user (fraud response)
   * Requirements: 6.4
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    const user = await CreditOSUserModel.findOne({ internalUserId: userId });
    if (!user) return;
    
    // Revoke all active sessions
    for (const session of user.activeSessions) {
      this.activeSessions.delete(session.sessionId);
    }
    
    // Clear user's session list
    await CreditOSUserModel.updateOne(
      { internalUserId: userId },
      { 
        $set: { 
          activeSessions: [],
          updatedAt: new Date(),
        }
      }
    );
  }

  // ============================================================================
  // DEVICE FINGERPRINTING
  // ============================================================================

  /**
   * Create device fingerprint for fraud prevention
   * Requirements: 6.1
   */
  createDeviceFingerprint(
    data: DeviceFingerprintData,
    hashedIP: string
  ): DeviceFingerprint {
    const fingerprintString = [
      data.userAgent,
      data.screenResolution,
      data.timezone,
      data.language,
      data.platform,
      data.cookiesEnabled,
      data.localStorageEnabled,
      data.sessionStorageEnabled,
      data.indexedDBEnabled,
      data.webGLRenderer,
      data.canvasFingerprint,
    ].join('|');
    
    const fingerprint = this.hashData(fingerprintString);
    const deviceId = this.generateDeviceId();
    
    return {
      deviceId,
      fingerprint,
      userAgent: data.userAgent,
      ipAddress: hashedIP,
      location: this.extractLocationFromIP(hashedIP),
      firstSeen: new Date(),
      lastSeen: new Date(),
      trusted: false,
    };
  }

  /**
   * Validate device fingerprint consistency
   * Requirements: 5.5
   */
  async validateDeviceFingerprint(
    user: CreditOSUser,
    currentFingerprint: DeviceFingerprint
  ): Promise<boolean> {
    // Check if device fingerprint matches any known devices
    for (const knownDevice of user.deviceFingerprints) {
      if (knownDevice.fingerprint === currentFingerprint.fingerprint) {
        // Update last seen
        knownDevice.lastSeen = new Date();
        return true;
      }
    }
    
    return false;
  }

  /**
   * Add new device fingerprint
   */
  async addDeviceFingerprint(
    user: CreditOSUser,
    deviceFingerprint: DeviceFingerprint
  ): Promise<void> {
    user.deviceFingerprints.push(deviceFingerprint);
    
    // Limit number of stored device fingerprints
    if (user.deviceFingerprints.length > 10) {
      user.deviceFingerprints.shift();
    }
    
    await CreditOSUserModel.updateOne(
      { internalUserId: user.internalUserId },
      { 
        $set: { 
          deviceFingerprints: user.deviceFingerprints,
          updatedAt: new Date(),
        }
      }
    );
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private generateUserId(): string {
    return `user_${randomBytes(16).toString('hex')}`;
  }

  private generateSessionId(): string {
    return `session_${randomBytes(16).toString('hex')}`;
  }

  private generateDeviceId(): string {
    return `device_${randomBytes(16).toString('hex')}`;
  }

  private hashData(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private async hashAuthIdentifier(type: string, identifier: string): Promise<string> {
    const salt = await bcrypt.genSalt(this.config.auth.bcryptRounds || 12);
    return bcrypt.hash(`${type}:${identifier}`, salt);
  }

  private async verifyAuthProof(
    type: string,
    proof: string,
    authMethod: AuthMethod
  ): Promise<boolean> {
    // Implementation depends on auth type
    switch (type) {
      case 'email':
      case 'phone':
        // For email/phone, proof would be a password or OTP
        // This is a simplified implementation
        return proof.length >= 6;
      case 'passkey':
        // For passkey, proof would be a cryptographic signature
        // This would require WebAuthn verification
        return proof.length > 0;
      default:
        return false;
    }
  }

  private shouldRequireMFA(user: CreditOSUser, authType: string): boolean {
    // Check if user has multiple auth methods configured
    return user.authMethods.length > 1 && authType !== 'passkey';
  }

  private async initiateMFA(user: CreditOSUser, primaryAuthType: string): Promise<string> {
    const mfaToken = `mfa_${randomBytes(16).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 300000); // 5 minutes
    
    // Find secondary auth method
    const secondaryMethod = user.authMethods.find(m => m.type !== primaryAuthType);
    if (!secondaryMethod) {
      throw new Error('No secondary auth method available');
    }
    
    const challenge: MFAChallenge = {
      token: mfaToken,
      type: secondaryMethod.type === 'phone' ? 'sms' : 'email',
      expiresAt,
      attempts: 0,
    };
    
    this.mfaChallenges.set(mfaToken, challenge);
    
    // Send MFA code (implementation depends on service providers)
    await this.sendMFACode(challenge, secondaryMethod.identifier);
    
    return mfaToken;
  }

  private async verifyMFACode(challenge: MFAChallenge, code: string): Promise<boolean> {
    // Implementation depends on MFA type
    // This is a simplified implementation
    return code.length === 6 && /^\d{6}$/.test(code);
  }

  private extractUserIdFromMFAToken(mfaToken: string): string {
    // In a real implementation, this would be stored in the challenge
    // For now, return a placeholder
    return 'user_placeholder';
  }

  private async sendMFACode(challenge: MFAChallenge, identifier: string): Promise<void> {
    // Implementation depends on service providers (Twilio, SendGrid, etc.)
    console.log(`Sending MFA code via ${challenge.type} to ${identifier}`);
  }

  private async createSuiAccount(): Promise<{ objectId: string; transactionDigest: string }> {
    // Create Sui account object using the Sui service
    // This is a placeholder - actual implementation would use the Sui service
    return {
      objectId: `sui_account_${randomBytes(16).toString('hex')}`,
      transactionDigest: `tx_${randomBytes(16).toString('hex')}`,
    };
  }

  private async createSuiSession(
    accountObjectId: string,
    sessionId: string,
    deviceFingerprint: DeviceFingerprint
  ): Promise<void> {
    // Create Sui session token using the Sui service
    // This is a placeholder - actual implementation would use the Sui service
    console.log(`Creating Sui session for account ${accountObjectId}`);
  }

  private detectJurisdiction(ipAddress: string): string {
    // Implementation would use IP geolocation service
    // For now, return default
    return 'US';
  }

  private extractLocationFromIP(hashedIP: string): { country: string; region?: string } | undefined {
    // Implementation would use IP geolocation service
    // For now, return undefined since IP is hashed
    return undefined;
  }

  private async recordFailedAuth(userId: string, authType: string, ipAddress: string): Promise<void> {
    // Record failed authentication attempt for fraud detection
    console.log(`Failed auth attempt for user ${userId}, type ${authType}`);
  }

  private async updateUserActivity(userId: string, ipAddress: string): Promise<void> {
    await CreditOSUserModel.updateOne(
      { internalUserId: userId },
      { 
        $set: { 
          lastFraudCheck: new Date(),
          updatedAt: new Date(),
        }
      }
    );
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let authServiceInstance: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService();
  }
  return authServiceInstance;
}