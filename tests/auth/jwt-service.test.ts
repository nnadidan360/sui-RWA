/**
 * JWT Service Tests
 */

import { JWTService, JWTAuthenticationError } from '../../src/services/auth/jwt-service';

describe('JWTService', () => {
  const mockUserId = 'user_123';
  const mockAddress = '0x1234567890abcdef';
  const mockSessionId = 'session_123';

  beforeAll(() => {
    // Set test environment variables
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = JWTService.generateAccessToken(mockUserId, mockAddress, mockSessionId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(JWTService.isValidTokenFormat(token)).toBe(true);
    });

    it('should generate different tokens for different users', () => {
      const token1 = JWTService.generateAccessToken('user1', 'address1', 'session1');
      const token2 = JWTService.generateAccessToken('user2', 'address2', 'session2');
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = JWTService.generateRefreshToken(mockUserId, mockSessionId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(JWTService.isValidTokenFormat(token)).toBe(true);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = JWTService.generateAccessToken(mockUserId, mockAddress, mockSessionId);
      const payload = JWTService.verifyAccessToken(token);
      
      expect(payload.id).toBe(mockUserId);
      expect(payload.address).toBe(mockAddress);
      expect(payload.sessionId).toBe(mockSessionId);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        JWTService.verifyAccessToken('invalid-token');
      }).toThrow(JWTAuthenticationError);
    });

    it('should throw error for malformed token', () => {
      expect(() => {
        JWTService.verifyAccessToken('not.a.valid.jwt.token');
      }).toThrow(JWTAuthenticationError);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = JWTService.generateRefreshToken(mockUserId, mockSessionId);
      const payload = JWTService.verifyRefreshToken(token);
      
      expect(payload.id).toBe(mockUserId);
      expect(payload.sessionId).toBe(mockSessionId);
    });

    it('should throw error for invalid refresh token', () => {
      expect(() => {
        JWTService.verifyRefreshToken('invalid-token');
      }).toThrow(JWTAuthenticationError);
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'test-token';
      const header = `Bearer ${token}`;
      
      expect(JWTService.extractTokenFromHeader(header)).toBe(token);
    });

    it('should return null for invalid header format', () => {
      expect(JWTService.extractTokenFromHeader('Invalid header')).toBeNull();
      expect(JWTService.extractTokenFromHeader('Bearer')).toBeNull();
      expect(JWTService.extractTokenFromHeader('')).toBeNull();
      expect(JWTService.extractTokenFromHeader(undefined)).toBeNull();
    });
  });

  describe('isValidTokenFormat', () => {
    it('should validate JWT token format', () => {
      const validToken = JWTService.generateAccessToken(mockUserId, mockAddress, mockSessionId);
      expect(JWTService.isValidTokenFormat(validToken)).toBe(true);
    });

    it('should reject invalid token formats', () => {
      expect(JWTService.isValidTokenFormat('invalid')).toBe(false);
      expect(JWTService.isValidTokenFormat('not.enough.parts')).toBe(false);
      expect(JWTService.isValidTokenFormat('')).toBe(false);
      expect(JWTService.isValidTokenFormat(null as any)).toBe(false);
    });
  });

  describe('generateSessionId', () => {
    it('should generate unique session IDs', () => {
      const id1 = JWTService.generateSessionId();
      const id2 = JWTService.generateSessionId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^session_\d+_[a-z0-9]+$/);
    });
  });
});