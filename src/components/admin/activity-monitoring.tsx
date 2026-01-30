'use client';

/**
 * Activity Monitoring Component for Admin Dashboard
 * Simplified version of the monitoring dashboard for admin interface
 * Requirements: 6.3
 */

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Shield, 
  Clock, 
  RefreshCw,
  Eye,
  Users,
  TrendingUp
} from 'lucide-react';

interface SuspiciousActivity {
  userId: string;
  activityType: 'rapid_transactions' | 'large_amounts' | 'unusual_patterns' | 'failed_attempts';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
}

interface TransactionMetrics {
  transactionId: string;
  userId: string;
  type: 'tokenization' | 'lending' | 'staking' | 'liquidation';
  amount: number;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
}

interface ActivityData {
  recentTransactions: TransactionMetrics[];
  suspiciousActivities: SuspiciousActivity[];
  activeUsers: number;
  transactionVolume: number;
  alertCount: number;
}

export function ActivityMonitoring() {
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Mock data for demonstration
  const mockActivityData: ActivityData = {
    recentTransactions: [
      {
        transactionId: 'tx_001',
        userId: 'user_123',
        type: 'tokenization',
        amount: 50000,
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        status: 'completed'
      },
      {
        transactionId: 'tx_002',
        userId: 'user_456',
        type: 'lending',
        amount: 25000,
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        status: 'pending'
      },
      {
        transactionId: 'tx_003',
        userId: 'user_789',
        type: 'staking',
        amount: 100000,
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        status: 'failed'
      }
    ],
    suspiciousActivities: [
      {
        userId: 'user_suspicious_1',
        activityType: 'rapid_transactions',
        severity: 'high',
        description: 'User performed 15 transactions in 2 minutes',
        timestamp: new Date(Date.now() - 30 * 60 * 1000)
      },
      {
        userId: 'user_suspicious_2',
        activityType: 'large_amounts',
        severity: 'medium',
        description: 'Transaction amount exceeds 95th percentile',
        timestamp: new Date(Date.now() - 45 * 60 * 1000)
      },
      {
        userId: 'user_suspicious_3',
        activityType: 'failed_attempts',
        severity: 'critical',
        description: '8 failed login attempts in 5 minutes',
        timestamp: new Date(Date.now() - 60 * 60 * 1000)
      }
    ],
    activeUsers: 247,
    transactionVolume: 1250000,
    alertCount: 3
  };

  const fetchActivityData = async () => {
    try {
      setLoading(true);
      // In a real implementation, this would fetch from the monitoring API
      // const response = await fetch('/api/admin/monitoring/activity');
      // const data = await response.json();
      
      // For now, use mock data
      setTimeout(() => {
        setActivityData(mockActivityData);
        setLastUpdated(new Date());
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to fetch activity data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchActivityData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-500/20';
      case 'high': return 'text-orange-400 bg-orange-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'low': return 'text-blue-400 bg-blue-500/20';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-500/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-500/20';
      case 'pending': return 'text-yellow-400 bg-yellow-500/20';
      case 'failed': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-500/20';
    }
  };

  if (loading && !activityData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!activityData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Failed to load activity data</p>
        <button 
          onClick={fetchActivityData}
          className="mt-4 px-4 py-2 bg-blue-600 text-gray-900 dark:text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2 inline" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Activity Monitoring</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <button 
          onClick={fetchActivityData}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-gray-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Activity Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-5 w-5 text-blue-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Live</span>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{activityData.activeUsers}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Active Users</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Activity className="h-5 w-5 text-green-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">24h</span>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(activityData.transactionVolume)}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Transaction Volume</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-purple-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Recent</span>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{activityData.recentTransactions.length}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Recent Transactions</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Active</span>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{activityData.alertCount}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Security Alerts</p>
          </div>
        </div>
      </div>

      {/* Activity Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Recent Transactions
            </h3>
            <button className="text-blue-400 hover:text-blue-300 text-sm">
              View All
            </button>
          </div>
          
          <div className="space-y-3">
            {activityData.recentTransactions.map((transaction) => (
              <div key={transaction.transactionId} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800/30 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(transaction.status)}`}>
                    {transaction.status}
                  </div>
                  <div>
                    <p className="text-gray-900 dark:text-white text-sm font-medium capitalize">{transaction.type}</p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs">User: {transaction.userId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-gray-900 dark:text-white text-sm font-medium">{formatCurrency(transaction.amount)}</p>
                  <p className="text-gray-600 dark:text-gray-400 text-xs">
                    {new Date(transaction.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Suspicious Activities */}
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Suspicious Activities
            </h3>
            <button className="text-blue-400 hover:text-blue-300 text-sm">
              View All
            </button>
          </div>
          
          <div className="space-y-3">
            {activityData.suspiciousActivities.map((activity, index) => (
              <div key={index} className="flex items-start justify-between p-3 bg-gray-100 dark:bg-gray-800/30 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(activity.severity)}`}>
                    {activity.severity}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 dark:text-white text-sm font-medium capitalize">
                      {activity.activityType.replace('_', ' ')}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">{activity.description}</p>
                    <p className="text-gray-500 text-xs mt-1">User: {activity.userId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-gray-600 dark:text-gray-400 text-xs">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </p>
                  <button className="text-blue-400 hover:text-blue-300 text-xs mt-1">
                    <Eye className="w-3 h-3 inline mr-1" />
                    Investigate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center justify-center p-4 bg-blue-600/20 border border-blue-600/30 rounded-lg text-blue-400 hover:bg-blue-600/30 transition-colors">
            <Shield className="w-5 h-5 mr-2" />
            View Full Monitoring Dashboard
          </button>
          <button className="flex items-center justify-center p-4 bg-yellow-600/20 border border-yellow-600/30 rounded-lg text-yellow-400 hover:bg-yellow-600/30 transition-colors">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Review Security Alerts
          </button>
          <button className="flex items-center justify-center p-4 bg-green-600/20 border border-green-600/30 rounded-lg text-green-400 hover:bg-green-600/30 transition-colors">
            <Clock className="w-5 h-5 mr-2" />
            Export Activity Report
          </button>
        </div>
      </div>
    </div>
  );
}