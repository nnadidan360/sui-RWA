/**
 * User Database Service
 * 
 * Handles all database operations for users
 */

import { User, IUser } from '../../models/User';
import { ApiResponse, PaginatedResponse, PaginationParams } from '../../types/api';
import { logger } from '../../utils/logger';

export interface CreateUserRequest {
  authMethod: {
    type: 'email' | 'phone' | 'passkey';
    identifier: string; // email address, phone number, or passkey ID
  };
  deviceFingerprint?: {
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
  };
  profile?: Partial<IUser['profile']>;
  preferences?: Partial<IUser['preferences']>;
}

export interface UpdateUserRequest {
  email?: string;
  profile?: Partial<IUser['profile']>;
  preferences?: Partial<IUser['preferences']>;
  kyc?: Partial<IUser['kyc']>;
  financialProfile?: Partial<IUser['financialProfile']>;
}

export class UserService {
  /**
   * Create a new user with account abstraction
   */
  static async createUser(data: CreateUserRequest): Promise<IUser> {
    try {
      // Check if user already exists with this auth method
      const existingUser = await User.findOne({ 
        'authMethods.identifier': data.authMethod.identifier,
        'authMethods.type': data.authMethod.type,
        isActive: true 
      });
      
      if (existingUser) {
        throw new Error(`User with this ${data.authMethod.type} already exists`);
      }

      // Generate internal user ID
      const internalUserId = require('crypto').randomUUID();

      const user = new User({
        internalUserId,
        authMethods: [{
          type: data.authMethod.type,
          identifier: data.authMethod.identifier,
          verified: false,
          lastUsed: new Date(),
          isActive: true
        }],
        deviceFingerprints: data.deviceFingerprint ? [data.deviceFingerprint] : [],
        activeSessions: [],
        email: data.authMethod.type === 'email' ? data.authMethod.identifier : undefined,
        profile: data.profile || {},
        preferences: {
          ...data.preferences,
          theme: data.preferences?.theme || 'system',
          language: data.preferences?.language || 'en',
          currency: data.preferences?.currency || 'USD',
          notifications: {
            email: true,
            push: true,
            sms: false,
            transactionAlerts: true,
            marketingEmails: false,
            ...data.preferences?.notifications,
          },
          privacy: {
            profileVisibility: 'private',
            activityVisibility: 'private',
            ...data.preferences?.privacy,
          },
        },
        fraudSignals: [],
        assetIntelligence: [],
      });

      await user.save();
      
      logger.info('User created with account abstraction', { 
        userId: user._id, 
        internalUserId: user.internalUserId,
        authMethod: data.authMethod.type 
      });
      return user;
    } catch (error:any) {
      logger.error('Failed to create user', { 
        error: error.message, 
        authMethod: data.authMethod 
      });
      throw error;
    }
  }

  /**
   * Get user by internal ID (replaces wallet address lookup)
   */
  static async getUserByInternalId(internalUserId: string): Promise<IUser | null> {
    try {
      const user = await User.findOne({ 
        internalUserId,
        isActive: true 
      });
      
      return user;
    } catch (error:any) {
      logger.error('Failed to get user by internal ID', { error: error.message, internalUserId });
      throw error;
    }
  }

  /**
   * Get user by authentication method
   */
  static async getUserByAuthMethod(type: 'email' | 'phone' | 'passkey', identifier: string): Promise<IUser | null> {
    try {
      const user = await User.findOne({ 
        'authMethods.type': type,
        'authMethods.identifier': identifier,
        'authMethods.isActive': true,
        isActive: true 
      });
      
      return user;
    } catch (error:any) {
      logger.error('Failed to get user by auth method', { error: error.message, type, identifier });
      throw error;
    }
  }

  /**
   * Get user by session token
   */
  static async getUserBySession(sessionId: string): Promise<IUser | null> {
    try {
      const user = await User.findOne({ 
        'activeSessions.sessionId': sessionId,
        'activeSessions.isActive': true,
        isActive: true 
      });
      
      if (user && !user.validateSession(sessionId)) {
        await user.save(); // Save session state changes
        return null;
      }
      
      return user;
    } catch (error:any) {
      logger.error('Failed to get user by session', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<IUser | null> {
    try {
      const user = await User.findById(userId);
      return user;
    } catch (error:any) {
      logger.error('Failed to get user by ID', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update user
   */
  static async updateUser(userId: string, data: UpdateUserRequest): Promise<IUser | null> {
    try {
      const updateData: any = {};
      
      if (data.email) {
        updateData.email = data.email.toLowerCase();
      }
      
      if (data.profile) {
        updateData.$set = { ...updateData.$set };
        Object.keys(data.profile).forEach(key => {
          updateData.$set[`profile.${key}`] = data.profile![key as keyof typeof data.profile];
        });
      }
      
      if (data.preferences) {
        updateData.$set = { ...updateData.$set };
        Object.keys(data.preferences).forEach(key => {
          updateData.$set[`preferences.${key}`] = data.preferences![key as keyof typeof data.preferences];
        });
      }
      
      if (data.kyc) {
        updateData.$set = { ...updateData.$set };
        Object.keys(data.kyc).forEach(key => {
          updateData.$set[`kyc.${key}`] = data.kyc![key as keyof typeof data.kyc];
        });
      }
      
      if (data.financialProfile) {
        updateData.$set = { ...updateData.$set };
        Object.keys(data.financialProfile).forEach(key => {
          updateData.$set[`financialProfile.${key}`] = data.financialProfile![key as keyof typeof data.financialProfile];
        });
      }

      const user = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      );

      if (user) {
        logger.info('User updated', { userId });
      }

      return user;
    } catch (error:any) {
      logger.error('Failed to update user', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get users with pagination
   */
  static async getUsers(params: PaginationParams & { 
    role?: string;
    kycStatus?: string;
    isActive?: boolean;
  }): Promise<{ users: IUser[]; total: number }> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        role,
        kycStatus,
        isActive = true,
      } = params;

      const filter: any = { isActive };
      
      if (role) {
        filter.role = role;
      }
      
      if (kycStatus) {
        filter['kyc.status'] = kycStatus;
      }

      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        User.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .select('-security.passwordHash -security.twoFactorSecret'),
        User.countDocuments(filter),
      ]);

      return { users, total };
    } catch (error:any) {
      logger.error('Failed to get users', { error: error.message, params });
      throw error;
    }
  }

  /**
   * Add authentication method to existing user
   */
  static async addAuthMethod(
    userId: string,
    authMethod: {
      type: 'email' | 'phone' | 'passkey';
      identifier: string;
    }
  ): Promise<IUser | null> {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      // Check if auth method already exists
      const existingAuth = user.authMethods.find(
        (am: any) => am.type === authMethod.type && am.identifier === authMethod.identifier
      );
      
      if (existingAuth) {
        throw new Error(`${authMethod.type} already registered for this user`);
      }

      user.addAuthMethod(authMethod.type, authMethod.identifier);
      await user.save();

      logger.info('Auth method added', { userId, authMethodType: authMethod.type });
      return user;
    } catch (error:any) {
      logger.error('Failed to add auth method', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Verify authentication method
   */
  static async verifyAuthMethod(userId: string, identifier: string): Promise<IUser | null> {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      user.verifyAuthMethod(identifier);
      await user.save();

      logger.info('Auth method verified', { userId, identifier });
      return user;
    } catch (error:any) {
      logger.error('Failed to verify auth method', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Create user session
   */
  static async createSession(
    userId: string, 
    deviceFingerprint: any,
    expirationHours: number = 24
  ): Promise<{ user: IUser; sessionId: string } | null> {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      // Add device fingerprint if new
      const existingDevice = user.deviceFingerprints.find(
        (df: any) => df.deviceId === deviceFingerprint.deviceId
      );
      
      if (!existingDevice) {
        user.addDeviceFingerprint(deviceFingerprint);
      }

      const sessionId = user.createSession(deviceFingerprint.deviceId, expirationHours);
      await user.save();

      logger.info('Session created', { userId, sessionId, deviceId: deviceFingerprint.deviceId });
      return { user, sessionId };
    } catch (error:any) {
      logger.error('Failed to create session', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Log user activity
   */
  static async logActivity(
    userId: string,
    action: string,
    details: Record<string, any> = {},
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, {
        $push: {
          activityLog: {
            $each: [{
              action,
              timestamp: new Date(),
              ipAddress,
              userAgent,
              details,
            }],
            $slice: -1000, // Keep only last 1000 activities
          },
        },
      });
    } catch (error:any) {
      logger.error('Failed to log user activity', { error: error.message, userId, action });
      // Don't throw error for activity logging failures
    }
  }

  /**
   * Deactivate user
   */
  static async deactivateUser(userId: string): Promise<boolean> {
    try {
      const result = await User.findByIdAndUpdate(
        userId,
        { isActive: false },
        { new: true }
      );

      if (result) {
        logger.info('User deactivated', { userId });
        return true;
      }

      return false;
    } catch (error:any) {
      logger.error('Failed to deactivate user', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Search users (removed wallet address search)
   */
  static async searchUsers(
    query: string,
    params: PaginationParams
  ): Promise<{ users: IUser[]; total: number }> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = params;

      const searchFilter = {
        isActive: true,
        $or: [
          { internalUserId: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
          { 'profile.firstName': { $regex: query, $options: 'i' } },
          { 'profile.lastName': { $regex: query, $options: 'i' } },
          { 'authMethods.identifier': { $regex: query, $options: 'i' } },
        ],
      };

      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        User.find(searchFilter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .select('-security.passwordHash -security.twoFactorSecret'),
        User.countDocuments(searchFilter),
      ]);

      return { users, total };
    } catch (error:any) {
      logger.error('Failed to search users', { error: error.message, query });
      throw error;
    }
  }
}