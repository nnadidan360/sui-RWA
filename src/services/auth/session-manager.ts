/**
 * Session Manager for Credit OS Account Abstraction
 * 
 * Manages session lifecycle, device fingerprinting, and capability validation
 */

import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger';
import { AuthService, SessionToken, DeviceFingerprint } from './auth-service';

export interface SessionConfig {
  defaultDuration: number; // in milliseconds
  maxConcurrentSessions: number;
  deviceBindingRequired: boolean;
  extendOnActivity: boolean;
  cleanupInterval: number; // in milliseconds
}

export interface CapabilityCheck {
  action: string;
  resource?: string;
  context?: Record<string, any>;
}

export interface SessionActivity {
  sessionId: string;
  action: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  details?: Record<string, any>;
}

export interface SessionMetrics {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  averageSessionDuration: number;
  deviceCount: number;
  suspiciousActivity: number;
}

export class SessionManager {
  private authService: AuthService;
  private config: SessionConfig;
  private sessionActivities: Map<string, SessionActivity[]> = new Map();
  private deviceTrustScores: Map<string, number> = new Map();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(authService: AuthService, config?: Partial<SessionConfig>) {
    this.authService = authService;
    this.config = {
      defaultDuration: 24 * 60 * 60 * 1000, // 24 hours
      maxConcurrentSessions: 5,
      deviceBindingRequired: true,
      extendOnActivity: true,
      cleanupInterval: 60 * 60 * 1000, // 1 hour
      ...config
    };

    this.startCleanupTimer();
  }

  /**
   * Create a new session with device binding
   */
  async createSession(
    userId: string,
    internalUserId: string,
    authMethod: 'email' | 'phone' | 'passkey',
    deviceFingerprint: DeviceFingerprint,
    capabilities: string[] = [],
    customDuration?: number
  ): Promise<SessionToken> {
    try {
      // Check concurrent session limit
      const userSessions = this.authService.getUserSessions(userId);
      const activeSessions = userSessions.filter(s => s.isActive && s.expiresAt > new Date());
      
      if (activeSessions.length >= this.config.maxConcurrentSessions) {
        // Revoke oldest session
        const oldestSession = activeSessions.sort((a, b) => 
          a.expiresAt.getTime() - b.expiresAt.getTime()
        )[0];
        await this.authService.revokeSession(oldestSession);
        
        logger.info('Revoked oldest session due to limit', { 
          userId, 
          revokedSessionId: oldestSession.sessionId 
        });
      }

      // Validate device if binding is required
      if (this.config.deviceBindingRequired) {
        await this.validateDeviceBinding(deviceFingerprint);
      }

      // Create session through auth service
      const sessionToken = await this.authService.createSession(
        { type: authMethod, identifier: userId },
        deviceFingerprint,
        userId,
        internalUserId,
        capabilities
      );

      // Override duration if specified
      if (customDuration) {
        sessionToken.expiresAt = new Date(Date.now() + customDuration);
      }

      // Initialize activity tracking
      this.sessionActivities.set(sessionToken.sessionId, []);

      // Update device trust score
      this.updateDeviceTrustScore(deviceFingerprint.deviceId, 'session_created');

      // Log session creation activity
      await this.logActivity(sessionToken.sessionId, 'session_created', {
        authMethod,
        deviceId: deviceFingerprint.deviceId,
        capabilities
      });

      logger.info('Session created successfully', { 
        sessionId: sessionToken.sessionId,
        userId,
        authMethod,
        deviceId: deviceFingerprint.deviceId
      });

      return sessionToken;
    } catch (error: any) {
      logger.error('Failed to create session', { 
        error: error.message, 
        userId,
        authMethod 
      });
      throw error;
    }
  }

  /**
   * Validate session and check capabilities
   */
  async validateSessionWithCapabilities(
    sessionToken: SessionToken,
    capabilityCheck?: CapabilityCheck
  ): Promise<{ isValid: boolean; session?: SessionToken; reason?: string }> {
    try {
      // Basic session validation
      const sessionInfo = await this.authService.validateSession(sessionToken);
      if (!sessionInfo.isValid) {
        return { isValid: false, reason: 'Invalid or expired session' };
      }

      // Check capabilities if required
      if (capabilityCheck) {
        const hasCapability = await this.checkCapability(sessionToken, capabilityCheck);
        if (!hasCapability) {
          await this.logActivity(sessionToken.sessionId, 'capability_denied', {
            action: capabilityCheck.action,
            resource: capabilityCheck.resource
          }, false);
          return { isValid: false, reason: 'Insufficient capabilities' };
        }
      }

      // Extend session if configured
      if (this.config.extendOnActivity) {
        sessionToken.expiresAt = new Date(Date.now() + this.config.defaultDuration);
      }

      // Log activity
      await this.logActivity(sessionToken.sessionId, 'session_validated', {
        action: capabilityCheck?.action,
        extended: this.config.extendOnActivity
      });

      return { isValid: true, session: sessionToken };
    } catch (error: any) {
      logger.error('Failed to validate session', { 
        error: error.message, 
        sessionId: sessionToken.sessionId 
      });
      return { isValid: false, reason: 'Validation error' };
    }
  }

  /**
   * Check if session has required capability
   */
  async checkCapability(
    sessionToken: SessionToken,
    capabilityCheck: CapabilityCheck
  ): Promise<boolean> {
    try {
      // Check if session has the required capability
      const hasCapability = sessionToken.capabilities.includes(capabilityCheck.action) ||
                           sessionToken.capabilities.includes('*') || // Admin capability
                           sessionToken.capabilities.includes(`${capabilityCheck.action}:*`);

      // Additional context-based checks could be added here
      if (capabilityCheck.context) {
        // Example: Check resource ownership, time-based restrictions, etc.
        return hasCapability && this.validateCapabilityContext(sessionToken, capabilityCheck);
      }

      return hasCapability;
    } catch (error: any) {
      logger.error('Failed to check capability', { 
        error: error.message, 
        sessionId: sessionToken.sessionId,
        action: capabilityCheck.action 
      });
      return false;
    }
  }

  /**
   * Update session capabilities
   */
  async updateSessionCapabilities(
    sessionId: string,
    capabilities: string[]
  ): Promise<boolean> {
    try {
      const session = this.authService.getSession(sessionId);
      if (!session) {
        return false;
      }

      session.capabilities = capabilities;
      
      await this.logActivity(sessionId, 'capabilities_updated', {
        newCapabilities: capabilities
      });

      logger.info('Session capabilities updated', { sessionId, capabilities });
      return true;
    } catch (error: any) {
      logger.error('Failed to update session capabilities', { 
        error: error.message, 
        sessionId 
      });
      return false;
    }
  }

  /**
   * Revoke session with reason
   */
  async revokeSession(
    sessionToken: SessionToken,
    reason: string = 'User logout'
  ): Promise<void> {
    try {
      await this.logActivity(sessionToken.sessionId, 'session_revoked', {
        reason
      });

      await this.authService.revokeSession(sessionToken);
      
      // Clean up activity tracking
      this.sessionActivities.delete(sessionToken.sessionId);

      logger.info('Session revoked', { 
        sessionId: sessionToken.sessionId,
        reason 
      });
    } catch (error: any) {
      logger.error('Failed to revoke session', { 
        error: error.message, 
        sessionId: sessionToken.sessionId 
      });
      throw error;
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(
    userId: string,
    reason: string = 'Security action'
  ): Promise<number> {
    try {
      const userSessions = this.authService.getUserSessions(userId);
      let revokedCount = 0;

      for (const session of userSessions) {
        if (session.isActive) {
          await this.revokeSession(session, reason);
          revokedCount++;
        }
      }

      logger.info('All user sessions revoked', { userId, revokedCount, reason });
      return revokedCount;
    } catch (error: any) {
      logger.error('Failed to revoke all user sessions', { 
        error: error.message, 
        userId 
      });
      throw error;
    }
  }

  /**
   * Get session metrics
   */
  async getSessionMetrics(): Promise<SessionMetrics> {
    try {
      const allSessions = Array.from(this.authService['activeSessions'].values());
      const now = new Date();
      
      const activeSessions = allSessions.filter(s => s.isActive && s.expiresAt > now);
      const expiredSessions = allSessions.filter(s => s.expiresAt <= now);
      
      const deviceIds = new Set(allSessions.map(s => s.deviceId));
      
      // Calculate average session duration
      const totalDuration = allSessions.reduce((sum, session) => {
        const duration = session.expiresAt.getTime() - (session.expiresAt.getTime() - this.config.defaultDuration);
        return sum + duration;
      }, 0);
      const averageSessionDuration = allSessions.length > 0 ? totalDuration / allSessions.length : 0;

      // Count suspicious activities
      let suspiciousActivity = 0;
      for (const activities of this.sessionActivities.values()) {
        suspiciousActivity += activities.filter(a => !a.success).length;
      }

      return {
        totalSessions: allSessions.length,
        activeSessions: activeSessions.length,
        expiredSessions: expiredSessions.length,
        averageSessionDuration,
        deviceCount: deviceIds.size,
        suspiciousActivity
      };
    } catch (error: any) {
      logger.error('Failed to get session metrics', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate device binding
   */
  private async validateDeviceBinding(deviceFingerprint: DeviceFingerprint): Promise<void> {
    const trustScore = this.deviceTrustScores.get(deviceFingerprint.deviceId) || 0;
    
    if (trustScore < 50) {
      logger.warn('Low trust device attempting session creation', {
        deviceId: deviceFingerprint.deviceId,
        trustScore
      });
      // In production, might require additional verification
    }
  }

  /**
   * Update device trust score
   */
  private updateDeviceTrustScore(deviceId: string, action: string): void {
    const currentScore = this.deviceTrustScores.get(deviceId) || 50;
    let adjustment = 0;

    switch (action) {
      case 'session_created':
        adjustment = 5;
        break;
      case 'suspicious_activity':
        adjustment = -20;
        break;
      case 'failed_auth':
        adjustment = -10;
        break;
      case 'successful_activity':
        adjustment = 2;
        break;
    }

    const newScore = Math.max(0, Math.min(100, currentScore + adjustment));
    this.deviceTrustScores.set(deviceId, newScore);
  }

  /**
   * Validate capability context
   */
  private validateCapabilityContext(
    sessionToken: SessionToken,
    capabilityCheck: CapabilityCheck
  ): boolean {
    // Example context validations
    if (capabilityCheck.context) {
      // Time-based restrictions
      if (capabilityCheck.context.timeRestricted) {
        const hour = new Date().getHours();
        if (hour < 9 || hour > 17) { // Business hours only
          return false;
        }
      }

      // Resource ownership checks
      if (capabilityCheck.context.resourceOwner) {
        return capabilityCheck.context.resourceOwner === sessionToken.userId;
      }
    }

    return true;
  }

  /**
   * Log session activity
   */
  private async logActivity(
    sessionId: string,
    action: string,
    details?: Record<string, any>,
    success: boolean = true
  ): Promise<void> {
    const activity: SessionActivity = {
      sessionId,
      action,
      timestamp: new Date(),
      success,
      details
    };

    const activities = this.sessionActivities.get(sessionId) || [];
    activities.push(activity);
    
    // Keep only last 100 activities per session
    if (activities.length > 100) {
      activities.splice(0, activities.length - 100);
    }
    
    this.sessionActivities.set(sessionId, activities);
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.authService.cleanup();
        
        // Clean up activity tracking for expired sessions
        const now = new Date();
        for (const [sessionId, activities] of this.sessionActivities.entries()) {
          const session = this.authService.getSession(sessionId);
          if (!session || session.expiresAt < now) {
            this.sessionActivities.delete(sessionId);
          }
        }
        
        logger.debug('Session cleanup completed');
      } catch (error: any) {
        logger.error('Session cleanup failed', { error: error.message });
      }
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  // === Getter methods ===

  /**
   * Get session activities
   */
  getSessionActivities(sessionId: string): SessionActivity[] {
    return this.sessionActivities.get(sessionId) || [];
  }

  /**
   * Get device trust score
   */
  getDeviceTrustScore(deviceId: string): number {
    return this.deviceTrustScores.get(deviceId) || 0;
  }

  /**
   * Get configuration
   */
  getConfig(): SessionConfig {
    return { ...this.config };
  }
}