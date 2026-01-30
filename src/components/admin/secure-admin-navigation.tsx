/**
 * Secure Admin Navigation Component
 * 
 * Provides navigation with role-based access control and permission checks
 */

'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAdminAuthContext } from '@/components/providers/admin-auth-provider';
import { AdminPermission } from '@/types/auth';
import { 
  BarChart3, 
  Shield, 
  CheckCircle, 
  Eye, 
  TrendingUp, 
  Settings,
  LogOut,
  User,
  Clock,
  AlertTriangle
} from 'lucide-react';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  path: string;
  requiredPermissions?: AdminPermission[];
  requiredRoles?: string[];
  description?: string;
}

const navigationItems: NavigationItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: BarChart3,
    path: '/admin',
    description: 'Platform overview and key metrics'
  },
  {
    id: 'risk',
    label: 'Risk Management',
    icon: Shield,
    path: '/admin/risk',
    requiredPermissions: [AdminPermission.MANAGE_LOANS],
    description: 'Monitor and manage platform risk parameters'
  },
  {
    id: 'assets',
    label: 'Asset Approval',
    icon: CheckCircle,
    path: '/admin/assets',
    requiredPermissions: [AdminPermission.MANAGE_ASSETS],
    description: 'Review and approve asset tokenization requests'
  },
  {
    id: 'monitoring',
    label: 'Activity Monitor',
    icon: Eye,
    path: '/admin/monitoring',
    requiredPermissions: [AdminPermission.VIEW_ANALYTICS],
    description: 'Monitor user activity and system events'
  },
  {
    id: 'metrics',
    label: 'Platform Metrics',
    icon: TrendingUp,
    path: '/admin/metrics',
    requiredPermissions: [AdminPermission.VIEW_ANALYTICS],
    description: 'Detailed platform analytics and performance metrics'
  },
  {
    id: 'settings',
    label: 'System Settings',
    icon: Settings,
    path: '/admin/settings',
    requiredPermissions: [AdminPermission.SYSTEM_SETTINGS],
    requiredRoles: ['super_admin'],
    description: 'Configure system parameters and settings'
  }
];

export interface SecureAdminNavigationProps {
  className?: string;
  onNavigate?: (path: string) => void;
}

export function SecureAdminNavigation({ className = '', onNavigate }: SecureAdminNavigationProps) {
  const auth = useAdminAuthContext();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await auth.logout();
      router.push('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleNavigate = (path: string) => {
    router.push(path);
    onNavigate?.(path);
  };

  const canAccessItem = (item: NavigationItem): boolean => {
    // Check required permissions
    if (item.requiredPermissions) {
      const hasPermissions = item.requiredPermissions.every(permission =>
        auth.hasPermission(permission)
      );
      if (!hasPermissions) return false;
    }

    // Check required roles
    if (item.requiredRoles) {
      const hasRoles = item.requiredRoles.some(role => auth.hasRole(role));
      if (!hasRoles) return false;
    }

    return true;
  };

  const getAccessibleItems = (): NavigationItem[] => {
    return navigationItems.filter(canAccessItem);
  };

  const formatLastLogin = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const accessibleItems = getAccessibleItems();

  return (
    <div className={`bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 ${className}`}>
      {/* Admin Profile Section */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {auth.session?.email || 'Admin User'}
            </p>
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="w-3 h-3" />
              <span>
                Session created: {auth.session?.createdAt ? formatLastLogin(new Date(auth.session.createdAt)) : 'Unknown'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Role and Permission Summary */}
        <div className="mt-3 space-y-1">
          <div className="flex flex-wrap gap-1">
            {auth.session?.roles.map((role) => (
              <span
                key={role.name}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
              >
                {role.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {auth.session?.permissions.length || 0} permissions
          </p>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-2">
        {accessibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || 
                          (item.path !== '/admin' && pathname.startsWith(item.path));
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.path)}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={item.description}
            >
              <Icon className="w-4 h-4 mr-3 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Session Info and Logout */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
        {/* Session Status */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Session Active</span>
          </div>
          <span>
            Expires: {auth.session?.expiresAt ? 
              new Date(auth.session.expiresAt).toLocaleTimeString() : 
              'Unknown'
            }
          </span>
        </div>

        {/* Security Alert */}
        {auth.session?.ipAddress && (
          <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
            <AlertTriangle className="w-3 h-3" />
            <span className="truncate">IP: {auth.session.ipAddress}</span>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

/**
 * Compact version for mobile or sidebar collapsed state
 */
export function CompactAdminNavigation({ className = '', onNavigate }: SecureAdminNavigationProps) {
  const auth = useAdminAuthContext();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await auth.logout();
      router.push('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleNavigate = (path: string) => {
    router.push(path);
    onNavigate?.(path);
  };

  const canAccessItem = (item: NavigationItem): boolean => {
    if (item.requiredPermissions) {
      const hasPermissions = item.requiredPermissions.every(permission =>
        auth.hasPermission(permission)
      );
      if (!hasPermissions) return false;
    }

    if (item.requiredRoles) {
      const hasRoles = item.requiredRoles.some(role => auth.hasRole(role));
      if (!hasRoles) return false;
    }

    return true;
  };

  const accessibleItems = navigationItems.filter(canAccessItem);

  return (
    <div className={`bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 ${className}`}>
      {/* Compact Profile */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mx-auto">
          <User className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Compact Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {accessibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || 
                          (item.path !== '/admin' && pathname.startsWith(item.path));
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.path)}
              className={`w-full flex items-center justify-center p-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </nav>

      {/* Compact Logout */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Sign Out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}