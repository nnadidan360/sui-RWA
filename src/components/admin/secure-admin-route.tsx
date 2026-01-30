/**
 * Secure Admin Route Component
 * 
 * Provides authentication and authorization protection for admin routes
 */

'use client';

import React, { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAdminAuthContext } from '@/components/providers/admin-auth-provider';
import { AdminPermission } from '@/types/auth';
import { Shield, AlertTriangle, Loader2 } from 'lucide-react';

export interface SecureAdminRouteProps {
  children: ReactNode;
  requiredPermissions?: AdminPermission[];
  requiredRoles?: string[];
  fallback?: ReactNode;
  redirectTo?: string;
}

export function SecureAdminRoute({
  children,
  requiredPermissions = [],
  requiredRoles = ['admin', 'super_admin'],
  fallback,
  redirectTo = '/admin/login'
}: SecureAdminRouteProps) {
  const auth = useAdminAuthContext();
  const router = useRouter();
  const t = useTranslations('admin');

  useEffect(() => {
    // Redirect to login if not authenticated and no session is being restored
    if (!auth.isLoading && !auth.isAuthenticated && !auth.session) {
      router.push(redirectTo);
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.session, router, redirectTo]);

  // Show loading state while checking authentication
  if (auth.isLoading) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Show error state if authentication failed
  if (auth.error && !auth.isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('errors.authenticationError')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {auth.error}
          </p>
          <button
            onClick={() => router.push(redirectTo)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('authentication.goToLogin')}
          </button>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!auth.isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Check required permissions
  if (requiredPermissions.length > 0) {
    const hasPermissions = requiredPermissions.every(permission =>
      auth.hasPermission(permission)
    );

    if (!hasPermissions) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="text-center max-w-md mx-auto p-6">
            <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('errors.insufficientPermissions')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('errors.insufficientPermissionsMessage')}
            </p>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              <p>{t('permissions.requiredPermissions', { permissions: requiredPermissions.join(', ') })}</p>
              <p>{t('permissions.currentPermissions', { permissions: auth.session?.permissions.join(', ') || 'None' })}</p>
            </div>
            <div className="flex space-x-3 justify-center">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                {t('errors.goBack')}
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('errors.adminDashboard')}
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Check required roles
  if (requiredRoles.length > 0) {
    const hasRoles = requiredRoles.some(role => auth.hasRole(role));

    if (!hasRoles) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="text-center max-w-md mx-auto p-6">
            <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('errors.insufficientRolePrivileges')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('errors.insufficientRolePrivilegesMessage')}
            </p>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              <p>{t('permissions.requiredRoles', { roles: requiredRoles.join(', ') })}</p>
              <p>{t('permissions.currentRoles', { roles: auth.session?.roles.map(r => r.name).join(', ') || 'None' })}</p>
            </div>
            <div className="flex space-x-3 justify-center">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                {t('errors.goBack')}
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('errors.adminDashboard')}
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Render children if all checks pass
  return <>{children}</>;
}

/**
 * Higher-order component version for class components or complex wrapping
 */
export function withSecureAdminRoute<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<SecureAdminRouteProps, 'children'> = {}
) {
  const WrappedComponent = (props: P) => {
    return (
      <SecureAdminRoute {...options}>
        <Component {...props} />
      </SecureAdminRoute>
    );
  };

  WrappedComponent.displayName = `withSecureAdminRoute(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}