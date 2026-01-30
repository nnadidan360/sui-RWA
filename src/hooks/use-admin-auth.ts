/**
 * Admin Authentication Hook
 * 
 * Provides admin authentication state and methods for React components
 */

import { useState, useEffect, useCallback } from 'react';
import { AdminUser, LoginCredentials, AdminSession, AdminPermission } from '@/types/auth';

export interface AdminAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  admin: Omit<AdminUser, 'passwordHash' | 'mfaSecret'> | null;
  session: AdminSession | null;
  error: string | null;
}

export interface AdminAuthActions {
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; requiresMfa?: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  hasPermission: (permission: AdminPermission) => boolean;
  hasRole: (role: string) => boolean;
  clearError: () => void;
}

const API_BASE = '/api/admin/auth';

export function useAdminAuth(): AdminAuthState & AdminAuthActions {
  const [state, setState] = useState<AdminAuthState>({
    isAuthenticated: false,
    isLoading: true,
    admin: null,
    session: null,
    error: null
  });

  // Load tokens from localStorage
  const getStoredTokens = useCallback(() => {
    if (typeof window === 'undefined') return null;
    
    try {
      const accessToken = localStorage.getItem('admin_access_token');
      const refreshToken = localStorage.getItem('admin_refresh_token');
      
      return accessToken && refreshToken ? { accessToken, refreshToken } : null;
    } catch (error) {
      console.error('Error loading stored tokens:', error);
      return null;
    }
  }, []);

  // Store tokens in localStorage
  const storeTokens = useCallback((accessToken: string, refreshToken: string) => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('admin_access_token', accessToken);
      localStorage.setItem('admin_refresh_token', refreshToken);
    } catch (error) {
      console.error('Error storing tokens:', error);
    }
  }, []);

  // Clear tokens from localStorage
  const clearTokens = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_refresh_token');
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }, []);

  // Make authenticated API request
  const makeAuthenticatedRequest = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const tokens = getStoredTokens();
    
    if (!tokens) {
      throw new Error('No authentication tokens available');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.accessToken}`,
        ...options.headers
      }
    });

    // If token expired, try to refresh
    if (response.status === 401) {
      const refreshSuccess = await refreshToken();
      if (refreshSuccess) {
        // Retry the request with new token
        const newTokens = getStoredTokens();
        if (newTokens) {
          return fetch(url, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${newTokens.accessToken}`,
              ...options.headers
            }
          });
        }
      }
    }

    return response;
  }, [getStoredTokens]);

  // Login function
  const login = useCallback(async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (!response.ok) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: data.error || 'Login failed' 
        }));
        
        return { 
          success: false, 
          requiresMfa: data.details?.requiresMfa,
          error: data.error 
        };
      }

      // Store tokens
      storeTokens(data.data.accessToken, data.data.refreshToken);

      // Update state
      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        isLoading: false,
        admin: data.data.admin,
        error: null
      }));

      // Load session info
      await loadProfile();

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      
      return { success: false, error: errorMessage };
    }
  }, [storeTokens]);

  // Logout function
  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Call logout API
      await makeAuthenticatedRequest(`${API_BASE}/logout`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with logout even if API call fails
    }

    // Clear tokens and state
    clearTokens();
    setState({
      isAuthenticated: false,
      isLoading: false,
      admin: null,
      session: null,
      error: null
    });
  }, [makeAuthenticatedRequest, clearTokens]);

  // Refresh token function
  const refreshToken = useCallback(async (): Promise<boolean> => {
    const tokens = getStoredTokens();
    
    if (!tokens) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken })
      });

      if (!response.ok) {
        // Refresh failed, clear tokens and logout
        clearTokens();
        setState({
          isAuthenticated: false,
          isLoading: false,
          admin: null,
          session: null,
          error: 'Session expired'
        });
        return false;
      }

      const data = await response.json();
      
      // Store new tokens
      storeTokens(data.data.accessToken, data.data.refreshToken);
      
      return true;

    } catch (error) {
      console.error('Token refresh error:', error);
      clearTokens();
      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        admin: null,
        session: null,
        error: 'Session expired'
      }));
      return false;
    }
  }, [getStoredTokens, storeTokens, clearTokens]);

  // Load admin profile
  const loadProfile = useCallback(async () => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE}/me`);
      
      if (response.ok) {
        const data = await response.json();
        setState(prev => ({
          ...prev,
          admin: data.data.admin,
          session: data.data.admin.sessionInfo,
          isAuthenticated: true,
          isLoading: false
        }));
      } else {
        throw new Error('Failed to load profile');
      }
    } catch (error) {
      console.error('Profile loading error:', error);
      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        isLoading: false,
        error: 'Failed to load profile'
      }));
    }
  }, [makeAuthenticatedRequest]);

  // Check if admin has specific permission
  const hasPermission = useCallback((permission: AdminPermission): boolean => {
    return state.session?.permissions.includes(permission) || false;
  }, [state.session]);

  // Check if admin has specific role
  const hasRole = useCallback((role: string): boolean => {
    return state.session?.roles.some(r => r.name === role) || false;
  }, [state.session]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Initialize authentication state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const tokens = getStoredTokens();
      
      if (!tokens) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Try to load profile with existing tokens
      await loadProfile();
    };

    initializeAuth();
  }, [getStoredTokens, loadProfile]);

  // Set up automatic token refresh
  useEffect(() => {
    if (!state.isAuthenticated) return;

    // Refresh token every 10 minutes
    const refreshInterval = setInterval(() => {
      refreshToken();
    }, 10 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [state.isAuthenticated, refreshToken]);

  return {
    ...state,
    login,
    logout,
    refreshToken,
    hasPermission,
    hasRole,
    clearError
  };
}