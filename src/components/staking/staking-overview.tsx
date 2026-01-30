'use client';

import { useState } from 'react';
import { 
  Zap, 
  TrendingUp, 
  Shield, 
  Clock,
  DollarSign,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Plus
} from 'lucide-react';
import { StakingPositions } from '@/components/staking/staking-positions';
import { ValidatorList } from '@/components/staking/validator-list';
import { StakingMetrics } from '@/components/staking/staking-metrics';
import { StakeModal } from '@/components/staking/stake-modal';
import { UnstakeModal } from '@/components/staking/unstake-modal';
import { useStakingMetrics, useNetworkStats, useBlockchainSync, useUserData } from '@/hooks/use-blockchain-data';

type ActiveTab = 'overview' | 'stake' | 'validators' | 'positions';

export function StakingOverview() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [showUnstakeModal, setShowUnstakeModal] = useState(false);

  // Use real blockchain data instead of mock data
  const { data: userData, loading: stakingLoading, error: stakingError } = useUserData();
  const { data: networkStats, loading: networkLoading, error: networkError } = useNetworkStats();
  // const { lastUpdate, isOnline } = useBlockchainSync();

  // Extract staking metrics from user data
  const stakingMetrics = userData?.stakingMetrics;

  const formatCurrency = (amount: number, currency: string = 'CSPR') => {
    if (currency === 'CSPR') {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Liquid Staking</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Stake CSPR tokens while maintaining liquidity</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowUnstakeModal(true)}
            className="inline-flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-xl transition-all duration-200"
          >
            <ArrowDownRight className="w-5 h-5 mr-2" />
            Unstake
          </button>
          <button
            onClick={() => setShowStakeModal(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-gray-900 dark:text-white font-medium rounded-xl transition-all duration-200"
          >
            <Plus className="w-5 h-5 mr-2" />
            Stake CSPR
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'stake', label: 'Stake' },
            { id: 'validators', label: 'Validators' },
            { id: 'positions', label: 'My Positions' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Personal Staking Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Staked */}
            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Zap className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex items-center text-sm text-blue-400">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  Active
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {stakingLoading ? 'Loading...' : formatCurrency(stakingMetrics?.totalStaked || 0)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Staked</p>
                {/* {!isOnline && (
                  <p className="text-xs text-orange-400 mt-1">Offline mode</p>
                )} */}
              </div>
            </div>

            {/* Current Value */}
            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-400" />
                </div>
                <div className="flex items-center text-sm text-green-400">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  {stakingLoading ? '...' : stakingMetrics && stakingMetrics.totalStaked > 0 
                    ? `+${formatPercentage(((stakingMetrics.currentValue - stakingMetrics.totalStaked) / stakingMetrics.totalStaked) * 100)}`
                    : '+0.00%'
                  }
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {stakingLoading ? 'Loading...' : formatCurrency(stakingMetrics?.currentValue || 0)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Current Value</p>
              </div>
            </div>

            {/* Total Rewards */}
            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-400" />
                </div>
                <div className="flex items-center text-sm text-purple-400">
                  <ArrowUpRight className="w-4 h-4 mr-1" />
                  Earned
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {stakingLoading ? 'Loading...' : formatCurrency(stakingMetrics?.totalRewards || 0)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Rewards</p>
              </div>
            </div>

            {/* APR */}
            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Shield className="h-5 w-5 text-orange-400" />
                </div>
                <div className="flex items-center text-sm text-orange-400">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  APR
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {stakingLoading ? 'Loading...' : formatPercentage(stakingMetrics?.apr || 0)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Current APR</p>
              </div>
            </div>
          </div>

          {/* Exchange Rate & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Exchange Rate Info */}
            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Exchange Rate</h3>
                <div className="flex items-center space-x-2 text-sm text-green-400">
                  <TrendingUp className="w-4 h-4" />
                  <span>Growing</span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">1 CSPR =</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {stakingLoading ? 'Loading...' : (stakingMetrics?.exchangeRate || 1.0).toFixed(4)} stCSPR
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">1 stCSPR =</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {stakingLoading ? 'Loading...' : (1 / (stakingMetrics?.exchangeRate || 1.0)).toFixed(4)} CSPR
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Your stCSPR Balance</span>
                  <span className="text-green-400 font-medium">
                    {stakingLoading ? 'Loading...' : formatCurrency((stakingMetrics?.totalStaked || 0) * (stakingMetrics?.exchangeRate || 1.0), 'stCSPR')}
                  </span>
                </div>
              </div>

              <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-400">Liquid Staking Benefits</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Your stCSPR tokens automatically accrue staking rewards and can be used as collateral in lending.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Quick Actions</h3>
              
              <div className="space-y-4">
                <button
                  onClick={() => setShowStakeModal(true)}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/10 to-purple-600/10 border border-blue-500/20 rounded-xl hover:from-blue-500/20 hover:to-purple-600/20 transition-all duration-200"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <Zap className="w-5 h-5 text-gray-900 dark:text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-gray-900 dark:text-white font-medium">Stake CSPR</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        Earn {stakingLoading ? '...' : formatPercentage(stakingMetrics?.apr || 0)} APR
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>

                <button
                  onClick={() => setShowUnstakeModal(true)}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-gray-500/10 to-gray-600/10 border border-gray-500/20 rounded-xl hover:from-gray-500/20 hover:to-gray-600/20 transition-all duration-200"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gray-600 rounded-lg">
                      <ArrowDownRight className="w-5 h-5 text-gray-900 dark:text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-gray-900 dark:text-white font-medium">Unstake Tokens</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">21-day unbonding period</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>

                <button className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-green-500/10 to-emerald-600/10 border border-green-500/20 rounded-xl hover:from-green-500/20 hover:to-emerald-600/20 transition-all duration-200">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-500 rounded-lg">
                      <DollarSign className="w-5 h-5 text-gray-900 dark:text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-gray-900 dark:text-white font-medium">Claim Rewards</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        Available: {stakingLoading ? 'Loading...' : formatCurrency((stakingMetrics?.totalRewards || 0) * 0.1)}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Network Statistics */}
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Network Statistics</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-lg mx-auto mb-3">
                  <DollarSign className="w-6 h-6 text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {networkLoading ? 'Loading...' : formatCurrency(networkStats?.totalValueLocked || 0)}
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Total Value Locked</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-green-500/20 rounded-lg mx-auto mb-3">
                  <Users className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {networkLoading ? 'Loading...' : (networkStats?.totalStakers || 0).toLocaleString()}
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Total Stakers</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-purple-500/20 rounded-lg mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {networkLoading ? 'Loading...' : formatPercentage(networkStats?.averageAPR || 0)}
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Average APR</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-orange-500/20 rounded-lg mx-auto mb-3">
                  <Shield className="w-6 h-6 text-orange-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {networkLoading ? 'Loading...' : (networkStats?.activeValidators || 0)}
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Active Validators</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-red-500/20 rounded-lg mx-auto mb-3">
                  <Clock className="w-6 h-6 text-red-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {networkLoading ? 'Loading...' : formatPercentage(networkStats?.networkStakingRatio || 0)}
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Network Staking Ratio</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stake Tab */}
      {activeTab === 'stake' && (
        <div className="space-y-6">
          <StakingMetrics />
          <ValidatorList />
        </div>
      )}

      {/* Validators Tab */}
      {activeTab === 'validators' && (
        <div className="space-y-6">
          <ValidatorList />
        </div>
      )}

      {/* Positions Tab */}
      {activeTab === 'positions' && (
        <div className="space-y-6">
          <StakingPositions />
        </div>
      )}

      {/* Modals */}
      {showStakeModal && (
        <StakeModal
          isOpen={showStakeModal}
          onClose={() => setShowStakeModal(false)}
        />
      )}

      {showUnstakeModal && (
        <UnstakeModal
          isOpen={showUnstakeModal}
          onClose={() => setShowUnstakeModal(false)}
        />
      )}
    </div>
  );
}