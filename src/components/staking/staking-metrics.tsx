'use client';

import { 
  TrendingUp, 
  DollarSign, 
  Users,
  Shield, 
  Zap,
  Activity
} from 'lucide-react';
import { StakingMetrics as StakingMetricsType } from '@/types/staking';

// Mock metrics data
const mockMetrics: StakingMetricsType = {
  totalValueLocked: 15000000,
  totalStakers: 2847,
  averageAPR: 8.2,
  exchangeRate: 1.058,
  totalRewardsDistributed: 1250000,
  activeValidators: 45,
  networkStakingRatio: 65.4,
};

const networkInfo = {
  currentEpoch: 1247,
  epochDuration: 7200, // 2 hours in seconds
  totalSupply: 10500000000,
  totalStaked: 6867000000,
  inflationRate: 8.0,
  averageBlockTime: 65, // seconds
};

export function StakingMetrics() {
  const formatCurrency = (amount: number, currency: string = 'CSPR') => {
    if (currency === 'CSPR') {
      if (amount >= 1000000000) {
        return `${(amount / 1000000000).toFixed(1)}B CSPR`;
      } else if (amount >= 1000000) {
        return `${(amount / 1000000).toFixed(1)}M CSPR`;
      } else if (amount >= 1000) {
        return `${(amount / 1000).toFixed(1)}K CSPR`;
      }
      return `${amount.toLocaleString()} CSPR`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Network Metrics</h2>
        <div className="flex items-center space-x-2 text-sm text-green-400">
          <Activity className="w-4 h-4" />
          <span>Live Data</span>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Value Locked */}
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <DollarSign className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex items-center text-sm text-blue-400">
              <TrendingUp className="w-4 h-4 mr-1" />
              +12.5%
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(mockMetrics.totalValueLocked)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Value Locked</p>
          </div>
        </div>

        {/* Total Stakers */}
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Users className="h-5 w-5 text-green-400" />
            </div>
            <div className="flex items-center text-sm text-green-400">
              <TrendingUp className="w-4 h-4 mr-1" />
              +8.3%
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {mockMetrics.totalStakers.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Stakers</p>
          </div>
        </div>

        {/* Average APR */}
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-400" />
            </div>
            <div className="flex items-center text-sm text-purple-400">
              <TrendingUp className="w-4 h-4 mr-1" />
              +0.2%
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatPercentage(mockMetrics.averageAPR)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Average APR</p>
          </div>
        </div>

        {/* Active Validators */}
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Shield className="h-5 w-5 text-orange-400" />
            </div>
            <div className="flex items-center text-sm text-orange-400">
              <TrendingUp className="w-4 h-4 mr-1" />
              +2
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {mockMetrics.activeValidators}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active Validators</p>
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Network Statistics */}
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Network Statistics</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Network Staking Ratio</span>
              <span className="text-gray-900 dark:text-white font-medium">{formatPercentage(mockMetrics.networkStakingRatio)}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div 
                className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${mockMetrics.networkStakingRatio}%` }}
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Total Supply</span>
              <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(networkInfo.totalSupply)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Total Staked</span>
              <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(networkInfo.totalStaked)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Inflation Rate</span>
              <span className="text-gray-900 dark:text-white font-medium">{formatPercentage(networkInfo.inflationRate)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Exchange Rate</span>
              <span className="text-gray-900 dark:text-white font-medium">1 CSPR = {mockMetrics.exchangeRate.toFixed(4)} stCSPR</span>
            </div>
          </div>
        </div>

        {/* Epoch Information */}
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Epoch Information</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Current Epoch</span>
              <span className="text-gray-900 dark:text-white font-medium">#{networkInfo.currentEpoch.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Epoch Duration</span>
              <span className="text-gray-900 dark:text-white font-medium">{formatTime(networkInfo.epochDuration)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Average Block Time</span>
              <span className="text-gray-900 dark:text-white font-medium">{networkInfo.averageBlockTime}s</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Total Rewards Distributed</span>
              <span className="text-green-400 font-medium">{formatCurrency(mockMetrics.totalRewardsDistributed)}</span>
            </div>

            {/* Epoch Progress */}
            <div className="mt-6">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Epoch Progress</span>
                <span>67%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div className="h-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-full w-2/3 transition-all duration-300" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Next epoch in approximately 45 minutes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Staking Benefits */}
      <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Why Stake with Liquid Staking?</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Zap className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white font-medium mb-2">Maintain Liquidity</h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Receive stCSPR tokens that can be used in DeFi while earning staking rewards.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white font-medium mb-2">Automatic Compounding</h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Rewards are automatically reinvested, increasing your stCSPR balance over time.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white font-medium mb-2">Professional Management</h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Stake across multiple high-performance validators with optimal delegation strategies.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}