import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { asyncHandler, CustomError } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../middleware/auth-middleware';
import { JWTService } from '../services/auth/jwt-service';
import { SessionService } from '../services/auth/session-service';
import { AccessControlService } from '../services/auth/access-control-service';
import { logger } from '../utils/logger';
import { ApiResponse, LoginRequest, LoginResponse, RefreshTokenRequest } from '../types/api';

const router = Router();

// Validation schemas
const loginSchema = Joi.object({
  address: Joi.string().required(),
  signature: Joi.string().required(),
  message: Joi.string().required(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

/**
 * Login endpoint - authenticate user with email/phone/passkey
 */
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = loginSchema.validate(req.body);
  
  if (error) {
    throw new CustomError('Invalid request data', 400);
  }

  const { address, signature, message }: LoginRequest = value;
  const ipAddress = req.ip || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';

  logger.info('Login attempt', { address, ipAddress });

  try {
    // TODO: Verify signature against message and address
    // For now, we'll simulate successful verification
    const isValidSignature = signature.length > 0; // Placeholder validation
    
    if (!isValidSignature) {
      throw new CustomError('Invalid signature', 401);
    }

    // Create or get user (simplified for now)
    const userId = `user_${address}`;
    
    // Create session
    const session = await SessionService.createSession({
      userId,
      address,
      ipAddress,
      userAgent,
      signature,
    });

    // Generate tokens
    const accessToken = JWTService.generateAccessToken(userId, address, session.sessionId);
    const refreshToken = JWTService.generateRefreshToken(userId, session.sessionId);

    // Create user object for response
    const user = {
      id: userId,
      address,
      profile: {
        displayName: address.substring(0, 8) + '...',
        preferences: {
          language: 'en',
          theme: 'light' as const,
          notifications: {
            email: false,
            push: false,
            sms: false,
          },
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        token: accessToken,
        refreshToken,
        user,
        expiresIn: 3600, // 1 hour
      },
      timestamp: new Date().toISOString(),
    };

    logger.info('Login successful', { userId, address });
    res.json(response);

  } catch (error) {
    logger.error('Login failed', { address, error: (error as Error).message });
    throw error;
  }
}));

/**
 * Refresh token endpoint
 */
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = refreshTokenSchema.validate(req.body);
  
  if (error) {
    throw new CustomError('Invalid request data', 400);
  }

  const { refreshToken }: RefreshTokenRequest = value;

  try {
    // Verify refresh token
    const payload = JWTService.verifyRefreshToken(refreshToken);
    
    // Validate session
    const { session, isValid } = await SessionService.validateSession(payload.sessionId);
    
    if (!isValid || !session) {
      throw new CustomError('Invalid session', 401);
    }

    // Generate new access token
    const newAccessToken = JWTService.generateAccessToken(
      session.userId,
      session.address,
      session.sessionId
    );

    const response: ApiResponse<{ token: string; expiresIn: number }> = {
      success: true,
      data: {
        token: newAccessToken,
        expiresIn: 3600, // 1 hour
      },
      timestamp: new Date().toISOString(),
    };

    logger.info('Token refreshed', { userId: session.userId });
    res.json(response);

  } catch (error) {
    logger.error('Token refresh failed', { error: (error as Error).message });
    throw error;
  }
}));

/**
 * Logout endpoint
 */
router.post('/logout', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = JWTService.extractTokenFromHeader(authHeader);
    
    if (token) {
      const payload = JWTService.verifyAccessToken(token);
      await SessionService.invalidateSession(payload.sessionId);
      
      logger.info('User logged out', { userId: payload.id });
    }

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: {
        message: 'Logged out successfully',
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);

  } catch (error) {
    // Even if token verification fails, we still return success for logout
    logger.warn('Logout with invalid token', { error: (error as Error).message });
    
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: {
        message: 'Logged out successfully',
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  }
}));

/**
 * Get current user profile
 */
router.get('/me', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  // Get user session details
  const authHeader = req.headers.authorization;
  const token = JWTService.extractTokenFromHeader(authHeader);
  
  if (!token) {
    throw new CustomError('Invalid token', 401);
  }

  const payload = JWTService.verifyAccessToken(token);
  const { session } = await SessionService.validateSession(payload.sessionId);

  if (!session) {
    throw new CustomError('Invalid session', 401);
  }

  const user = {
    id: req.user.id,
    address: req.user.address,
    profile: {
      displayName: req.user.address.substring(0, 8) + '...',
      preferences: {
        language: 'en',
        theme: 'light' as const,
        notifications: {
          email: false,
          push: false,
          sms: false,
        },
      },
    },
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.lastActivityAt.toISOString(),
  };

  const response: ApiResponse<typeof user> = {
    success: true,
    data: user,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

/**
 * Get user sessions
 */
router.get('/sessions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  const sessions = await SessionService.getUserSessions(req.user.id);
  
  const sanitizedSessions = sessions.map(session => ({
    id: session.id,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    createdAt: session.createdAt.toISOString(),
    lastActivityAt: session.lastActivityAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  }));

  const response: ApiResponse<typeof sanitizedSessions> = {
    success: true,
    data: sanitizedSessions,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

/**
 * Logout from all sessions
 */
router.post('/logout-all', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  const invalidatedCount = await SessionService.invalidateUserSessions(req.user.id);
  
  logger.info('User logged out from all sessions', { 
    userId: req.user.id, 
    sessionsInvalidated: invalidatedCount 
  });

  const response: ApiResponse<{ message: string; sessionsInvalidated: number }> = {
    success: true,
    data: {
      message: 'Logged out from all sessions successfully',
      sessionsInvalidated: invalidatedCount,
    },
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

export default router;