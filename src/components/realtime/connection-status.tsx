'use client';

import { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Activity, 
  AlertTriangle, 
  CheckCircle,
  Clock
} from 'lucide-react';
import { useRealtime } from '@/hooks/use-realtime';

interface ConnectionStatusProps {
  userId?: string;
  showDetails?: boolean;
  className?: string;
}

export function ConnectionStatus({ 
  userId, 
  showDetails = false, 
  className = '' 
}: ConnectionStatusProps) {
  const { isConnected, connectionHealth, strategy, error } = useRealtime({ userId });
  const [showTooltip, setShowTooltip] = useState(false);

  const getStatusIcon = () => {
    if (error) {
      return <AlertTriangle className="w-4 h-4 text-red-400" />;
    }
    
    if (!isConnected) {
      return <WifiOff className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
    }
    
    if (strategy === 'polling') {
      return <Clock className="w-4 h-4 text-yellow-400" />;
    }
    
    return <Wifi className="w-4 h-4 text-green-400" />;
  };

  const getStatusText = () => {
    if (error) {
      return 'Connection Error';
    }
    
    if (!isConnected) {
      return 'Disconnected';
    }
    
    if (strategy === 'polling') {
      return 'Polling Mode';
    }
    
    return 'Real-time';
  };

  const getStatusColor = () => {
    if (error) return 'text-red-400';
    if (!isConnected) return 'text-gray-600 dark:text-gray-400';
    if (strategy === 'polling') return 'text-yellow-400';
    return 'text-green-400';
  };

  const formatLatency = (latency: number) => {
    if (latency < 1000) {
      return `${latency}ms`;
    }
    return `${(latency / 1000).toFixed(1)}s`;
  };

  if (!showDetails) {
    return (
      <div 
        className={`relative inline-flex items-center space-x-2 ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {getStatusIcon()}
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
        
        {showTooltip && (
          <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50 min-w-max">
            <div className="text-sm text-gray-900 dark:text-white space-y-1">
              <div>Status: {getStatusText()}</div>
              {connectionHealth && (
                <>
                  <div>Strategy: {strategy?.toUpperCase()}</div>
                  <div>Latency: {formatLatency(connectionHealth.latency)}</div>
                  {connectionHealth.reconnectAttempts > 0 && (
                    <div>Reconnect attempts: {connectionHealth.reconnectAttempts}</div>
                  )}
                </>
              )}
              {error && (
                <div className="text-red-400">Error: {error.message}</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Connection Status</h3>
        {getStatusIcon()}
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Status</span>
          <span className={getStatusColor()}>{getStatusText()}</span>
        </div>
        
        {connectionHealth && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Strategy</span>
              <span className="text-gray-900 dark:text-white">{strategy?.toUpperCase()}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Latency</span>
              <span className="text-gray-900 dark:text-white">{formatLatency(connectionHealth.latency)}</span>
            </div>
            
            {connectionHealth.reconnectAttempts > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Reconnect Attempts</span>
                <span className="text-yellow-400">{connectionHealth.reconnectAttempts}</span>
              </div>
            )}
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Last Heartbeat</span>
              <span className="text-gray-900 dark:text-white">
                {new Date(connectionHealth.lastHeartbeat).toLocaleTimeString()}
              </span>
            </div>
          </>
        )}
        
        {error && (
          <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium text-sm">Connection Error</p>
                <p className="text-red-300 text-xs mt-1">{error.message}</p>
              </div>
            </div>
          </div>
        )}
        
        {isConnected && !error && (
          <div className="mt-3 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <p className="text-green-400 font-medium text-sm">
                Connected via {strategy?.toUpperCase()}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}