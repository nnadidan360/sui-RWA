'use client';

/**
 * Platform Metrics Component for Admin Dashboard
 * Displays comprehensive platform performance and usage metrics
 * Requirements: 6.3
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Activity,
  Zap,
  RefreshCw,
  Download,
  Calendar
} from 'lucide-react';

interface PlatformMetrics {
  totalAssets: number;
  totalLoans: number;
  totalStaked: number;
  activeUsers: number;
  totalVolume: number;
  utilizationRate: number;
  averageAPY: number;
  liquidationRate: number;
}

interface PerformanceMetrics {
  [operation: string]: {
    totalCount: number;
    successRate: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
  };
}

interface MetricsData {
  platformMetrics: PlatformMetrics;
  performanceMetrics: PerformanceMetrics;
  historicalData: {
    labels: string[];
    volumes: number[];
    users: number[];
  };
}

export function PlatformMetrics() {
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('7d');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Mock data for demonstration
  const mockMetricsData: MetricsData = {
    platformMetrics: {
      totalAssets: 156,
      totalLoans: 89,
      totalStaked: 15000000,
      activeUsers: 2847,
      totalVolume: 45000000,
      utilizationRate: 67.5,
      averageAPY: 8.2,
      liquidationRate: 2.1
    },
    performanceMetrics: {
      tokenization: {
        totalCount: 1250,
        successRate: 98.4,
        averageDuration: 2340,
        minDuration: 890,
        maxDuration: 5670
      },
      lending: {
        totalCount: 3420,
        successRate: 99.1,
        averageDuration: 1890,
        minDuration: 450,
        maxDuration: 4230
      },
      staking: {
        totalCount: 2180,
        successRate: 99.8,
        averageDuration: 1120,
        minDuration: 340,
        maxDuration: 2890
      },
      liquidation: {
        totalCount: 45,
        successRate: 100,
        averageDuration: 3450,
        minDuration: 1200,
        maxDuration: 7890
      }
    },
    historicalData: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      volumes: [2.1, 2.8, 3.2, 2.9, 3.8, 4.2, 3.9],
      users: [180, 220, 250, 240, 290, 320, 310]
    }
  };

  const fetchMetricsData = async () => {
    try {
      setLoading(true);
      // In a real implementation, this would fetch from the monitoring API
      // const response = await fetch(`/api/admin/monitoring/metrics?range=${timeRange}`);
      // const data = await response.json();
      
      // For now, use mock data
      setTimeout(() => {
        setMetricsData(mockMetricsData);
        setLastUpdated(new Date());
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to fetch metrics data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetricsData();
  }, [timeRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1e9) {
      return (num / 1e9).toFixed(1) + 'B';
    }
    if (num >= 1e6) {
      return (num / 1e6).toFixed(1) + 'M';
    }
    if (num >= 1e3) {
      return (num / 1e3).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const exportMetrics = () => {
    // In a real implementation, this would generate and download a report
    console.log('Exporting metrics report...');
  };

  if (loading && !metricsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!metricsData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Failed to load metrics data</p>
        <button 
          onClick={fetchMetricsData}
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Platform Metrics</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Time Range Selector */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            {(['24h', '7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          
          <button 
            onClick={exportMetrics}
            className="flex items-center px-4 py-2 bg-green-600 text-gray-900 dark:text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
          
          <button 
            onClick={fetchMetricsData}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-gray-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Key Platform Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <BarChart3 className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-xs text-green-400">+12%</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatNumber(metricsData.platformMetrics.totalAssets)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Assets</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-400" />
            </div>
            <span className="text-xs text-green-400">+8%</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatNumber(metricsData.platformMetrics.totalLoans)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active Loans</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-400" />
            </div>
            <span className="text-xs text-green-400">+15%</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(metricsData.platformMetrics.totalStaked)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Staked</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Users className="h-5 w-5 text-orange-400" />
            </div>
            <span className="text-xs text-green-400">+5%</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatNumber(metricsData.platformMetrics.activeUsers)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Activity className="h-5 w-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(metricsData.platformMetrics.totalVolume)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Volume</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Zap className="h-5 w-5 text-yellow-400" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {metricsData.platformMetrics.utilizationRate.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Utilization Rate</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-400" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {metricsData.platformMetrics.averageAPY.toFixed(2)}%
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Average APY</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <Activity className="h-5 w-5 text-red-400" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {metricsData.platformMetrics.liquidationRate.toFixed(2)}%
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Liquidation Rate</p>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Performance Metrics</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(metricsData.performanceMetrics).map(([operation, metrics]) => (
            <div key={operation} className="bg-gray-100 dark:bg-gray-800/30 rounded-lg p-4">
              <h4 className="font-medium capitalize text-gray-900 dark:text-white mb-3">{operation}</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Requests:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{formatNumber(metrics.totalCount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Success Rate:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{metrics.successRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Avg Duration:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{metrics.averageDuration.toFixed(0)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Min/Max:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {metrics.minDuration}ms / {metrics.maxDuration}ms
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Historical Trends */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Historical Trends</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Volume Trend */}
          <div className="bg-gray-100 dark:bg-gray-800/30 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-4">Transaction Volume (M)</h4>
            <div className="flex items-end space-x-2 h-32">
              {metricsData.historicalData.volumes.map((volume, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${(volume / Math.max(...metricsData.historicalData.volumes)) * 100}%` }}
                  ></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    {metricsData.historicalData.labels[index]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* User Activity Trend */}
          <div className="bg-gray-100 dark:bg-gray-800/30 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-4">Active Users</h4>
            <div className="flex items-end space-x-2 h-32">
              {metricsData.historicalData.users.map((users, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-green-500 rounded-t"
                    style={{ height: `${(users / Math.max(...metricsData.historicalData.users)) * 100}%` }}
                  ></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    {metricsData.historicalData.labels[index]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}