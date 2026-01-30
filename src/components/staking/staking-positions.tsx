'use client';

import { useState } from 'react';
import { 
  Zap,
  Shield, 
  TrendingUp, 
  Clock, 
  DollarSign,
  MoreVertical,
  Eye,
  Plus,
  Minus,
  ArrowUpRight,
  CheckCircle,
  AlertTriangle,
  Wallet
} from 'lucide-react';
import { StakingPosition, UnbondingStatus } from '@/types/staking';
import { useUserData } from '@/hooks/use-blockchain-data';


// Mock staking positions data (fallback)
const mockPositions: StakingPosition[] = [
  {
    id: '1',
    staker: '0x1234...5678',
    stakedAmount: 50000,
    derivativeTokens: 52500,
    externalWalletId: 'wallet-001',
    delegatedValidators: [
      {
        validatorAddress: '0x1234...5678',
        validatorName: 'Casper Validator 1',
        amount: 30000,
        delegatedAt: new Date('2024-01-15'),
        rewards: 1800,
        apr: 8.7,
      },
      {
        validatorAddress: '0x2345...6789',
        validatorName: 'Secure Staking Co',
        amount: 20000,
        delegatedAt: new Date('2024-01-20'),
        rewards: 1100,
        apr: 8.9,
      },
    ],
    rewardsEarned: 2900,
    currentValue: 52900,
    exchangeRate: 1.058,
    unbondingRequests: [
      {
        id: 'unbond-1',
        amount: 5000,
        csperAmount: 4717,
        initiatedAt: new Date('2024-02-01'),
        completesAt: new Date('2024-02-22'),
        status: 'pending',
        estimatedValue: 4717,
      },
    ],
    createdAt: new Date('2024-01-15'),
    lastRewardClaim: new Date('2024-02-10'),
  },
  {
    id: '2',
    staker: '0x1234...5678',
    stakedAmount: 25000,
    derivativeTokens: 26250,
    externalWalletId: 'wallet-002',
    delegatedValidators: [
      {
        validatorAddress: '0x3456...7890',
        validatorName: 'Community Validator',
        amount: 25000,
        delegatedAt: new Date('2024-02-01'),
        rewards: 650,
        apr: 8.4,
      },
    ],
    rewardsEarned: 650,
    currentValue: 25650,
    exchangeRate: 1.026,
    unbondingRequests: [],
    createdAt: new Date('2024-02-01'),
    lastRewardClaim: new Date('2024-02-15'),
  },
];

const unbondingStatusConfig: Record<UnbondingStatus, { icon: any; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Pending' },
  ready: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Ready' },
  completed: { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Completed' },
  cancelled: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Cancelled' },
};

export function StakingPositions() {
  const { data: userData, loading, error } = useUserData();
  const [showUnstakeModal, setShowUnstakeModal] = useState<string | null>(null);

  // Use real data if available, fallback to mock data for demo
  const positions: StakingPosition[] = []; // userData?.stakingMetrics?.positions || [];
  const hasRealData = userData && positions.length > 0;
  const displayPositions = hasRealData ? positions : mockPositions;

  const formatCurrency = (amount: number, currency: string = 'CSPR') => {
    if (currency === 'CSPR' || currency === 'stCSPR') {
      return `${amount.toLocaleString()} ${currency}`;
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

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const getDaysRemaining = (date: Date) => {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getTotalStaked = () => {
    return displayPositions.reduce((sum, pos) => sum + pos.stakedAmount, 0);
  };

  const getTotalValue = () => {
    return displayPositions.reduce((sum, pos) => sum + pos.currentValue, 0);
  };

  const getTotalRewards = () => {
    return displayPositions.reduce((sum, pos) => sum + pos.rewardsEarned, 0);
  };

  const getWeightedAPR = () => {
    const totalValue = getTotalValue();
    if (totalValue === 0) return 0;
    
    return displayPositions.reduce((sum, pos) => {
      const weight = pos.currentValue / totalValue;
      const avgAPR = pos.delegatedValidators.reduce((aprSum, val) => aprSum + val.apr, 0) / pos.delegatedValidators.length;
      return sum + (avgAPR * weight);
    }, 0);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading Staking Data</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Fetching your staking positions from the blockchain...
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-8">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error Loading Data</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            {hasRealData ? 'Showing cached data below.' : 'Using demo data for display.'}
          </p>
        </div>
      </div>
    );
  }

  if (displayPositions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-8">
        <div className="text-center">
          <Zap className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Staking Positions</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You haven't staked any CSPR tokens yet. Start earning rewards by staking your tokens.
          </p>
          <button className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-gray-900 dark:text-white font-medium rounded-xl transition-all duration-200">
            Start Staking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Staking Positions</h2>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {displayPositions.length} active position{displayPositions.length !== 1 ? 's' : ''}
          </div>
          {!hasRealData && (
            <div className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-lg">
              Demo Data
            </div>
          )}
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Zap className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex items-center text-sm text-blue-400">
              <TrendingUp className="w-4 h-4 mr-1" />
              Staked
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(getTotalStaked())}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Staked</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-400" />
            </div>
            <div className="flex items-center text-sm text-green-400">
              <TrendingUp className="w-4 h-4 mr-1" />
              +{formatPercentage(((getTotalValue() - getTotalStaked()) / getTotalStaked()) * 100)}
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(getTotalValue())}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Current Value</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
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
              {formatCurrency(getTotalRewards())}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Rewards</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
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
              {formatPercentage(getWeightedAPR())}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Weighted APR</p>
          </div>
        </div>
      </div>

      {/* Positions List */}
      <div className="space-y-4">
        {displayPositions.map((position) => (
          <div
            key={position.id}
            className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm hover:border-gray-700 rounded-2xl p-6 transition-all duration-200"
          >
            {/* Position Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Staking Position #{position.id}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Created {formatDate(position.createdAt)} • {position.delegatedValidators.length} validator{position.delegatedValidators.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-gray-900 dark:text-white font-semibold">
                    {formatCurrency(position.currentValue)}
                  </p>
                  <p className="text-green-400 text-sm">
                    +{formatCurrency(position.rewardsEarned)} earned
                  </p>
                </div>

                <div className="relative">
                  <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Position Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Staked Amount</p>
                <p className="text-gray-900 dark:text-white font-semibold text-lg">
                  {formatCurrency(position.stakedAmount)}
                </p>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">stCSPR Tokens</p>
                <p className="text-gray-900 dark:text-white font-semibold text-lg">
                  {formatCurrency(position.derivativeTokens, 'stCSPR')}
                </p>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Exchange Rate</p>
                <p className="text-gray-900 dark:text-white font-semibold text-lg">
                  {position.exchangeRate.toFixed(4)}
                </p>
                <p className="text-gray-500 text-xs">stCSPR per CSPR</p>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Rewards Earned</p>
                <p className="text-green-400 font-semibold text-lg">
                  +{formatCurrency(position.rewardsEarned)}
                </p>
                <p className="text-gray-500 text-xs">
                  {formatPercentage((position.rewardsEarned / position.stakedAmount) * 100)} return
                </p>
              </div>
            </div>

            {/* Validator Delegations */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Validator Delegations</h4>
              <div className="space-y-2">
                {position.delegatedValidators.map((delegation, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800/30 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <Shield className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-gray-900 dark:text-white font-medium text-sm">{delegation.validatorName}</p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          Delegated {formatDate(delegation.delegatedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-900 dark:text-white font-medium text-sm">
                        {formatCurrency(delegation.amount)}
                      </p>
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="text-green-400">
                          +{formatCurrency(delegation.rewards)} rewards
                        </span>
                        <span className="text-blue-400">
                          {formatPercentage(delegation.apr)} APR
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Unbonding Requests */}
            {position.unbondingRequests.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Unbonding Requests</h4>
                <div className="space-y-2">
                  {position.unbondingRequests.map((request) => {
                    const status = unbondingStatusConfig[request.status];
                    const StatusIcon = status.icon;
                    const daysRemaining = getDaysRemaining(request.completesAt);

                    return (
                      <div key={request.id} className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg ${status.bg} ${status.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </div>
                          <div>
                            <p className="text-gray-900 dark:text-white font-medium text-sm">
                              {formatCurrency(request.amount, 'stCSPR')} → {formatCurrency(request.csperAmount)}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 text-xs">
                              {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Ready to claim'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-900 dark:text-white font-medium text-sm">
                            {formatCurrency(request.estimatedValue)}
                          </p>
                          {daysRemaining === 0 && (
                            <button className="text-green-400 hover:text-green-300 text-xs">
                              Claim Now
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button className="flex-1 bg-blue-500 hover:bg-blue-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center">
                <Plus className="w-4 h-4 mr-2" />
                Add Stake
              </button>
              <button
                onClick={() => setShowUnstakeModal(position.id)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                <Minus className="w-4 h-4 mr-2" />
                Unstake
              </button>
              <button className="flex-1 bg-green-600 hover:bg-green-700 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-lg transition-colors">
                Claim Rewards
              </button>
              <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                <Eye className="w-4 h-4" />
              </button>
            </div>

            {/* Performance Indicator */}
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-medium text-sm">Earning Rewards</span>
                </div>
                <span className="text-gray-300 text-sm">
                  Last claim: {formatDate(position.lastRewardClaim)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Portfolio Allocation */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Validator Allocation</h3>
        
        <div className="space-y-4">
          {displayPositions.flatMap(pos => pos.delegatedValidators).map((delegation, index) => {
            const totalDelegated = displayPositions.flatMap(pos => pos.delegatedValidators).reduce((sum, del) => sum + del.amount, 0);
            const percentage = (delegation.amount / totalDelegated) * 100;
            
            return (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Shield className="w-4 h-4 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <p className="text-gray-900 dark:text-white font-medium">{delegation.validatorName}</p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{formatPercentage(delegation.apr)} APR</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-gray-900 dark:text-white font-medium">{formatCurrency(delegation.amount)}</p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{formatPercentage(percentage)}</p>
                  </div>
                  
                  <div className="w-24 bg-gray-800 rounded-full h-2">
                    <div 
                      className="h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}