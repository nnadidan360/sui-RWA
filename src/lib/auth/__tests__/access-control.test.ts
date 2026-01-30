/**
 * Property-based tests for Access Control system
 * **Feature: rwa-lending-protocol, Property 23: Administrative access control**
 * **Validates: Requirements 6.1**
 * 
 * **Feature: rwa-lending-protocol, Property 21: Error message generation**
 * **Validates: Requirements 5.4**
 */

import { AccessControl, AccessControlError } from '../access-control';
import { User, UserRole } from '@/types/auth';

// Mock user generator for property tests
function generateMockUser(
  id: string,
  role: UserRole,
  isActive: boolean = true
): User {
  return {
    id,
    address: `0x${id.padStart(64, '0')}`,
    role,
    isActive,
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };
}

describe('Access Control Property Tests', () => {
  /**
   * Property: Role hierarchy should be consistently enforced
   * For any user with a given role, they should have access to all lower-level permissions
   */
  describe('Role Hierarchy Property', () => {
    test.each([
      [UserRole.SUPER_ADMIN, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER]],
      [UserRole.ADMIN, [UserRole.ADMIN, UserRole.USER]],
      [UserRole.USER, [UserRole.USER]],
    ])('user with %s role should have access to %j roles', (userRole, expectedRoles) => {
      const user = generateMockUser('test-user', userRole);
      
      expectedRoles.forEach(role => {
        expect(AccessControl.hasRole(user, role)).toBe(true);
      });
      
      // Should not have access to higher roles
      const allRoles = [UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN];
      const higherRoles = allRoles.filter(role => !expectedRoles.includes(role));
      
      higherRoles.forEach(role => {
        expect(AccessControl.hasRole(user, role)).toBe(false);
      });
    });
  });

  /**
   * Property: Inactive users should never have access regardless of role
   */
  describe('Inactive User Property', () => {
    test.each([
      UserRole.USER,
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
    ])('inactive user with %s role should have no access', (role) => {
      const inactiveUser = generateMockUser('inactive-user', role, false);
      
      // Should not have access to any role
      expect(AccessControl.hasRole(inactiveUser, UserRole.USER)).toBe(false);
      expect(AccessControl.hasRole(inactiveUser, UserRole.ADMIN)).toBe(false);
      expect(AccessControl.hasRole(inactiveUser, UserRole.SUPER_ADMIN)).toBe(false);
      
      // Should not be able to perform any actions
      expect(AccessControl.canPerformAction(inactiveUser, 'asset:create')).toBe(false);
      expect(AccessControl.canPerformAction(inactiveUser, 'risk:update_parameters')).toBe(false);
    });
  });

  /**
   * Property: Permission system should be consistent with role assignments
   */
  describe('Permission Consistency Property', () => {
    const testCases = [
      {
        role: UserRole.USER,
        allowedActions: ['assets:create', 'lending:read', 'staking:read'],
        deniedActions: ['assets:delete', 'users:read'],
      },
      {
        role: UserRole.ADMIN,
        allowedActions: ['assets:create', 'assets:delete', 'users:create', 'users:delete'],
        deniedActions: [], // Admins can do most things except super admin exclusive actions
      },
      {
        role: UserRole.SUPER_ADMIN,
        allowedActions: ['assets:create', 'assets:delete', 'users:create', 'users:delete'],
        deniedActions: [], // Super admins can do everything
      },
    ];

    test.each(testCases)('user with $role should have consistent permissions', ({ role, allowedActions, deniedActions }) => {
      const user = generateMockUser('test-user', role);
      
      allowedActions.forEach(action => {
        expect(AccessControl.canPerformAction(user, action)).toBe(true);
      });
      
      deniedActions.forEach(action => {
        expect(AccessControl.canPerformAction(user, action)).toBe(false);
      });
    });
  });

  /**
   * Property: Session validation should be deterministic
   */
  describe('Session Validation Property', () => {
    test('valid active user should always pass validation', () => {
      const user = generateMockUser('valid-user', UserRole.USER);
      
      expect(() => AccessControl.validateSession(user)).not.toThrow();
      expect(() => AccessControl.validateSession(user, UserRole.USER)).not.toThrow();
    });

    test('null user should always fail validation', () => {
      expect(() => AccessControl.validateSession(null)).toThrow(AccessControlError);
      expect(() => AccessControl.validateSession(null, UserRole.USER)).toThrow(AccessControlError);
    });

    test('inactive user should always fail validation', () => {
      const inactiveUser = generateMockUser('inactive-user', UserRole.ADMIN, false);
      
      expect(() => AccessControl.validateSession(inactiveUser)).toThrow(AccessControlError);
      expect(() => AccessControl.validateSession(inactiveUser, UserRole.USER)).toThrow(AccessControlError);
    });

    test('insufficient role should fail validation', () => {
      const user = generateMockUser('user', UserRole.USER);
      
      expect(() => AccessControl.validateSession(user, UserRole.ADMIN)).toThrow(AccessControlError);
      expect(() => AccessControl.validateSession(user, UserRole.SUPER_ADMIN)).toThrow(AccessControlError);
    });
  });

  /**
   * Property: Secure context should contain only safe user data
   */
  describe('Secure Context Property', () => {
    test('secure context should contain expected fields and no sensitive data', () => {
      const user = generateMockUser('test-user', UserRole.ADMIN);
      const context = AccessControl.createSecureContext(user);
      
      // Should contain expected fields
      expect(context).toHaveProperty('userId', user.id);
      expect(context).toHaveProperty('address', user.address);
      expect(context).toHaveProperty('role', user.role);
      expect(context).toHaveProperty('permissions');
      expect(context).toHaveProperty('isAdmin');
      
      // Permissions should be an array
      expect(Array.isArray(context.permissions)).toBe(true);
      
      // isAdmin should be boolean
      expect(typeof context.isAdmin).toBe('boolean');
      
      // Should not contain sensitive fields (this is a safety check)
      expect(context).not.toHaveProperty('password');
      expect(context).not.toHaveProperty('privateKey');
      expect(context).not.toHaveProperty('secret');
    });
  });

  /**
   * Property: User sanitization should remove sensitive data
   */
  describe('User Sanitization Property', () => {
    test('sanitized user should contain only safe fields', () => {
      const user = generateMockUser('test-user', UserRole.USER);
      const sanitized = AccessControl.sanitizeUser(user);
      
      // Should contain safe fields
      expect(sanitized).toHaveProperty('id', user.id);
      expect(sanitized).toHaveProperty('address', user.address);
      expect(sanitized).toHaveProperty('role', user.role);
      expect(sanitized).toHaveProperty('isActive', user.isActive);
      expect(sanitized).toHaveProperty('createdAt', user.createdAt);
      
      // Should not contain potentially sensitive fields
      expect(sanitized).not.toHaveProperty('lastLoginAt');
    });
  });

  /**
   * **Feature: rwa-lending-protocol, Property 21: Error message generation**
   * **Validates: Requirements 5.4**
   * Property: Error handling should provide appropriate error messages with resolution guidance
   */
  describe('Error Message Generation Property', () => {
    test('AccessControlError should contain appropriate error codes and messages', () => {
      const errorCodes = ['UNAUTHORIZED', 'FORBIDDEN', 'INVALID_TOKEN', 'EXPIRED_SESSION'] as const;
      
      errorCodes.forEach(code => {
        const error = new AccessControlError({
          code,
          message: `Test message for ${code}`,
          details: { testField: 'testValue' }
        });
        
        expect(error.details.code).toBe(code);
        expect(error.details.message).toContain(code);
        expect(error.details.details).toBeDefined();
        expect(error.name).toBe('AccessControlError');
      });
    });

    test('validateSession should throw appropriate errors with helpful messages', () => {
      // Test null user
      expect(() => AccessControl.validateSession(null)).toThrow(AccessControlError);
      
      try {
        AccessControl.validateSession(null);
      } catch (error) {
        expect(error).toBeInstanceOf(AccessControlError);
        expect((error as AccessControlError).details.code).toBe('UNAUTHORIZED');
        expect((error as AccessControlError).details.message).toBe('Authentication required');
      }

      // Test inactive user
      const inactiveUser = generateMockUser('inactive', UserRole.USER, false);
      expect(() => AccessControl.validateSession(inactiveUser)).toThrow(AccessControlError);
      
      try {
        AccessControl.validateSession(inactiveUser);
      } catch (error) {
        expect(error).toBeInstanceOf(AccessControlError);
        expect((error as AccessControlError).details.code).toBe('FORBIDDEN');
        expect((error as AccessControlError).details.message).toBe('Account is suspended');
      }

      // Test insufficient role
      const user = generateMockUser('user', UserRole.USER);
      expect(() => AccessControl.validateSession(user, UserRole.ADMIN)).toThrow(AccessControlError);
      
      try {
        AccessControl.validateSession(user, UserRole.ADMIN);
      } catch (error) {
        expect(error).toBeInstanceOf(AccessControlError);
        expect((error as AccessControlError).details.code).toBe('FORBIDDEN');
        expect((error as AccessControlError).details.message).toContain('Insufficient permissions');
        expect((error as AccessControlError).details.details?.userRole).toBe(UserRole.USER);
        expect((error as AccessControlError).details.details?.requiredRole).toBe(UserRole.ADMIN);
      }
    });

    test('error messages should be consistent and informative', () => {
      const testCases = [
        { user: null, expectedCode: 'UNAUTHORIZED', expectedMessage: 'Authentication required' },
        { user: generateMockUser('inactive', UserRole.USER, false), expectedCode: 'FORBIDDEN', expectedMessage: 'Account is suspended' },
      ];

      testCases.forEach(({ user, expectedCode, expectedMessage }) => {
        try {
          AccessControl.validateSession(user);
          fail('Expected error to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(AccessControlError);
          expect((error as AccessControlError).details.code).toBe(expectedCode);
          expect((error as AccessControlError).details.message).toBe(expectedMessage);
        }
      });
    });
  });
});

/**
 * Integration tests for edge cases
 */
describe('Access Control Edge Cases', () => {
  test('super admin with all permissions should pass all checks', () => {
    const superAdmin = generateMockUser('super-admin', UserRole.SUPER_ADMIN);
    
    // Should have all roles
    expect(AccessControl.hasRole(superAdmin, UserRole.USER)).toBe(true);
    expect(AccessControl.hasRole(superAdmin, UserRole.ADMIN)).toBe(true);
    expect(AccessControl.hasRole(superAdmin, UserRole.SUPER_ADMIN)).toBe(true);
    
    // Should be able to perform any action (wildcard permission)
    expect(AccessControl.canPerformAction(superAdmin, 'any:action')).toBe(true);
    expect(AccessControl.canPerformAction(superAdmin, 'unknown:permission')).toBe(true);
  });

  test('role hierarchy should be transitive', () => {
    const admin = generateMockUser('admin', UserRole.ADMIN);
    
    // Admin should have user permissions
    expect(AccessControl.hasRole(admin, UserRole.USER)).toBe(true);
    expect(AccessControl.canPerformAction(admin, 'asset:create')).toBe(true);
    
    // But not super admin permissions
    expect(AccessControl.hasRole(admin, UserRole.SUPER_ADMIN)).toBe(false);
  });
});