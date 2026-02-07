/**
 * JWT Authentication Service for Backend
 * 
 * Handles JWT token generation, validation, and refresh for user authentication
 */

import jwt from 'jsonwebtoken';
import { ApiResponse } from '../../types/api';

export interface JWTPayload {
  id: string;
  address: string;
  role?: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  id: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export class JWTAuthenticationError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string, statusCode: number = 401) {
    super(message);
    this.name = 'JWTAuthenticationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class JWTService {
  private static readonly ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'rwa-lending-access-secret-key';
  private static readonly REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'rwa-lending-refresh-secret-key';
  private static readonly ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || '1h';
  private static readonly REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  /**
   * Generate access token for authenticated user
   */
  static generateAccessToken(userId: string, address: string, sessionId: string, role?: string): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      id: userId,
      address,
      role,
      sessionId
    };

    return jwt.sign(payload, this.ACCESS_TOKEN_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'rwa-lending-protocol',
      audience: 'rwa-lending-app'
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token for session management
   */
  static generateRefreshToken(userId: string, sessionId: string): string {
    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      id: userId,
      sessionId
    };

    return jwt.sign(payload, this.REFRESH_TOKEN_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: 'rwa-lending-protocol',
      audience: 'rwa-lending-app'
    } as jwt.SignOptions);
  }

  /**
   * Verify and decode access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.ACCESS_TOKEN_SECRET, {
        issuer: 'rwa-lending-protocol',
        audience: 'rwa-lending-app'
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new JWTAuthenticationError(
          'Access token has expired',
          'TOKEN_EXPIRED',
          401
        );
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        throw new JWTAuthenticationError(
          'Invalid access token',
          'INVALID_TOKEN',
          401
        );
      }

      throw new JWTAuthenticationError(
        'Token verification failed',
        'VERIFICATION_FAILED',
        401
      );
    }
  }

  /**
   * Verify and decode refresh token
   */
  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, this.REFRESH_TOKEN_SECRET, {
        issuer: 'rwa-lending-protocol',
        audience: 'rwa-lending-app'
      }) as RefreshTokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new JWTAuthenticationError(
          'Refresh token has expired',
          'REFRESH_TOKEN_EXPIRED',
          401
        );
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        throw new JWTAuthenticationError(
          'Invalid refresh token',
          'INVALID_REFRESH_TOKEN',
          401
        );
      }

      throw new JWTAuthenticationError(
        'Refresh token verification failed',
        'REFRESH_VERIFICATION_FAILED',
        401
      );
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) {
      return true;
    }
    return Date.now() >= expiration.getTime();
  }

  /**
   * Generate session ID
   */
  static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Validate token format
   */
  static isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    return parts.length === 3;
  }

  /**
   * Get token payload without verification (for debugging)
   */
  static decodeTokenUnsafe(token: string): any {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }
}