import { Request, Response, NextFunction } from 'express';
import { CustomError } from './error-handler';
import { JWTService } from '../services/auth/jwt-service';
import { SessionService } from '../services/auth/session-service';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    address: string;
    role?: string;
    sessionId: string;
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new CustomError('Access token required', 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!process.env.JWT_SECRET) {
      throw new CustomError('JWT secret not configured', 500);
    }

    // Verify JWT token
    const decoded = JWTService.verifyAccessToken(token);
    
    // Validate session
    const { session, isValid } = await SessionService.validateSession(decoded.sessionId);
    
    if (!isValid || !session) {
      throw new CustomError('Invalid or expired session', 401);
    }

    // Update session activity
    await SessionService.updateSessionActivity(decoded.sessionId);
    
    req.user = {
      id: decoded.id,
      address: decoded.address,
      role: decoded.role,
      sessionId: decoded.sessionId,
    };

    next();
  } catch (error) {
    if (error instanceof CustomError) {
      next(error);
    } else {
      logger.warn('Authentication failed:', (error as Error).message);
      next(new CustomError('Authentication failed', 401));
    }
  }
};

export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (process.env.JWT_SECRET) {
        try {
          const decoded = JWTService.verifyAccessToken(token);
          const { session, isValid } = await SessionService.validateSession(decoded.sessionId);
          
          if (isValid && session) {
            await SessionService.updateSessionActivity(decoded.sessionId);
            req.user = {
              id: decoded.id,
              address: decoded.address,
              role: decoded.role,
              sessionId: decoded.sessionId,
            };
          }
        } catch (error) {
          // For optional auth, we don't throw errors, just continue without user
          logger.debug('Optional auth failed:', (error as Error).message);
        }
      }
    }
    
    next();
  } catch (error) {
    // For optional auth, we don't throw errors, just continue without user
    logger.debug('Optional auth middleware error:', (error as Error).message);
    next();
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new CustomError('Authentication required', 401);
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      throw new CustomError('Insufficient permissions', 403);
    }

    next();
  };
};