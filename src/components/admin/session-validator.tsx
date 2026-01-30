/**
 * Session Validator Component
 * 
 * Provides session validation and monitoring for admin operations
 */

'use client';

import React, { useEffect, useState, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminAuthContext } from '@/components/providers/admin-auth-provider';
import { AlertTriangle, Clock, Shield, Wifi, WifiOff } from 'lucide-react';
import { getPlural } from '@/lib/i18n/admin-formatting';

export interface SessionValidatorProps {
  children: ReactNode;
  requireActiveSession?: boolean;
  showSessionInfo?: boolean;
  onSessionExpired?: () => void;
  onSessionWarning?: (minutesLeft: number) => void;
}

export function SessionValidator({
  children,
  requireActiveSession = true,
  showSessionInfo = false,
  onSessionExpired,
  onSessionWarning
}: SessionValidatorProps) {
  const auth = useAdminAuthContext();
  const t = useTranslations('admin.sessionValidator');
  const tAuth = useTranslations('admin.authentication');
  const [sessionStatus, setSessionStatus] = useState<'active' | 'warning' | 'expired' | 'invalid'>('active');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isOnline, setIsOnline] = useState(true);

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor session expiration
  useEffect(() => {
    if (!auth.session?.expiresAt) return;

    const checkSession = () => {
      const now = new Date().getTime();
      const expiresAt = new Date(auth.session!.expiresAt).getTime();
      const minutesLeft = Math.floor((expiresAt - now) / (1000 * 60));

      setTimeLeft(minutesLeft);

      if (minutesLeft <= 0) {
        setSessionStatus('expired');
        onSessionExpired?.();
      } else if (minutesLeft <= 5) {
        setSessionStatus('warning');
        onSessionWarning?.(minutesLeft);
      } else {
        setSessionStatus('active');
      }
    };

    // Check immediately
    checkSession();

    // Check every minute
    const interval = setInterval(checkSession, 60000);

    return () => clearInterval(interval);
  }, [auth.session?.expiresAt, onSessionExpired, onSessionWarning]);

  // Validate session integrity
  useEffect(() => {
    if (requireActiveSession && (!auth.isAuthenticated || !auth.session)) {
      setSessionStatus('invalid');
    }
  }, [auth.isAuthenticated, auth.session, requireActiveSession]);

  const handleRefreshSession = async () => {
    try {
      await auth.refreshToken();
    } catch (error) {
      console.error('Failed to refresh session:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.logout();
      window.location.href = '/admin/login';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/admin/login';
    }
  };

  // Render session expired state
  if (sessionStatus === 'expired') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-6">
          <Clock className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {tAuth('sessionExpired')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {tAuth('sessionExpiredMessage')}
          </p>
          <div className="flex space-x-3 justify-center">
            <button
              onClick={handleRefreshSession}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {tAuth('refreshSession')}
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              {tAuth('loginAgain')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render invalid session state
  if (sessionStatus === 'invalid' && requireActiveSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {tAuth('invalidSession')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {tAuth('invalidSessionMessage')}
          </p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {tAuth('goToLogin')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Session Warning Banner */}
      {sessionStatus === 'warning' && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  {t('sessionExpiring')}
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  {t('sessionExpiringMessage', { 
                    minutes: timeLeft, 
                    plural: getPlural(timeLeft, 'en') 
                  })}
                </p>
              </div>
            </div>
            <button
              onClick={handleRefreshSession}
              className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
            >
              {t('extendSession')}
            </button>
          </div>
        </div>
      )}

      {/* Network Status Banner */}
      {!isOnline && (
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 p-4">
          <div className="flex items-center space-x-3">
            <WifiOff className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {t('connectionLost')}
              </p>
              <p className="text-xs text-red-700 dark:text-red-300">
                {t('connectionLostMessage')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Session Info Bar */}
      {showSessionInfo && auth.session && (
        <div className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span className="text-gray-700 dark:text-gray-300">
                  Session Active
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  Expires: {new Date(auth.session.expiresAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className="text-gray-600 dark:text-gray-400">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
              <span>ID: {auth.session.sessionId.slice(0, 8)}...</span>
              <span>•</span>
              <span>IP: {auth.session.ipAddress}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {children}
    </div>
  );
}

/**
 * Higher-order component version
 */
export function withSessionValidator<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<SessionValidatorProps, 'children'> = {}
) {
  const WrappedComponent = (props: P) => {
    return (
      <SessionValidator {...options}>
        <Component {...props} />
      </SessionValidator>
    );
  };

  WrappedComponent.displayName = `withSessionValidator(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Hook for session validation status
 */
export function useSessionValidation() {
  const auth = useAdminAuthContext();
  const [isValid, setIsValid] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!auth.session?.expiresAt) {
      setIsValid(false);
      return;
    }

    const checkSession = () => {
      const now = new Date().getTime();
      const expiresAt = new Date(auth.session!.expiresAt).getTime();
      const minutesLeft = Math.floor((expiresAt - now) / (1000 * 60));

      setTimeLeft(minutesLeft);
      setIsValid(minutesLeft > 0 && auth.isAuthenticated);
    };

    checkSession();
    const interval = setInterval(checkSession, 60000);

    return () => clearInterval(interval);
  }, [auth.session?.expiresAt, auth.isAuthenticated]);

  return {
    isValid,
    timeLeft,
    isExpiringSoon: timeLeft <= 5 && timeLeft > 0,
    isExpired: timeLeft <= 0,
    refreshSession: auth.refreshToken
  };
}