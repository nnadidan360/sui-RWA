'use client';

import { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Info
} from 'lucide-react';
import { LendingPool } from '@/types/lending';

interface LendingPoolsProps {
  pools: LendingPool[];
}

export function LendingPools({ pools }: LendingPoolsProps) {
  const [selectedPool, setSelectedPool] = useState<string | null>(null);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
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

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Lending Pools</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <Info className="w-4 h-4" />
          <span>Supply assets to earn interest or borrow against collateral</span>
        </div>
      </div>

      {/* Pools Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {pools.map((pool) => (
          <div
            key={pool.id}
            className={`bg-gray-900/50 border rounded-2xl p-6 transition-all duration-200 cursor-pointer ${
              selectedPool === pool.id
                ? 'border-blue-500 bg-blue-500/5'
                : 'border-gray-800 hover:border-gray-700'
            }`}
            onClick={() => setSelectedPool(selectedPool === pool.id ? null : pool.id)}
          >
            {/* Pool Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-gray-900 dark:text-white font-bold text-sm">{pool.asset}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{pool.name}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {formatNumber(pool.totalDeposits)} {pool.asset} deposited
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center space-x-1 text-green-400 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>{formatPercentage(pool.supplyAPY)}</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-xs">Supply APY</p>
              </div>
            </div>

            {/* Pool Metrics */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">Total Supplied</span>
                  <ArrowUpRight className="w-4 h-4 text-green-400" />
                </div>
                <p className="text-gray-900 dark:text-white font-semibold">
                  {formatNumber(pool.totalDeposits)} {pool.asset}
                </p>
                <p className="text-gray-500 text-xs">
                  {formatCurrency(pool.totalDeposits * (pool.asset === 'CSPR' ? 0.05 : 1))}
                </p>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">Total Borrowed</span>
                  <ArrowDownRight className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-gray-900 dark:text-white font-semibold">
                  {formatNumber(pool.totalBorrows)} {pool.asset}
                </p>
                <p className="text-gray-500 text-xs">
                  {formatCurrency(pool.totalBorrows * (pool.asset === 'CSPR' ? 0.05 : 1))}
                </p>
              </div>
            </div>

            {/* Utilization Rate */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 dark:text-gray-400 text-sm">Utilization Rate</span>
                <span className="text-gray-900 dark:text-white font-medium">{formatPercentage(pool.utilizationRate)}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div 
                  className="h-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${pool.utilizationRate}%` }}
                />
              </div>
            </div>

            {/* APY Comparison */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-green-400 font-semibold">{formatPercentage(pool.supplyAPY)}</p>
                <p className="text-gray-600 dark:text-gray-400 text-xs">Supply APY</p>
              </div>
              <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-blue-400 font-semibold">{formatPercentage(pool.borrowAPY)}</p>
                <p className="text-gray-600 dark:text-gray-400 text-xs">Borrow APR</p>
              </div>
            </div>

            {/* Expanded Details */}
            {selectedPool === pool.id && (
              <div className="mt-6 pt-6 border-t border-gray-800 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Available Liquidity</span>
                    <span className="text-gray-900 dark:text-white">{formatNumber(pool.availableLiquidity)} {pool.asset}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Reserves</span>
                    <span className="text-gray-900 dark:text-white">{formatNumber(pool.totalReserves)} {pool.asset}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Collateral Factor</span>
                    <span className="text-gray-900 dark:text-white">{formatPercentage(pool.collateralFactor * 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Liquidation Threshold</span>
                    <span className="text-gray-900 dark:text-white">{formatPercentage(pool.liquidationThreshold * 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Liquidation Penalty</span>
                    <span className="text-red-400">{formatPercentage(pool.liquidationPenalty * 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Reserve Factor</span>
                    <span className="text-gray-900 dark:text-white">{formatPercentage(pool.reserveFactor * 100)}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
                  <button className="flex-1 bg-green-500 hover:bg-green-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-lg transition-colors">
                    Supply {pool.asset}
                  </button>
                  <button className="flex-1 bg-blue-500 hover:bg-blue-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-lg transition-colors">
                    Borrow {pool.asset}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pool Statistics Summary */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Protocol Statistics</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-green-500/20 rounded-lg mx-auto mb-3">
              <DollarSign className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(pools.reduce((sum, pool) => sum + pool.totalDeposits * (pool.asset === 'CSPR' ? 0.05 : 1), 0))}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Total Value Locked</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-lg mx-auto mb-3">
              <BarChart3 className="w-6 h-6 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatPercentage(pools.reduce((sum, pool) => sum + pool.utilizationRate, 0) / pools.length)}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Avg Utilization</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-500/20 rounded-lg mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatPercentage(pools.reduce((sum, pool) => sum + pool.supplyAPY, 0) / pools.length)}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Avg Supply APY</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-orange-500/20 rounded-lg mx-auto mb-3">
              <Users className="w-6 h-6 text-orange-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{pools.length}</p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Active Pools</p>
          </div>
        </div>
      </div>
    </div>
  );
}