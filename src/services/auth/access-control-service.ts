/**
 * Access Control Service for Backend
 * 
 * Handles role-based access control and permissions
 */

import { User } from '../../types/entities';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  VERIFIER = 'verifier',
  MODERATOR = 'moderator',
  USER = 'user',
  READONLY = 'readonly',
  LENDING_PROTOCOL = 'lending_protocol'
}

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface AccessControlConfig {
  roles: Record<UserRole, Permission[]>;
  resources: string[];
  actions: string[];
}

export class AccessControlError extends Error {
  public details: {
    code: string;
    message: string;
    [key: string]: any;
  };

  constructor(details: { code: string; message: string; [key: string]: any }) {
    super(details.message);
    this.name = 'AccessControlError';
    this.details = details;
  }
}

export class AccessControlService {
  private static instance: AccessControlService;
  private config: AccessControlConfig;

  constructor(config?: AccessControlConfig) {
    this.config = config || this.getDefaultConfig();
  }

  private static getInstance(): AccessControlService {
    if (!AccessControlService.instance) {
      AccessControlService.instance = new AccessControlService();
    }
    return AccessControlService.instance;
  }

  /**
   * Check if user has a specific role
   */
  static hasRole(user: User | null, role: UserRole): boolean {
    if (!user) {
      return false;
    }

    const roleHierarchy = {
      [UserRole.SUPER_ADMIN]: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER],
      [UserRole.ADMIN]: [UserRole.ADMIN, UserRole.USER],
      [UserRole.USER]: [UserRole.USER],
      [UserRole.VERIFIER]: [UserRole.VERIFIER, UserRole.USER],
      [UserRole.MODERATOR]: [UserRole.MODERATOR, UserRole.USER],
      [UserRole.READONLY]: [UserRole.READONLY],
      [UserRole.LENDING_PROTOCOL]: [UserRole.LENDING_PROTOCOL],
    };

    // Convert user role string to enum if needed
    const userRole = user.profile?.role || UserRole.USER;
    const userRoles = roleHierarchy[userRole as UserRole] || [];
    return userRoles.includes(role);
  }

  /**
   * Check if user can perform a specific action
   */
  static canPerformAction(user: User | null, action: string, context?: Record<string, any>): boolean {
    if (!user) {
      return false;
    }

    const instance = AccessControlService.getInstance();
    const [resource, actionName] = action.split(':');
    
    const userRole = user.profile?.role as UserRole || UserRole.USER;
    return instance.hasPermission(userRole, resource, actionName, context);
  }

  /**
   * Validate user session and permissions
   */
  static validateSession(user: User | null, requiredRole?: UserRole): void {
    if (!user) {
      throw new AccessControlError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    if (requiredRole && !AccessControlService.hasRole(user, requiredRole)) {
      throw new AccessControlError({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
        details: {
          userRole: user.profile?.role,
          requiredRole: requiredRole
        }
      });
    }
  }

  /**
   * Create secure context for user
   */
  static createSecureContext(user: User): Record<string, any> {
    return {
      userId: user.id,
      address: user.address,
      role: user.profile?.role || UserRole.USER,
      isAdmin: AccessControlService.hasRole(user, UserRole.ADMIN),
      permissions: AccessControlService.getUserPermissions(user)
    };
  }

  /**
   * Sanitize user data for API responses
   */
  static sanitizeUser(user: User): Partial<User> {
    return {
      id: user.id,
      address: user.address,
      profile: {
        ...user.profile,
        // Remove sensitive data if any
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  /**
   * Get user permissions
   */
  private static getUserPermissions(user: User): string[] {
    const instance = AccessControlService.getInstance();
    const userRole = user.profile?.role as UserRole || UserRole.USER;
    const rolePermissions = instance.config.roles[userRole] || [];
    
    return rolePermissions.map(p => `${p.resource}:${p.action}`);
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(
    userRole: UserRole,
    resource: string,
    action: string,
    context?: Record<string, any>
  ): boolean {
    const rolePermissions = this.config.roles[userRole] || [];
    
    return rolePermissions.some(permission => {
      if (permission.resource !== resource && permission.resource !== '*') {
        return false;
      }
      
      if (permission.action !== action && permission.action !== '*') {
        return false;
      }
      
      // Check conditions if present
      if (permission.conditions) {
        if (!context) {
          return false; // No context provided but conditions required
        }
        return this.evaluateConditions(permission.conditions, context);
      }
      
      return true;
    });
  }

  /**
   * Evaluate permission conditions
   */
  private evaluateConditions(
    conditions: Record<string, any>,
    context: Record<string, any>
  ): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      if (context[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get default access control configuration
   */
  private getDefaultConfig(): AccessControlConfig {
    return {
      roles: {
        [UserRole.ADMIN]: [
          { resource: '*', action: '*' },
        ],
        [UserRole.SUPER_ADMIN]: [
          { resource: '*', action: '*' },
        ],
        [UserRole.VERIFIER]: [
          { resource: 'assets', action: '*' },
          { resource: 'loans', action: 'read' },
          { resource: 'staking', action: 'read' },
        ],
        [UserRole.MODERATOR]: [
          { resource: 'assets', action: '*' },
          { resource: 'loans', action: 'read' },
          { resource: 'staking', action: 'read' },
          { resource: 'users', action: 'read' },
        ],
        [UserRole.USER]: [
          { resource: 'assets', action: 'read' },
          { resource: 'assets', action: 'create', conditions: { owner: true } },
          { resource: 'assets', action: 'update', conditions: { owner: true } },
          { resource: 'loans', action: '*', conditions: { owner: true } },
          { resource: 'staking', action: '*', conditions: { owner: true } },
        ],
        [UserRole.READONLY]: [
          { resource: 'assets', action: 'read' },
          { resource: 'loans', action: 'read' },
          { resource: 'staking', action: 'read' },
        ],
        [UserRole.LENDING_PROTOCOL]: [
          { resource: 'assets', action: '*' },
          { resource: 'loans', action: '*' },
          { resource: 'staking', action: '*' },
        ],
      },
      resources: ['assets', 'loans', 'staking', 'users', 'admin'],
      actions: ['create', 'read', 'update', 'delete'],
    };
  }
}