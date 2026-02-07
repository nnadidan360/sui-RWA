import { Router, Response } from 'express';
import Joi from 'joi';
import { asyncHandler, CustomError } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../middleware/auth-middleware';
import { UserService } from '../services/database/user-service';
import { logger } from '../utils/logger';
import { ApiResponse, PaginatedResponse } from '../types/api';

const router = Router();

// Validation schemas
const createUserSchema = Joi.object({
  authMethod: Joi.object({
    type: Joi.string().valid('email', 'phone', 'passkey').required(),
    identifier: Joi.string().required()
  }).required(),
  deviceFingerprint: Joi.object({
    deviceId: Joi.string().required(),
    browserFingerprint: Joi.string().required(),
    ipAddress: Joi.string().required(),
    geolocation: Joi.object({
      country: Joi.string().optional(),
      region: Joi.string().optional(),
      city: Joi.string().optional()
    }).optional(),
    screenResolution: Joi.string().optional(),
    timezone: Joi.string().optional(),
    userAgent: Joi.string().required()
  }).optional(),
  profile: Joi.object({
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    country: Joi.string().optional(),
    phoneNumber: Joi.string().optional(),
  }).optional(),
});

const updateUserSchema = Joi.object({
  email: Joi.string().email().optional(),
  profile: Joi.object({
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    country: Joi.string().optional(),
    phoneNumber: Joi.string().optional(),
    occupation: Joi.string().optional(),
  }).optional(),
  preferences: Joi.object({
    theme: Joi.string().valid('light', 'dark', 'system').optional(),
    language: Joi.string().optional(),
    currency: Joi.string().optional(),
    notifications: Joi.object({
      email: Joi.boolean().optional(),
      push: Joi.boolean().optional(),
      sms: Joi.boolean().optional(),
      transactionAlerts: Joi.boolean().optional(),
      marketingEmails: Joi.boolean().optional(),
    }).optional(),
  }).optional(),
});

/**
 * Get current user profile
 */
router.get('/me', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  const user = await UserService.getUserById(req.user.id);
  
  if (!user) {
    throw new CustomError('User not found', 404);
  }

  // Remove sensitive data
  const sanitizedUser = {
    id: user._id,
    internalUserId: user.internalUserId,
    authMethods: user.authMethods,
    email: user.email,
    profile: user.profile,
    preferences: user.preferences,
    kyc: {
      status: user.kyc.status,
      level: user.kyc.level,
    },
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  const response: ApiResponse<typeof sanitizedUser> = {
    success: true,
    data: sanitizedUser,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

/**
 * Update current user profile
 */
router.put('/me', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  const { error, value } = updateUserSchema.validate(req.body);
  
  if (error) {
    throw new CustomError('Invalid request data', 400);
  }

  const updatedUser = await UserService.updateUser(req.user.id, value);
  
  if (!updatedUser) {
    throw new CustomError('User not found', 404);
  }

  // Log activity
  await UserService.logActivity(
    req.user.id,
    'profile_updated',
    { updatedFields: Object.keys(value) },
    req.ip,
    req.get('User-Agent')
  );

  const sanitizedUser = {
    id: updatedUser._id,
    internalUserId: updatedUser.internalUserId,
    authMethods: updatedUser.authMethods,
    email: updatedUser.email,
    profile: updatedUser.profile,
    preferences: updatedUser.preferences,
    kyc: {
      status: updatedUser.kyc.status,
      level: updatedUser.kyc.level,
    },
    role: updatedUser.role,
    createdAt: updatedUser.createdAt,
    updatedAt: updatedUser.updatedAt,
  };

  const response: ApiResponse<typeof sanitizedUser> = {
    success: true,
    data: sanitizedUser,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

/**
 * Get user by internal ID (public endpoint)
 */
router.get('/internal/:internalUserId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { internalUserId } = req.params;
  
  const user = await UserService.getUserByInternalId(internalUserId);
  
  if (!user) {
    throw new CustomError('User not found', 404);
  }

  // Return only public information
  const publicUser = {
    id: user._id,
    internalUserId: user.internalUserId,
    profile: {
      firstName: user.profile.firstName,
      lastName: user.profile.lastName,
    },
    createdAt: user.createdAt,
  };

  const response: ApiResponse<typeof publicUser> = {
    success: true,
    data: publicUser,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

/**
 * Add authentication method
 */
router.post('/me/auth-methods', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  const schema = Joi.object({
    type: Joi.string().valid('email', 'phone', 'passkey').required(),
    identifier: Joi.string().required(),
  });

  const { error, value } = schema.validate(req.body);
  
  if (error) {
    throw new CustomError('Invalid request data', 400);
  }

  const updatedUser = await UserService.addAuthMethod(req.user.id, value);
  
  if (!updatedUser) {
    throw new CustomError('User not found', 404);
  }

  // Log activity
  await UserService.logActivity(
    req.user.id,
    'auth_method_added',
    { authMethodType: value.type, identifier: value.identifier },
    req.ip,
    req.get('User-Agent')
  );

  const response: ApiResponse<{ message: string }> = {
    success: true,
    data: { message: 'Wallet connected successfully' },
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

/**
 * Get user activity log
 */
router.get('/me/activity', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  const user = await UserService.getUserById(req.user.id);
  
  if (!user) {
    throw new CustomError('User not found', 404);
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const activities = user.activityLog
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(skip, skip + limit);

  const total = user.activityLog.length;
  const totalPages = Math.ceil(total / limit);

  const response: ApiResponse<{ activities: typeof activities; pagination: any }> = {
    success: true,
    data: {
      activities,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    },
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

/**
 * Search users (admin only)
 */
router.get('/search', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new CustomError('Admin access required', 403);
  }

  const query = req.query.q as string;
  
  if (!query || query.length < 3) {
    throw new CustomError('Search query must be at least 3 characters', 400);
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const { users, total } = await UserService.searchUsers(query, { page, limit });

  const totalPages = Math.ceil(total / limit);

  const response: ApiResponse<{ users: typeof users; pagination: any }> = {
    success: true,
    data: {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    },
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

export default router;