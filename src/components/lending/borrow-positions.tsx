'use client';

import { useState } from 'react';
import { 
  AlertTriangle, 
  Shield, 
  Clock, 
  DollarSign, 
  TrendingDown,
  MoreVertical,
  Eye,
  CreditCard,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { LoanPosition, LoanStatus } from '@/types/lending';
import { useUserData, useBlockchainTransaction } from '@/hooks/use-blockchain-data';

// Mock data - replace with real data from API
const mockLoans: LoanPosition[] = [
  {
    id: '1',
    loanId: 'LOAN-001',
    borrower: '0x1234...5678',
    collateralAssets: [
      {
        id: 'asset-1',
        type: 'asset_token',
        tokenId: 'RWA-001',
        title: 'Downtown Office Building',
        currentValue: 150000,
        currency: 'USD',
        utilizationRatio: 75,
      }
    ],
    principalAmount: 100000,
    currentDebt: 105000,
    interestRate: 8.5,
    liquidationThreshold: 80,
    currentLTV: 70,
    healthFactor: 1.8,
    status: 'active',
    createdAt: new Date('2024-01-15'),
    dueDate: new Date('2024-07-15'),
    lastPaymentDate: new Date('2024-02-15'),
    nextPaymentDue: new Date('2024-03-15'),
    totalInterestPaid: 3500,
    penaltyFees: 0,
  },
  {
    id: '2',
    loanId: 'LOAN-002',
    borrower: '0x1234...5678',
    collateralAssets: [
      {
        id: 'staked-1',
        type: 'staked_token',
        tokenId: 'SCSPR-001',
        title: 'Staked CSPR Tokens',
        currentValue: 25000,
        currency: 'USD',
        utilizationRatio: 85,
      }
    ],
    principalAmount: 20000,
    currentDebt: 21200,
    interestRate: 6.2,
    liquidationThreshold: 85,
    currentLTV: 84.8,
    healthFactor: 1.02,
    status: 'active',
    createdAt: new Date('2024-02-01'),
    dueDate: new Date('2024-08-01'),
    lastPaymentDate: new Date('2024-02-01'),
    nextPaymentDue: new Date('2024-03-01'),
    totalInterestPaid: 800,
    penaltyFees: 0,
  },
];

const statusConfig: Record<LoanStatus, { icon: any; color: string; bg: string; label: string }> = {
  active: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Active' },
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Pending' },
  repaid: { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Repaid' },
  liquidated: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Liquidated' },
  overdue: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Overdue' },
};

export function BorrowPositions() {
  const [selectedLoan, setSelectedLoan] = useState<string | null>(null);
  const [showRepayModal, setShowRepayModal] = useState<string | null>(null);

  // Get real user data
  const { data: userData, loading } = useUserData();
  const { executeRepayLoan, loading: repayLoading } = useBlockchainTransaction();

  // Convert user transactions to loan positions (simplified)
  const userLoans: LoanPosition[] = userData?.transactions
    ?.filter(tx => tx.type === 'borrow' && tx.status === 'confirmed')
    ?.map((tx, index) => ({
      id: tx._id?.toString() || `loan-${index}`,
      loanId: `LOAN-${String(index + 1).padStart(3, '0')}`,
      borrower: tx.userId,
      collateralAssets: [
        {
          id: `asset-${index}`,
          type: 'asset_token',
          tokenId: `RWA-${String(index + 1).padStart(3, '0')}`,
          title: `Asset ${index + 1}`,
          currentValue: tx.amount * 1.5, // Assume 150% collateralization
          currency: tx.currency,
          utilizationRatio: 75,
        }
      ],
      principalAmount: tx.amount,
      currentDebt: tx.amount * 1.05, // Assume 5% interest accrued
      interestRate: 8.5,
      liquidationThreshold: 80,
      currentLTV: 70,
      healthFactor: 1.8,
      status: 'active' as LoanStatus,
      createdAt: tx.createdAt || new Date(),
      dueDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months from now
      lastPaymentDate: tx.createdAt || new Date(),
      nextPaymentDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      totalInterestPaid: tx.amount * 0.035, // 3.5% of principal
      penaltyFees: 0,
    })) || [];

  const handleRepayLoan = async (loanId: string) => {
    try {
      await executeRepayLoan(loanId);
      setShowRepayModal(null);
      // Refresh data would happen automatically through the hook
    } catch (error) {
      console.error('Failed to repay loan:', error);
    }
  };

  // Show loading state
  if (loading) {
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

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const getHealthFactorColor = (healthFactor: number) => {
    if (healthFactor > 1.5) return 'text-green-400';
    if (healthFactor > 1.2) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getHealthFactorIcon = (healthFactor: number) => {
    if (healthFactor > 1.5) return Shield;
    return AlertTriangle;
  };

  if (userLoans.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-8">
        <div className="text-center">
          <CreditCard className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Borrow Positions</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You don't have any active loans. Start by borrowing against your tokenized assets.
          </p>
          <button className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-gray-900 dark:text-white font-medium rounded-xl transition-all duration-200">
            Start Borrowing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Borrow Positions</h2>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {userLoans.length} active loan{userLoans.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Loans List */}
      <div className="space-y-4">
        {userLoans.map((loan) => {
          const status = statusConfig[loan.status];
          const StatusIcon = status.icon;
          const HealthIcon = getHealthFactorIcon(loan.healthFactor);

          return (
            <div
              key={loan.id}
              className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm hover:border-gray-700 rounded-2xl p-6 transition-all duration-200"
            >
              {/* Loan Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Loan #{loan.loanId}</h3>
                    <div className="flex items-center space-x-3 mt-1">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg ${status.bg} ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </div>
                      <span className="text-gray-600 dark:text-gray-400 text-sm">
                        Created {formatDate(loan.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Health Factor */}
                  <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-800/50 ${getHealthFactorColor(loan.healthFactor)}`}>
                    <HealthIcon className="w-4 h-4" />
                    <span className="font-medium">{loan.healthFactor.toFixed(2)}</span>
                  </div>

                  {/* Actions Menu */}
                  <div className="relative">
                    <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Loan Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Principal Amount</p>
                  <p className="text-gray-900 dark:text-white font-semibold text-lg">
                    {formatCurrency(loan.principalAmount)}
                  </p>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-4">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Current Debt</p>
                  <p className="text-gray-900 dark:text-white font-semibold text-lg">
                    {formatCurrency(loan.currentDebt)}
                  </p>
                  <p className="text-gray-500 text-xs">
                    +{formatCurrency(loan.currentDebt - loan.principalAmount)} interest
                  </p>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-4">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Interest Rate</p>
                  <p className="text-gray-900 dark:text-white font-semibold text-lg">
                    {formatPercentage(loan.interestRate)}
                  </p>
                  <p className="text-gray-500 text-xs">APR</p>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-4">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">LTV Ratio</p>
                  <p className="text-gray-900 dark:text-white font-semibold text-lg">
                    {formatPercentage(loan.currentLTV)}
                  </p>
                  <p className="text-gray-500 text-xs">
                    Max: {formatPercentage(loan.liquidationThreshold)}
                  </p>
                </div>
              </div>

              {/* Collateral Assets */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Collateral Assets</h4>
                <div className="space-y-2">
                  {loan.collateralAssets.map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800/30 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          asset.type === 'asset_token' 
                            ? 'bg-purple-500/20 text-purple-400' 
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {asset.type === 'asset_token' ? '🏢' : '💎'}
                        </div>
                        <div>
                          <p className="text-gray-900 dark:text-white font-medium text-sm">{asset.title}</p>
                          <p className="text-gray-600 dark:text-gray-400 text-xs">
                            {asset.type === 'asset_token' ? 'Real World Asset' : 'Staked Token'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-900 dark:text-white font-medium text-sm">
                          {formatCurrency(asset.currentValue, asset.currency)}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          {formatPercentage(asset.utilizationRatio)}% utilized
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Health Factor Bar */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">Health Factor</span>
                  <span className={`font-medium ${getHealthFactorColor(loan.healthFactor)}`}>
                    {loan.healthFactor.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      loan.healthFactor > 1.5 
                        ? 'bg-green-500' 
                        : loan.healthFactor > 1.2 
                        ? 'bg-yellow-500' 
                        : 'bg-red-500'
                    }`}
                    style={{ 
                      width: `${Math.min((loan.healthFactor / 3) * 100, 100)}%` 
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Liquidation Risk</span>
                  <span>Safe</span>
                </div>
              </div>

              {/* Payment Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-100 dark:bg-gray-800/30 rounded-lg p-3">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Last Payment</p>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {loan.lastPaymentDate ? formatDate(loan.lastPaymentDate) : 'No payments yet'}
                  </p>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800/30 rounded-lg p-3">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Next Payment Due</p>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {loan.nextPaymentDue ? formatDate(loan.nextPaymentDue) : 'No payment due'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => handleRepayLoan(loan.loanId)}
                  disabled={repayLoading}
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {repayLoading ? 'Repaying...' : 'Repay Loan'}
                </button>
                <button className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-lg transition-colors">
                  Add Collateral
                </button>
                <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
              </div>

              {/* Risk Warning */}
              {loan.healthFactor < 1.3 && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium text-sm">Liquidation Risk</p>
                    <p className="text-gray-300 text-sm">
                      Your health factor is low. Consider repaying part of your loan or adding more collateral to avoid liquidation.
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Borrowing Summary</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(userLoans.reduce((sum, loan) => sum + loan.currentDebt, 0))}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Total Debt</p>
          </div>

          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(userLoans.reduce((sum, loan) => sum + loan.collateralAssets.reduce((colSum, col) => colSum + col.currentValue, 0), 0))}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Total Collateral</p>
          </div>

          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {userLoans.length > 0 ? formatPercentage(userLoans.reduce((sum, loan) => sum + loan.interestRate, 0) / userLoans.length) : '0.00%'}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Avg Interest Rate</p>
          </div>

          <div className="text-center">
            <p className={`text-2xl font-bold mb-1 ${userLoans.length > 0 ? getHealthFactorColor(Math.min(...userLoans.map(l => l.healthFactor))) : 'text-gray-400'}`}>
              {userLoans.length > 0 ? Math.min(...userLoans.map(l => l.healthFactor)).toFixed(2) : 'N/A'}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Lowest Health Factor</p>
          </div>
        </div>
      </div>
    </div>
  );
}