/**
 * Network Status Component
 * Displays current blockchain network health and connection status
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  RefreshCw,
  Activity,
  Zap
} from 'lucide-react';
import { getNetworkResilienceManager, type NetworkHealth } from '@/lib/blockchain/network-resilience';

interface NetworkStatusProps {
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

export function NetworkStatus({ 
  showDetails = false, 
  compact = false, 
  className = '' 
}: NetworkStatusProps) {
  const [networkHealth, setNetworkHealth] = useState<NetworkHealth | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const manager = getNetworkResilienceManager();
    
    // Initial health check
    checkNetworkHealth();
    
    // Set up periodic health checks
    const interval = setInterval(checkNetworkHealth, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const checkNetworkHealth = async () => {
    try {
      setIsChecking(true);
      const manager = getNetworkResilienceManager();
      const health = await manager.checkNetworkHealth();
      setNetworkHealth(health);
    } catch (error) {
      console.error('Failed to check network health:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusIcon = () => {
    if (isChecking) {
      return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />;
    }

    if (!networkHealth) {
      return <Clock className="w-4 h-4 text-gray-500" />;
    }

    if (networkHealth.isOnline) {
      if (networkHealth.failedEndpoints.length === 0) {
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      } else {
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      }
    } else {
      return <WifiOff className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = () => {
    if (isChecking) return 'Checking...';
    if (!networkHealth) return 'Unknown';

    if (networkHealth.isOnline) {
      if (networkHealth.failedEndpoints.length === 0) {
        return 'Online';
      } else {
        return 'Degraded';
      }
    } else {
      return 'Offline';
    }
  };

  const getStatusColor = () => {
    if (isChecking) return 'text-blue-500';
    if (!networkHealth) return 'text-gray-500';

    if (networkHealth.isOnline) {
      if (networkHealth.failedEndpoints.length === 0) {
        return 'text-green-500';
      } else {
        return 'text-yellow-500';
      }
    } else {
      return 'text-red-500';
    }
  };

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatLastChecked = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {getStatusIcon()}
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">
              Casper Network
            </h3>
            <p className={`text-sm ${getStatusColor()}`}>
              {getStatusText()}
            </p>
          </div>
        </div>
        
        <button
          onClick={checkNetworkHealth}
          disabled={isChecking}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh network status"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${isChecking ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {showDetails && networkHealth && (
        <div className="space-y-3">
          {/* Connection Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Response Time:</span>
              <span className="ml-2 font-mono text-gray-900 dark:text-white">
                {networkHealth.responseTime > 0 ? formatResponseTime(networkHealth.responseTime) : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Last Checked:</span>
              <span className="ml-2 text-gray-900 dark:text-white">
                {formatLastChecked(networkHealth.lastChecked)}
              </span>
            </div>
          </div>

          {/* Endpoint Status */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                RPC Endpoints
              </span>
              <span className="text-xs text-gray-500">
                {networkHealth.totalEndpoints - networkHealth.failedEndpoints.length}/{networkHealth.totalEndpoints} active
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    networkHealth.failedEndpoints.length === 0 
                      ? 'bg-green-500' 
                      : networkHealth.failedEndpoints.length < networkHealth.totalEndpoints 
                        ? 'bg-yellow-500' 
                        : 'bg-red-500'
                  }`}
                  style={{
                    width: `${((networkHealth.totalEndpoints - networkHealth.failedEndpoints.length) / networkHealth.totalEndpoints) * 100}%`
                  }}
                />
              </div>
              <Activity className="w-4 h-4 text-gray-500" />
            </div>
          </div>

          {/* Active Endpoint */}
          {networkHealth.activeEndpoint && (
            <div className="text-sm">
              <span className="text-gray-600 dark:text-gray-400">Active Endpoint:</span>
              <code className="ml-2 text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-gray-900 dark:text-white">
                {networkHealth.activeEndpoint.replace('https://', '').replace('/rpc', '')}
              </code>
            </div>
          )}

          {/* Failed Endpoints Warning */}
          {networkHealth.failedEndpoints.length > 0 && (
            <div className="flex items-start space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Some endpoints are unavailable
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1">
                  {networkHealth.failedEndpoints.length} of {networkHealth.totalEndpoints} endpoints are currently offline. 
                  The system is using backup connections.
                </p>
              </div>
            </div>
          )}

          {/* Offline Warning */}
          {!networkHealth.isOnline && (
            <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <WifiOff className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Network Offline
                </p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                  Unable to connect to the Casper network. Some features may be unavailable.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Simple network status indicator for headers/navigation
 */
export function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const manager = getNetworkResilienceManager();
        const health = await manager.checkNetworkHealth();
        setIsOnline(health.isOnline);
      } catch (error) {
        setIsOnline(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center space-x-2">
      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-xs text-gray-600 dark:text-gray-400">
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}