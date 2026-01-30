/**
 * Admin Authentication Context Provider
 * 
 * Provides admin authentication context to the entire admin application
 */

'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAdminAuth, AdminAuthState, AdminAuthActions } from '@/hooks/use-admin-auth';

type AdminAuthContextType = AdminAuthState & AdminAuthActions;

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export interface AdminAuthProviderProps {
  children: ReactNode;
}

export function AdminAuthProvider({ children }: AdminAuthProviderProps) {
  const auth = useAdminAuth();

  return (
    <AdminAuthContext.Provider value={auth}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuthContext(): AdminAuthContextType {
  const context = useContext(AdminAuthContext);
  
  if (context === undefined) {
    throw new Error('useAdminAuthContext must be used within an AdminAuthProvider');
  }
  
  return context;
}

/**
 * Higher-order component to protect admin routes
 */
export interface WithAdminAuthOptions {
  requiredPermissions?: string[];
  requiredRoles?: string[];
  fallback?: ReactNode;
  redirectTo?: string;
}

export function withAdminAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAdminAuthOptions = {}
) {
  const WrappedComponent = (props: P) => {
    const auth = useAdminAuthContext();

    // Show loading state
    if (auth.isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading...</span>
        </div>
      );
    }

    // Show error state
    if (auth.error && !auth.isAuthenticated) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-red-600 mb-4">Authentication Error</div>
            <div className="text-gray-600 mb-4">{auth.error}</div>
            <button
              onClick={() => window.location.href = '/admin/login'}
              className="px-4 py-2 bg-blue-600 text-gray-900 dark:text-white rounded hover:bg-blue-700"
            >
              Go to Login
            </button>
          </div>
        </div>
      );
    }

    // Check authentication
    if (!auth.isAuthenticated) {
      if (options.redirectTo) {
        window.location.href = options.redirectTo;
        return null;
      }

      return options.fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-gray-600 mb-4">Authentication required</div>
            <button
              onClick={() => window.location.href = '/admin/login'}
              className="px-4 py-2 bg-blue-600 text-gray-900 dark:text-white rounded hover:bg-blue-700"
            >
              Login
            </button>
          </div>
        </div>
      );
    }

    // Check required permissions
    if (options.requiredPermissions) {
      const hasPermissions = options.requiredPermissions.every(permission =>
        auth.hasPermission(permission as any)
      );

      if (!hasPermissions) {
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="text-red-600 mb-4">Insufficient Permissions</div>
              <div className="text-gray-600 mb-4">
                You don't have the required permissions to access this page.
              </div>
              <button
                onClick={() => window.history.back()}
                className="px-4 py-2 bg-gray-600 text-gray-900 dark:text-white rounded hover:bg-gray-700"
              >
                Go Back
              </button>
            </div>
          </div>
        );
      }
    }

    // Check required roles
    if (options.requiredRoles) {
      const hasRoles = options.requiredRoles.some(role => auth.hasRole(role));

      if (!hasRoles) {
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="text-red-600 mb-4">Insufficient Role Privileges</div>
              <div className="text-gray-600 mb-4">
                You don't have the required role to access this page.
              </div>
              <button
                onClick={() => window.history.back()}
                className="px-4 py-2 bg-gray-600 text-gray-900 dark:text-white rounded hover:bg-gray-700"
              >
                Go Back
              </button>
            </div>
          </div>
        );
      }
    }

    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withAdminAuth(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Hook to check if admin has specific permissions
 */
export function useAdminPermissions() {
  const auth = useAdminAuthContext();

  return {
    hasPermission: auth.hasPermission,
    hasRole: auth.hasRole,
    hasAnyPermission: (permissions: string[]) => 
      permissions.some(permission => auth.hasPermission(permission as any)),
    hasAllPermissions: (permissions: string[]) => 
      permissions.every(permission => auth.hasPermission(permission as any)),
    hasAnyRole: (roles: string[]) => 
      roles.some(role => auth.hasRole(role)),
    permissions: auth.session?.permissions || [],
    roles: auth.session?.roles.map(r => r.name) || []
  };
}