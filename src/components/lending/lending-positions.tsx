'use client';

import { useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Percent, 
  ArrowUpRight,
  MoreVertical,
  Eye,
  Minus,
  Plus,
  PieChart
} from 'lucide-react';
import { UserLendingPosition } from '@/types/lending';
import { useUserData, useBlockchainTransaction } from '@/hooks/use-blockchain-data';

// Mock data - replace with real data from API
const mockPositions: UserLendingPosition[] = [
  {
    poolId: '1',
    poolName: 'CSPR Pool',
    asset: 'CSPR',
    suppliedAmount: 50000,
    poolTokens: 48500,
    currentValue: 52750,
    earnedInterest: 2750,
    apy: 6.5,
    shareOfPool: 3.33,
  },
  {
    poolId: '2',
    poolName: 'USD Pool',
    asset: 'USDC',
    suppliedAmount: 25000,
    poolTokens: 25100,
    currentValue: 25525,
    earnedInterest: 525,
    apy: 4.2,
    shareOfPool: 3.0,
  },
];

export function LendingPositions() {
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState<string | null>(null);

  // Get real user data
  const { data: userData, loading } = useUserData();
  const { executeDeposit, loading: depositLoading } = useBlockchainTransaction();

  // Convert user transactions to lending positions (simplified)
  const userPositions: UserLendingPosition[] = userData?.transactions
    ?.filter(tx => tx.type === 'transfer' && tx.metadata?.type === 'deposit' && tx.status === 'confirmed')
    ?.map((tx, index) => ({
      poolId: `pool-${index + 1}`,
      poolName: `${tx.currency} Pool`,
      asset: tx.currency,
      suppliedAmount: tx.amount,
      poolTokens: tx.amount * 0.97, // Assume 3% fee
      currentValue: tx.amount * 1.055, // Assume 5.5% growth
      earnedInterest: tx.amount * 0.055,
      apy: 5.5,
      shareOfPool: 2.5, // Simplified
    })) || [];

  // Show loading state
  if (loading) {
    if (currency === 'CSPR') {
      return `${amount.toLocaleString()} CSPR`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getTotalValue = () => {
    return userPositions.reduce((sum, pos) => {
      const usdValue = pos.asset === 'CSPR' ? pos.currentValue * 0.05 : pos.currentValue;
      return sum + usdValue;
    }, 0);
  };

  const getTotalEarnings = () => {
    return userPositions.reduce((sum, pos) => {
      const usdValue = pos.asset === 'CSPR' ? pos.earnedInterest * 0.05 : pos.earnedInterest;
      return sum + usdValue;
    }, 0);
  };

  const getWeightedAPY = () => {
    const totalValue = getTotalValue();
    if (totalValue === 0) return 0;
    
    return userPositions.reduce((sum, pos) => {
      const usdValue = pos.asset === 'CSPR' ? pos.currentValue * 0.05 : pos.currentValue;
      const weight = usdValue / totalValue;
      return sum + (pos.apy * weight);
    }, 0);
  };

  if (userPositions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-8">
        <div className="text-center">
          <PieChart className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Lending Positions</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You haven't supplied any assets yet. Start earning interest by supplying to lending pools.
          </p>
          <button className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-gray-900 dark:text-white font-medium rounded-xl transition-all duration-200">
            Start Lending
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Lending Positions</h2>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {userPositions.length} active position{userPositions.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-400" />
            </div>
            <div className="flex items-center text-sm text-green-400">
              <TrendingUp className="w-4 h-4 mr-1" />
              +{getTotalEarnings() > 0 ? formatPercentage((getTotalEarnings() / (getTotalValue() - getTotalEarnings())) * 100) : '0.00%'}
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(getTotalValue())}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Value</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <ArrowUpRight className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex items-center text-sm text-blue-400">
              <TrendingUp className="w-4 h-4 mr-1" />
              +{formatPercentage(getWeightedAPY())}
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(getTotalValue() - getTotalEarnings())}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Supplied</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Percent className="h-5 w-5 text-purple-400" />
            </div>
            <div className="flex items-center text-sm text-purple-400">
              <TrendingUp className="w-4 h-4 mr-1" />
              APY
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatPercentage(getWeightedAPY())}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Weighted APY</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <TrendingUp className="h-5 w-5 text-orange-400" />
            </div>
            <div className="flex items-center text-sm text-orange-400">
              <TrendingUp className="w-4 h-4 mr-1" />
              Earned
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(getTotalEarnings())}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Earned</p>
          </div>
        </div>
      </div>

      {/* Positions List */}
      <div className="space-y-4">
        {userPositions.map((position) => (
          <div
            key={position.poolId}
            className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm hover:border-gray-700 rounded-2xl p-6 transition-all duration-200"
          >
            {/* Position Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-gray-900 dark:text-white font-bold text-sm">{position.asset}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{position.poolName}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {formatPercentage(position.shareOfPool)} of pool • {formatPercentage(position.apy)} APY
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-gray-900 dark:text-white font-semibold">
                    {formatCurrency(position.currentValue, position.asset === 'CSPR' ? 'USD' : position.asset)}
                  </p>
                  <p className="text-green-400 text-sm">
                    +{formatCurrency(position.earnedInterest, position.asset === 'CSPR' ? 'USD' : position.asset)} earned
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
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Supplied Amount</p>
                <p className="text-gray-900 dark:text-white font-semibold text-lg">
                  {formatCurrency(position.suppliedAmount, position.asset)}
                </p>
                {position.asset === 'CSPR' && (
                  <p className="text-gray-500 text-xs">
                    ≈ {formatCurrency(position.suppliedAmount * 0.05)}
                  </p>
                )}
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Current Value</p>
                <p className="text-gray-900 dark:text-white font-semibold text-lg">
                  {formatCurrency(position.currentValue, position.asset)}
                </p>
                {position.asset === 'CSPR' && (
                  <p className="text-gray-500 text-xs">
                    ≈ {formatCurrency(position.currentValue * 0.05)}
                  </p>
                )}
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Interest Earned</p>
                <p className="text-green-400 font-semibold text-lg">
                  +{formatCurrency(position.earnedInterest, position.asset)}
                </p>
                <p className="text-gray-500 text-xs">
                  {formatPercentage((position.earnedInterest / position.suppliedAmount) * 100)} return
                </p>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Pool Tokens</p>
                <p className="text-gray-900 dark:text-white font-semibold text-lg">
                  {position.poolTokens.toLocaleString()}
                </p>
                <p className="text-gray-500 text-xs">
                  {formatPercentage(position.shareOfPool)} of pool
                </p>
              </div>
            </div>

            {/* APY Progress */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 dark:text-gray-400 text-sm">Annual Percentage Yield</span>
                <span className="text-green-400 font-medium">{formatPercentage(position.apy)}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div 
                  className="h-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(position.apy * 10, 100)}%` }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button className="flex-1 bg-green-500 hover:bg-green-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center">
                <Plus className="w-4 h-4 mr-2" />
                Supply More
              </button>
              <button
                onClick={() => setShowWithdrawModal(position.poolId)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                <Minus className="w-4 h-4 mr-2" />
                Withdraw
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
                  <span className="text-green-400 font-medium text-sm">Performing Well</span>
                </div>
                <span className="text-gray-300 text-sm">
                  Earning {formatPercentage(position.apy)} annually
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Portfolio Allocation */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Portfolio Allocation</h3>
        
        <div className="space-y-4">
          {userPositions.map((position) => {
            const usdValue = position.asset === 'CSPR' ? position.currentValue * 0.05 : position.currentValue;
            const percentage = getTotalValue() > 0 ? (usdValue / getTotalValue()) * 100 : 0;
            
            return (
              <div key={position.poolId} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                    <span className="text-gray-900 dark:text-white font-bold text-xs">{position.asset}</span>
                  </div>
                  <div>
                    <p className="text-gray-900 dark:text-white font-medium">{position.poolName}</p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{formatPercentage(position.apy)} APY</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-gray-900 dark:text-white font-medium">{formatCurrency(usdValue)}</p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{formatPercentage(percentage)}</p>
                  </div>
                  
                  <div className="w-24 bg-gray-800 rounded-full h-2">
                    <div 
                      className="h-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
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