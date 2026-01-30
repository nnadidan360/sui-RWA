'use client';

import { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Shield, 
  AlertTriangle,
  Plus,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { LendingPools } from './lending-pools';
import { BorrowPositions } from './borrow-positions';
import { LendingPositions } from './lending-positions';
import { BorrowModal } from './borrow-modal';
import { SupplyModal } from './supply-modal';
import { useUserData, useNetworkStats, useLendingPoolInfo } from '@/hooks/use-blockchain-data';

type ActiveTab = 'overview' | 'borrow' | 'lend' | 'positions';

export function LendingOverview() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);

  // Get real data instead of mock data
  const { data: userData, loading: userLoading } = useUserData();
  const { data: networkStats, loading: networkLoading } = useNetworkStats();
  const { data: lendingPoolInfo, loading: poolLoading } = useLendingPoolInfo();

  // Calculate stats from real data
  const mockStats = {
    totalSupplied: userData?.lendingPosition ? parseFloat(userData.lendingPosition.deposits) : 0,
    totalBorrowed: userData?.lendingPosition ? parseFloat(userData.lendingPosition.borrows) : 0,
    netAPY: lendingPoolInfo?.depositAPY || 0,
    healthFactor: userData?.lendingPosition?.healthFactor || 0,
    availableCredit: userData?.lendingPosition ? parseFloat(userData.lendingPosition.collateral) * 0.75 : 0,
    totalCollateral: userData?.lendingPosition ? parseFloat(userData.lendingPosition.collateral) : 0,
  };

  // Use real pool data or fallback
  const mockPools = lendingPoolInfo ? [
    {
      id: '1',
      name: 'CSPR Pool',
      asset: 'CSPR',
      totalDeposits: parseFloat(lendingPoolInfo.totalDeposits),
      totalBorrows: parseFloat(lendingPoolInfo.totalBorrows),
      availableLiquidity: parseFloat(lendingPoolInfo.availableLiquidity),
      utilizationRate: lendingPoolInfo.utilizationRate,
      supplyAPY: lendingPoolInfo.depositAPY,
      borrowAPY: lendingPoolInfo.borrowAPY,
      totalReserves: parseFloat(lendingPoolInfo.totalDeposits) * 0.01,
      reserveFactor: 0.1,
      collateralFactor: 0.75,
      liquidationThreshold: 0.8,
      liquidationPenalty: 0.05,
    }
  ] : [
    {
      id: '1',
      name: 'CSPR Pool',
      asset: 'CSPR',
      totalDeposits: 1500000,
      totalBorrows: 1200000,
      availableLiquidity: 300000,
      utilizationRate: 80,
      supplyAPY: 6.5,
      borrowAPY: 8.2,
      totalReserves: 15000,
      reserveFactor: 0.1,
      collateralFactor: 0.75,
      liquidationThreshold: 0.8,
      liquidationPenalty: 0.05,
    }
  ];

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lending Protocol</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Borrow against your assets and earn interest by lending</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSupplyModal(true)}
            className="inline-flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-gray-900 dark:text-white font-medium rounded-xl transition-all duration-200"
          >
            <Plus className="w-5 h-5 mr-2" />
            Supply
          </button>
          <button
            onClick={() => setShowBorrowModal(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-gray-900 dark:text-white font-medium rounded-xl transition-all duration-200"
          >
            <Plus className="w-5 h-5 mr-2" />
            Borrow
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'borrow', label: 'Borrow' },
            { id: 'lend', label: 'Lend' },
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
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Total Supplied */}
            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <ArrowUpRight className="h-5 w-5 text-green-400" />
                </div>
                <div className="flex items-center text-sm text-green-400">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  +12.5%
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {formatCurrency(mockStats.totalSupplied)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Supplied</p>
              </div>
            </div>

            {/* Total Borrowed */}
            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <ArrowDownRight className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex items-center text-sm text-blue-400">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  +8.2%
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {formatCurrency(mockStats.totalBorrowed)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Borrowed</p>
              </div>
            </div>

            {/* Net APY */}
            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-400" />
                </div>
                <div className="flex items-center text-sm text-purple-400">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  +0.3%
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {formatPercentage(mockStats.netAPY)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Net APY</p>
              </div>
            </div>
          </div>

          {/* Health Factor & Risk Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Health Factor */}
            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Account Health</h3>
                <div className={`flex items-center space-x-2 text-sm ${
                  mockStats.healthFactor > 1.5 
                    ? 'text-green-400' 
                    : mockStats.healthFactor > 1.2 
                    ? 'text-yellow-400' 
                    : 'text-red-400'
                }`}>
                  {mockStats.healthFactor > 1.5 ? (
                    <Shield className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <span>
                    {mockStats.healthFactor > 1.5 
                      ? 'Healthy' 
                      : mockStats.healthFactor > 1.2 
                      ? 'Moderate Risk' 
                      : 'High Risk'
                    }
                  </span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Health Factor</span>
                  <span className="text-gray-900 dark:text-white font-medium">{mockStats.healthFactor.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Total Collateral</span>
                  <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(mockStats.totalCollateral)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Available Credit</span>
                  <span className="text-green-400 font-medium">{formatCurrency(mockStats.availableCredit)}</span>
                </div>
              </div>

              {/* Health Factor Bar */}
              <div className="mt-6">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span>Liquidation Risk</span>
                  <span>Safe</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      mockStats.healthFactor > 1.5 
                        ? 'bg-green-500' 
                        : mockStats.healthFactor > 1.2 
                        ? 'bg-yellow-500' 
                        : 'bg-red-500'
                    }`}
                    style={{ 
                      width: `${Math.min((mockStats.healthFactor / 3) * 100, 100)}%` 
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Quick Actions</h3>
              
              <div className="space-y-4">
                <button
                  onClick={() => setShowBorrowModal(true)}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/10 to-purple-600/10 border border-blue-500/20 rounded-xl hover:from-blue-500/20 hover:to-purple-600/20 transition-all duration-200"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <ArrowDownRight className="w-5 h-5 text-gray-900 dark:text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-gray-900 dark:text-white font-medium">Borrow Assets</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">Use your collateral to borrow</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>

                <button
                  onClick={() => setShowSupplyModal(true)}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-green-500/10 to-emerald-600/10 border border-green-500/20 rounded-xl hover:from-green-500/20 hover:to-emerald-600/20 transition-all duration-200"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-500 rounded-lg">
                      <ArrowUpRight className="w-5 h-5 text-gray-900 dark:text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-gray-900 dark:text-white font-medium">Supply Assets</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">Earn interest by lending</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>

                <button className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 to-pink-600/10 border border-purple-500/20 rounded-xl hover:from-purple-500/20 hover:to-pink-600/20 transition-all duration-200">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-500 rounded-lg">
                      <DollarSign className="w-5 h-5 text-gray-900 dark:text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-gray-900 dark:text-white font-medium">Repay Loans</p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">Manage your debt positions</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Lending Pools Overview */}
          <LendingPools pools={mockPools} />
        </div>
      )}

      {/* Borrow Tab */}
      {activeTab === 'borrow' && (
        <div className="space-y-6">
          <BorrowPositions />
        </div>
      )}

      {/* Lend Tab */}
      {activeTab === 'lend' && (
        <div className="space-y-6">
          <LendingPositions />
        </div>
      )}

      {/* Positions Tab */}
      {activeTab === 'positions' && (
        <div className="space-y-6">
          <BorrowPositions />
          <LendingPositions />
        </div>
      )}

      {/* Modals */}
      {showBorrowModal && (
        <BorrowModal
          isOpen={showBorrowModal}
          onClose={() => setShowBorrowModal(false)}
        />
      )}

      {showSupplyModal && (
        <SupplyModal
          isOpen={showSupplyModal}
          onClose={() => setShowSupplyModal(false)}
        />
      )}
    </div>
  );
}