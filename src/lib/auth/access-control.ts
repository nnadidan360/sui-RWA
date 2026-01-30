import { UserRole, Permission, AccessControlConfig, User } from '@/types/auth';

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

export class AccessControl {
  private static instance: AccessControl;
  private config: AccessControlConfig;

  constructor(config?: AccessControlConfig) {
    this.config = config || this.getDefaultConfig();
  }

  private static getInstance(): AccessControl {
    if (!AccessControl.instance) {
      AccessControl.instance = new AccessControl();
    }
    return AccessControl.instance;
  }

  // Static methods for the test interface
  static hasRole(user: User | null, role: UserRole): boolean {
    if (!user || !user.isActive) {
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

    const userRoles = roleHierarchy[user.role] || [];
    return userRoles.includes(role);
  }

  static canPerformAction(user: User | null, action: string): boolean {
    if (!user || !user.isActive) {
      return false;
    }

    const instance = AccessControl.getInstance();
    const [resource, actionName] = action.split(':');
    
    return instance.hasPermission(user.role, resource, actionName, { owner: true });
  }

  static validateSession(user: User | null, requiredRole?: UserRole): void {
    if (!user) {
      throw new AccessControlError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    if (!user.isActive) {
      throw new AccessControlError({
        code: 'FORBIDDEN',
        message: 'Account is suspended'
      });
    }

    if (requiredRole && !AccessControl.hasRole(user, requiredRole)) {
      throw new AccessControlError({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
        details: {
          userRole: user.role,
          requiredRole: requiredRole
        }
      });
    }
  }

  static createSecureContext(user: User): Record<string, any> {
    return {
      userId: user.id,
      address: user.address,
      role: user.role,
      isActive: user.isActive,
      isAdmin: user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN,
      permissions: AccessControl.getUserPermissions(user)
    };
  }

  static sanitizeUser(user: User): Partial<User> {
    return {
      id: user.id,
      address: user.address,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    };
  }

  private static getUserPermissions(user: User): string[] {
    const instance = AccessControl.getInstance();
    const rolePermissions = instance.config.roles[user.role] || [];
    
    return rolePermissions.map(p => `${p.resource}:${p.action}`);
  }

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
          { resource: 'lending', action: 'read' },
          { resource: 'staking', action: 'read' },
        ],
        [UserRole.MODERATOR]: [
          { resource: 'assets', action: '*' },
          { resource: 'lending', action: 'read' },
          { resource: 'staking', action: 'read' },
          { resource: 'users', action: 'read' },
        ],
        [UserRole.USER]: [
          { resource: 'assets', action: 'read' },
          { resource: 'assets', action: 'create', conditions: { owner: true } },
          { resource: 'assets', action: 'update', conditions: { owner: true } },
          { resource: 'lending', action: '*', conditions: { owner: true } },
          { resource: 'staking', action: '*', conditions: { owner: true } },
        ],
        [UserRole.READONLY]: [
          { resource: 'assets', action: 'read' },
          { resource: 'lending', action: 'read' },
          { resource: 'staking', action: 'read' },
        ],
        [UserRole.LENDING_PROTOCOL]: [
          { resource: 'assets', action: '*' },
          { resource: 'lending', action: '*' },
          { resource: 'staking', action: '*' },
        ],
      },
      resources: ['assets', 'lending', 'staking', 'users', 'admin'],
      actions: ['create', 'read', 'update', 'delete'],
    };
  }
}