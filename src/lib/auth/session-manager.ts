/**
 * Credit OS Session Manager
 * Manages session lifecycle and token validation
 * Requirements: 1.3, 6.1
 */

import { EventEmitter } from 'events';
import { getCreditOSConfig } from '../../config/credit-os';
import { SessionInfo, CreditOSUser } from '../database/credit-os-models';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface SessionData {
  sessionId: string;
  userId: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  permissions: string[];
  active: boolean;
}

export interface SessionValidationResult {
  valid: boolean;
  session?: SessionData;
  user?: CreditOSUser;
  reason?: string;
}

export interface SessionMetrics {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  averageSessionDuration: number;
  sessionsPerUser: Map<string, number>;
}

// ============================================================================
// SESSION MANAGER CLASS
// ============================================================================

export class SessionManager extends EventEmitter {
  private config = getCreditOSConfig();
  private sessions = new Map<string, SessionData>();
  private userSessions = new Map<string, Set<string>>(); // userId -> sessionIds
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    
    // Start cleanup interval for expired sessions
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Check every minute
  }

  // ============================================================================
  // SESSION LIFECYCLE
  // ============================================================================

  /**
   * Create a new session
   * Requirements: 1.3
   */
  createSession(
    userId: string,
    deviceId: string,
    ipAddress: string,
    userAgent: string,
    permissions: string[] = ['basic']
  ): SessionData {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.auth.sessionDuration);

    const session: SessionData = {
      sessionId,
      userId,
      deviceId,
      ipAddress: this.hashIP(ipAddress),
      userAgent,
      createdAt: now,
      expiresAt,
      lastActivity: now,
      permissions,
      active: true,
    };

    // Store session
    this.sessions.set(sessionId, session);

    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);

    // Enforce session limits per user
    this.enforceSessionLimits(userId);

    // Emit session created event
    this.emit('sessionCreated', session);

    return session;
  }

  /**
   * Validate session and update activity
   * Requirements: 1.3
   */
  validateSession(
    sessionId: string,
    deviceId?: string,
    ipAddress?: string
  ): SessionValidationResult {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return {
        valid: false,
        reason: 'Session not found',
      };
    }

    if (!session.active) {
      return {
        valid: false,
        reason: 'Session inactive',
      };
    }

    const now = new Date();
    if (now > session.expiresAt) {
      this.revokeSession(sessionId, 'expired');
      return {
        valid: false,
        reason: 'Session expired',
      };
    }

    // Validate device consistency if provided
    if (deviceId && session.deviceId !== deviceId) {
      this.emit('deviceMismatch', {
        sessionId,
        expectedDevice: session.deviceId,
        providedDevice: deviceId,
      });
      return {
        valid: false,
        reason: 'Device mismatch',
      };
    }

    // Validate IP consistency if provided (allow some flexibility)
    if (ipAddress) {
      const hashedIP = this.hashIP(ipAddress);
      if (session.ipAddress !== hashedIP) {
        // Log IP change but don't invalidate session
        this.emit('ipChanged', {
          sessionId,
          oldIP: session.ipAddress,
          newIP: hashedIP,
        });
        session.ipAddress = hashedIP;
      }
    }

    // Update last activity
    session.lastActivity = now;

    return {
      valid: true,
      session,
    };
  }

  /**
   * Refresh session expiry
   */
  refreshSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) {
      return false;
    }

    const now = new Date();
    session.expiresAt = new Date(now.getTime() + this.config.auth.sessionDuration);
    session.lastActivity = now;

    this.emit('sessionRefreshed', session);
    return true;
  }

  /**
   * Revoke a specific session
   */
  revokeSession(sessionId: string, reason: string = 'manual'): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.active = false;

    // Remove from user sessions tracking
    const userSessionSet = this.userSessions.get(session.userId);
    if (userSessionSet) {
      userSessionSet.delete(sessionId);
      if (userSessionSet.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    // Remove from sessions map
    this.sessions.delete(sessionId);

    this.emit('sessionRevoked', { session, reason });
    return true;
  }

  /**
   * Revoke all sessions for a user
   * Requirements: 6.4 (fraud response)
   */
  revokeAllUserSessions(userId: string, reason: string = 'security'): number {
    const userSessionSet = this.userSessions.get(userId);
    if (!userSessionSet) {
      return 0;
    }

    const sessionIds = Array.from(userSessionSet);
    let revokedCount = 0;

    for (const sessionId of sessionIds) {
      if (this.revokeSession(sessionId, reason)) {
        revokedCount++;
      }
    }

    this.emit('allUserSessionsRevoked', { userId, count: revokedCount, reason });
    return revokedCount;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions for a user
   */
  getUserSessions(userId: string): SessionData[] {
    const userSessionSet = this.userSessions.get(userId);
    if (!userSessionSet) {
      return [];
    }

    const sessions: SessionData[] = [];
    for (const sessionId of userSessionSet) {
      const session = this.sessions.get(sessionId);
      if (session && session.active) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Enforce session limits per user
   */
  private enforceSessionLimits(userId: string): void {
    const userSessionSet = this.userSessions.get(userId);
    if (!userSessionSet) {
      return;
    }

    const maxSessions = this.config.auth.maxActiveSessions;
    if (userSessionSet.size <= maxSessions) {
      return;
    }

    // Get all sessions for user, sorted by last activity
    const userSessions = Array.from(userSessionSet)
      .map(sessionId => this.sessions.get(sessionId))
      .filter((session): session is SessionData => session !== undefined)
      .sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime());

    // Revoke oldest sessions
    const sessionsToRevoke = userSessions.slice(0, userSessions.length - maxSessions);
    for (const session of sessionsToRevoke) {
      this.revokeSession(session.sessionId, 'limit_exceeded');
    }
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (now > session.expiresAt) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.revokeSession(sessionId, 'expired');
    }

    if (expiredSessions.length > 0) {
      this.emit('sessionsCleanedUp', { count: expiredSessions.length });
    }
  }

  // ============================================================================
  // SECURITY FEATURES
  // ============================================================================

  /**
   * Check for suspicious session activity
   * Requirements: 6.1
   */
  detectSuspiciousActivity(userId: string): {
    suspicious: boolean;
    reasons: string[];
  } {
    const userSessions = this.getUserSessions(userId);
    const reasons: string[] = [];

    // Check for too many concurrent sessions
    if (userSessions.length > this.config.auth.maxActiveSessions * 0.8) {
      reasons.push('High number of concurrent sessions');
    }

    // Check for sessions from different locations
    const uniqueIPs = new Set(userSessions.map(s => s.ipAddress));
    if (uniqueIPs.size > 3) {
      reasons.push('Sessions from multiple locations');
    }

    // Check for rapid session creation
    const recentSessions = userSessions.filter(
      s => Date.now() - s.createdAt.getTime() < 300000 // 5 minutes
    );
    if (recentSessions.length > 3) {
      reasons.push('Rapid session creation');
    }

    // Check for unusual user agents
    const userAgents = userSessions.map(s => s.userAgent);
    const uniqueUserAgents = new Set(userAgents);
    if (uniqueUserAgents.size > userSessions.length * 0.5) {
      reasons.push('Multiple different user agents');
    }

    return {
      suspicious: reasons.length > 0,
      reasons,
    };
  }

  /**
   * Get session metrics for monitoring
   */
  getMetrics(): SessionMetrics {
    const now = new Date();
    let totalDuration = 0;
    let activeSessions = 0;
    let expiredSessions = 0;

    for (const session of this.sessions.values()) {
      if (session.active && now <= session.expiresAt) {
        activeSessions++;
        totalDuration += now.getTime() - session.createdAt.getTime();
      } else {
        expiredSessions++;
      }
    }

    const sessionsPerUser = new Map<string, number>();
    for (const [userId, sessionSet] of this.userSessions) {
      sessionsPerUser.set(userId, sessionSet.size);
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      expiredSessions,
      averageSessionDuration: activeSessions > 0 ? totalDuration / activeSessions : 0,
      sessionsPerUser,
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private hashIP(ipAddress: string): string {
    // Use a simple hash for IP addresses to maintain privacy
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(ipAddress).digest('hex');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
    this.userSessions.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let sessionManagerInstance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}

export function destroySessionManager(): void {
  if (sessionManagerInstance) {
    sessionManagerInstance.destroy();
    sessionManagerInstance = null;
  }
}