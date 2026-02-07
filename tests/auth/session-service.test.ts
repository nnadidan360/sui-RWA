/**
 * Session Service Tests
 */

import { SessionService } from '../../src/services/auth/session-service';

describe('SessionService', () => {
  const mockRequest = {
    userId: 'user_123',
    address: '0x1234567890abcdef',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser',
  };

  beforeEach(() => {
    // Clear sessions before each test
    (SessionService as any).sessions.clear();
    (SessionService as any).userSessions.clear();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const session = await SessionService.createSession(mockRequest);
      
      expect(session).toBeDefined();
      expect(session.userId).toBe(mockRequest.userId);
      expect(session.address).toBe(mockRequest.address);
      expect(session.ipAddress).toBe(mockRequest.ipAddress);
      expect(session.userAgent).toBe(mockRequest.userAgent);
      expect(session.isActive).toBe(true);
      expect(session.sessionId).toMatch(/^session_\d+_[a-z0-9]+_[a-z0-9]+$/);
    });

    it('should set correct expiration time', async () => {
      const session = await SessionService.createSession(mockRequest);
      const expectedExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      expect(session.expiresAt.getTime()).toBeCloseTo(expectedExpiration.getTime(), -1000); // Within 1 second
    });
  });

  describe('getSession', () => {
    it('should retrieve an existing session', async () => {
      const createdSession = await SessionService.createSession(mockRequest);
      const retrievedSession = await SessionService.getSession(createdSession.sessionId);
      
      expect(retrievedSession).toEqual(createdSession);
    });

    it('should return null for non-existent session', async () => {
      const session = await SessionService.getSession('non-existent-session');
      expect(session).toBeNull();
    });

    it('should return null for expired session', async () => {
      const session = await SessionService.createSession(mockRequest);
      
      // Manually expire the session
      session.expiresAt = new Date(Date.now() - 1000);
      
      const retrievedSession = await SessionService.getSession(session.sessionId);
      expect(retrievedSession).toBeNull();
    });
  });

  describe('updateSessionActivity', () => {
    it('should update session activity timestamp', async () => {
      const session = await SessionService.createSession(mockRequest);
      const originalActivity = session.lastActivityAt;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updated = await SessionService.updateSessionActivity(session.sessionId);
      expect(updated).toBe(true);
      
      const updatedSession = await SessionService.getSession(session.sessionId);
      expect(updatedSession!.lastActivityAt.getTime()).toBeGreaterThan(originalActivity.getTime());
    });

    it('should return false for non-existent session', async () => {
      const updated = await SessionService.updateSessionActivity('non-existent');
      expect(updated).toBe(false);
    });
  });

  describe('extendSession', () => {
    it('should extend session expiration', async () => {
      const session = await SessionService.createSession(mockRequest);
      const originalExpiration = session.expiresAt;
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const extended = await SessionService.extendSession(session.sessionId);
      expect(extended).toBe(true);
      
      const extendedSession = await SessionService.getSession(session.sessionId);
      expect(extendedSession!.expiresAt.getTime()).toBeGreaterThan(originalExpiration.getTime());
    });
  });

  describe('invalidateSession', () => {
    it('should invalidate an existing session', async () => {
      const session = await SessionService.createSession(mockRequest);
      
      const invalidated = await SessionService.invalidateSession(session.sessionId);
      expect(invalidated).toBe(true);
      
      const retrievedSession = await SessionService.getSession(session.sessionId);
      expect(retrievedSession).toBeNull();
    });

    it('should return false for non-existent session', async () => {
      const invalidated = await SessionService.invalidateSession('non-existent');
      expect(invalidated).toBe(false);
    });
  });

  describe('invalidateUserSessions', () => {
    it('should invalidate all sessions for a user', async () => {
      // Create multiple sessions for the same user
      const session1 = await SessionService.createSession(mockRequest);
      const session2 = await SessionService.createSession({
        ...mockRequest,
        ipAddress: '192.168.1.2',
      });
      
      const invalidatedCount = await SessionService.invalidateUserSessions(mockRequest.userId);
      expect(invalidatedCount).toBe(2);
      
      const retrievedSession1 = await SessionService.getSession(session1.sessionId);
      const retrievedSession2 = await SessionService.getSession(session2.sessionId);
      
      expect(retrievedSession1).toBeNull();
      expect(retrievedSession2).toBeNull();
    });
  });

  describe('getUserSessions', () => {
    it('should return all active sessions for a user', async () => {
      const session1 = await SessionService.createSession(mockRequest);
      const session2 = await SessionService.createSession({
        ...mockRequest,
        ipAddress: '192.168.1.2',
      });
      
      const userSessions = await SessionService.getUserSessions(mockRequest.userId);
      expect(userSessions).toHaveLength(2);
      expect(userSessions.map(s => s.sessionId)).toContain(session1.sessionId);
      expect(userSessions.map(s => s.sessionId)).toContain(session2.sessionId);
    });

    it('should return empty array for user with no sessions', async () => {
      const userSessions = await SessionService.getUserSessions('non-existent-user');
      expect(userSessions).toEqual([]);
    });
  });

  describe('validateSession', () => {
    it('should validate an active session', async () => {
      const session = await SessionService.createSession(mockRequest);
      
      const { session: validatedSession, isValid } = await SessionService.validateSession(session.sessionId);
      
      expect(isValid).toBe(true);
      expect(validatedSession).toEqual(session);
    });

    it('should return invalid for non-existent session', async () => {
      const { isValid } = await SessionService.validateSession('non-existent');
      expect(isValid).toBe(false);
    });
  });

  describe('getSessionStats', () => {
    it('should return correct session statistics', async () => {
      await SessionService.createSession(mockRequest);
      await SessionService.createSession({
        ...mockRequest,
        userId: 'user_456',
        address: '0xabcdef1234567890',
      });
      
      const stats = SessionService.getSessionStats();
      
      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(2);
      expect(stats.totalUsers).toBe(2);
    });
  });
});