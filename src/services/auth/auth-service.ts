/**
 * Authentication Service for Credit OS Account Abstraction
 * 
 * Provides email/phone/passkey authentication without wallet dependencies
 */

import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { logger } from '../../utils/logger';

export interface AuthCredentials {
  type: 'email' | 'phone' | 'passkey';
  identifier: string; // email address, phone number, or passkey ID
  challenge?: string; // For passkey authentication
  signature?: string; // For passkey authentication
  otp?: string; // For email/phone OTP
}

export interface SessionToken {
  sessionId: string;
  userId: string;
  internalUserId: string;
  authMethod: 'email' | 'phone' | 'passkey';
  deviceId: string;
  expiresAt: Date;
  capabilities: string[];
  isActive: boolean;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  internalUserId: string;
  authMethod: 'email' | 'phone' | 'passkey';
  deviceId: string;
  expiresAt: Date;
  lastActivity: Date;
  capabilities: string[];
  isValid: boolean;
}

export interface DeviceFingerprint {
  deviceId: string;
  browserFingerprint: string;
  ipAddress: string;
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
  };
  screenResolution?: string;
  timezone?: string;
  userAgent: string;
  hardwareSpecs?: {
    platform?: string;
    cores?: number;
    memory?: number;
  };
  behaviorMetrics?: {
    typingPattern?: number[];
    mouseMovement?: number[];
    touchPattern?: number[];
  };
}

export interface OTPRequest {
  identifier: string;
  type: 'email' | 'phone';
  purpose: 'login' | 'registration' | 'recovery';
}

export interface OTPValidation {
  identifier: string;
  otp: string;
  type: 'email' | 'phone';
}

export interface PasskeyChallenge {
  challenge: string;
  timeout: number;
  userVerification: 'required' | 'preferred' | 'discouraged';
  allowCredentials?: Array<{
    id: string;
    type: 'public-key';
  }>;
}

export interface PasskeyResponse {
  id: string;
  rawId: string;
  response: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
    userHandle?: string;
  };
  type: 'public-key';
}

export class AuthService {
  private activeSessions: Map<string, SessionToken> = new Map();
  private otpStore: Map<string, { otp: string; expiresAt: Date; attempts: number }> = new Map();
  private passkeyStore: Map<string, { challenge: string; expiresAt: Date }> = new Map();

  /**
   * Generate and send OTP for email/phone authentication
   */
  async generateOTP(request: OTPRequest): Promise<{ success: boolean; expiresAt: Date }> {
    try {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store OTP
      this.otpStore.set(request.identifier, {
        otp,
        expiresAt,
        attempts: 0
      });

      // Send OTP (mock implementation - in production would integrate with email/SMS service)
      if (request.type === 'email') {
        await this.sendEmailOTP(request.identifier, otp);
      } else {
        await this.sendSMSOTP(request.identifier, otp);
      }

      logger.info('OTP generated', { 
        identifier: request.identifier, 
        type: request.type, 
        purpose: request.purpose 
      });

      return { success: true, expiresAt };
    } catch (error: any) {
      logger.error('Failed to generate OTP', { 
        error: error.message, 
        identifier: request.identifier 
      });
      throw error;
    }
  }

  /**
   * Validate OTP for email/phone authentication
   */
  async validateOTP(validation: OTPValidation): Promise<boolean> {
    try {
      const stored = this.otpStore.get(validation.identifier);
      if (!stored) {
        logger.warn('OTP validation failed - not found', { identifier: validation.identifier });
        return false;
      }

      // Check expiration
      if (stored.expiresAt < new Date()) {
        this.otpStore.delete(validation.identifier);
        logger.warn('OTP validation failed - expired', { identifier: validation.identifier });
        return false;
      }

      // Check attempts
      if (stored.attempts >= 3) {
        this.otpStore.delete(validation.identifier);
        logger.warn('OTP validation failed - too many attempts', { identifier: validation.identifier });
        return false;
      }

      // Validate OTP
      if (stored.otp !== validation.otp) {
        stored.attempts++;
        logger.warn('OTP validation failed - incorrect', { 
          identifier: validation.identifier,
          attempts: stored.attempts 
        });
        return false;
      }

      // Success - remove OTP
      this.otpStore.delete(validation.identifier);
      logger.info('OTP validated successfully', { identifier: validation.identifier });
      return true;
    } catch (error: any) {
      logger.error('Failed to validate OTP', { 
        error: error.message, 
        identifier: validation.identifier 
      });
      return false;
    }
  }

  /**
   * Generate passkey challenge for WebAuthn authentication
   */
  async generatePasskeyChallenge(userId: string): Promise<PasskeyChallenge> {
    try {
      const challenge = randomUUID();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      this.passkeyStore.set(userId, { challenge, expiresAt });

      const passkeyChallenge: PasskeyChallenge = {
        challenge,
        timeout: 300000, // 5 minutes
        userVerification: 'preferred',
        // In production, would include user's registered credentials
        allowCredentials: []
      };

      logger.info('Passkey challenge generated', { userId });
      return passkeyChallenge;
    } catch (error: any) {
      logger.error('Failed to generate passkey challenge', { 
        error: error.message, 
        userId 
      });
      throw error;
    }
  }

  /**
   * Validate passkey response
   */
  async validatePasskeyResponse(
    userId: string, 
    response: PasskeyResponse
  ): Promise<boolean> {
    try {
      const stored = this.passkeyStore.get(userId);
      if (!stored) {
        logger.warn('Passkey validation failed - challenge not found', { userId });
        return false;
      }

      // Check expiration
      if (stored.expiresAt < new Date()) {
        this.passkeyStore.delete(userId);
        logger.warn('Passkey validation failed - challenge expired', { userId });
        return false;
      }

      // In production, would validate the WebAuthn response signature
      // For now, mock validation
      const isValid = response.id && response.response.signature;

      if (isValid) {
        this.passkeyStore.delete(userId);
        logger.info('Passkey validated successfully', { userId });
        return true;
      }

      logger.warn('Passkey validation failed - invalid response', { userId });
      return false;
    } catch (error: any) {
      logger.error('Failed to validate passkey response', { 
        error: error.message, 
        userId 
      });
      return false;
    }
  }

  /**
   * Create authentication session
   */
  async createSession(
    credentials: AuthCredentials,
    deviceFingerprint: DeviceFingerprint,
    userId: string,
    internalUserId: string,
    capabilities: string[] = []
  ): Promise<SessionToken> {
    try {
      const sessionId = randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const sessionToken: SessionToken = {
        sessionId,
        userId,
        internalUserId,
        authMethod: credentials.type,
        deviceId: deviceFingerprint.deviceId,
        expiresAt,
        capabilities,
        isActive: true
      };

      this.activeSessions.set(sessionId, sessionToken);

      logger.info('Session created', { 
        sessionId, 
        userId, 
        authMethod: credentials.type,
        deviceId: deviceFingerprint.deviceId 
      });

      return sessionToken;
    } catch (error: any) {
      logger.error('Failed to create session', { 
        error: error.message, 
        userId 
      });
      throw error;
    }
  }

  /**
   * Validate session token
   */
  async validateSession(token: SessionToken): Promise<SessionInfo> {
    try {
      const stored = this.activeSessions.get(token.sessionId);
      if (!stored) {
        return {
          ...token,
          lastActivity: new Date(),
          isValid: false
        };
      }

      // Check expiration
      if (stored.expiresAt < new Date()) {
        this.activeSessions.delete(token.sessionId);
        return {
          ...token,
          lastActivity: new Date(),
          isValid: false
        };
      }

      // Update last activity
      stored.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Extend by 24 hours
      
      return {
        ...stored,
        lastActivity: new Date(),
        isValid: true
      };
    } catch (error: any) {
      logger.error('Failed to validate session', { 
        error: error.message, 
        sessionId: token.sessionId 
      });
      return {
        ...token,
        lastActivity: new Date(),
        isValid: false
      };
    }
  }

  /**
   * Refresh session token
   */
  async refreshSession(token: SessionToken): Promise<SessionToken> {
    try {
      const sessionInfo = await this.validateSession(token);
      if (!sessionInfo.isValid) {
        throw new Error('Invalid session token');
      }

      // Extend expiration
      const refreshedToken = {
        ...token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      this.activeSessions.set(token.sessionId, refreshedToken);

      logger.info('Session refreshed', { sessionId: token.sessionId });
      return refreshedToken;
    } catch (error: any) {
      logger.error('Failed to refresh session', { 
        error: error.message, 
        sessionId: token.sessionId 
      });
      throw error;
    }
  }

  /**
   * Revoke session token
   */
  async revokeSession(token: SessionToken): Promise<void> {
    try {
      this.activeSessions.delete(token.sessionId);
      logger.info('Session revoked', { sessionId: token.sessionId });
    } catch (error: any) {
      logger.error('Failed to revoke session', { 
        error: error.message, 
        sessionId: token.sessionId 
      });
      throw error;
    }
  }

  /**
   * Generate device fingerprint hash
   */
  generateDeviceFingerprint(fingerprint: DeviceFingerprint): string {
    const components = [
      fingerprint.browserFingerprint,
      fingerprint.userAgent,
      fingerprint.screenResolution,
      fingerprint.timezone,
      fingerprint.geolocation?.country,
      fingerprint.hardwareSpecs?.platform
    ].filter(Boolean);

    return bcrypt.hashSync(components.join('|'), 10);
  }

  /**
   * Validate device fingerprint
   */
  validateDeviceFingerprint(
    fingerprint: DeviceFingerprint, 
    storedHash: string
  ): boolean {
    const currentHash = this.generateDeviceFingerprint(fingerprint);
    return bcrypt.compareSync(currentHash, storedHash);
  }

  /**
   * Clean up expired sessions and OTPs
   */
  async cleanup(): Promise<void> {
    const now = new Date();

    // Clean expired sessions
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.expiresAt < now) {
        this.activeSessions.delete(sessionId);
      }
    }

    // Clean expired OTPs
    for (const [identifier, otp] of this.otpStore.entries()) {
      if (otp.expiresAt < now) {
        this.otpStore.delete(identifier);
      }
    }

    // Clean expired passkey challenges
    for (const [userId, challenge] of this.passkeyStore.entries()) {
      if (challenge.expiresAt < now) {
        this.passkeyStore.delete(userId);
      }
    }
  }

  /**
   * Mock email OTP sending
   */
  private async sendEmailOTP(email: string, otp: string): Promise<void> {
    // Mock implementation - in production would integrate with email service
    logger.info('Email OTP sent (mock)', { email, otp });
  }

  /**
   * Mock SMS OTP sending
   */
  private async sendSMSOTP(phone: string, otp: string): Promise<void> {
    // Mock implementation - in production would integrate with SMS service
    logger.info('SMS OTP sent (mock)', { phone, otp });
  }

  // === Getter methods ===

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SessionToken | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): SessionToken[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId);
  }
}