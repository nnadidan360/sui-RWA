/**
 * Session Management Service for Backend
 * 
 * Handles user sessions, authentication tokens, and secure storage
 */

import { User } from '../../types/entities';

export interface UserSession {
  id: string;
  userId: string;
  address: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
}

export interface CreateSessionRequest {
  userId: string;
  address: string;
  ipAddress: string;
  userAgent: string;
  signature?: string;
}

export class SessionService {
  private static readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  
  // In-memory session store (in production, use Redis or database)
  private static sessions: Map<string, UserSession> = new Map();
  private static userSessions: Map<string, Set<string>> = new Map();

  static {
    // Start cleanup interval
    setInterval(() => {
      SessionService.cleanupExpiredSessions();
    }, SessionService.CLEANUP_INTERVAL);
  }

  /**
   * Create a new session for the user
   */
  static async createSession(request: CreateSessionRequest): Promise<UserSession> {
    const sessionId = this.generateSessionId();
    const now = new Date();
    
    const session: UserSession = {
      id: sessionId,
      userId: request.userId,
      address: request.address,
      sessionId,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.SESSION_DURATION),
      lastActivityAt: now,
      isActive: true,
    };

    // Store session
    this.sessions.set(sessionId, session);
    
    // Track user sessions
    if (!this.userSessions.has(request.userId)) {
      this.userSessions.set(request.userId, new Set());
    }
    this.userSessions.get(request.userId)!.add(sessionId);

    return session;
  }

  /**
   * Get session by session ID
   */
  static async getSession(sessionId: string): Promise<UserSession | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (Date.now() > session.expiresAt.getTime() || !session.isActive) {
      await this.invalidateSession(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Update session activity
   */
  static async updateSessionActivity(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isActive) {
      return false;
    }

    session.lastActivityAt = new Date();
    return true;
  }

  /**
   * Extend session expiration
   */
  static async extendSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isActive) {
      return false;
    }

    const now = new Date();
    session.expiresAt = new Date(now.getTime() + this.SESSION_DURATION);
    session.lastActivityAt = now;
    
    return true;
  }

  /**
   * Invalidate a specific session
   */
  static async invalidateSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return false;
    }

    // Mark as inactive
    session.isActive = false;
    
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
    
    return true;
  }

  /**
   * Invalidate all sessions for a user
   */
  static async invalidateUserSessions(userId: string): Promise<number> {
    const userSessionSet = this.userSessions.get(userId);
    
    if (!userSessionSet) {
      return 0;
    }

    let invalidatedCount = 0;
    
    for (const sessionId of userSessionSet) {
      const success = await this.invalidateSession(sessionId);
      if (success) {
        invalidatedCount++;
      }
    }

    return invalidatedCount;
  }

  /**
   * Get all active sessions for a user
   */
  static async getUserSessions(userId: string): Promise<UserSession[]> {
    const userSessionSet = this.userSessions.get(userId);
    
    if (!userSessionSet) {
      return [];
    }

    const sessions: UserSession[] = [];
    
    for (const sessionId of userSessionSet) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Validate session and return user info
   */
  static async validateSession(sessionId: string): Promise<{ session: UserSession; isValid: boolean }> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return { session: null as any, isValid: false };
    }

    // Update activity
    await this.updateSessionActivity(sessionId);
    
    return { session, isValid: true };
  }

  /**
   * Clean up expired sessions
   */
  private static cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt.getTime() || !session.isActive) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.invalidateSession(sessionId);
    }

    if (expiredSessions.length > 0) {
      console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  /**
   * Generate a unique session ID
   */
  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2)}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Get session statistics
   */
  static getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    totalUsers: number;
  } {
    const now = Date.now();
    let activeSessions = 0;

    for (const session of this.sessions.values()) {
      if (session.isActive && now <= session.expiresAt.getTime()) {
        activeSessions++;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      totalUsers: this.userSessions.size,
    };
  }
}