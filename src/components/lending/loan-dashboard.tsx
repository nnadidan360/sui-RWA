'use client';

import { useState } from 'react';
import { 
  FileText, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Calendar,
  Shield
} from 'lucide-react';

interface LoanDetails {
  loanId: string;
  borrower: string;
  collateralType: 'RWA' | 'Crypto';
  collateralAssets: Array<{
    id: string;
    name: string;
    value: number;
    type: string;
  }>;
  principalAmount: number;
  currentDebt: number;
  interestRate: number;
  ltvRatio: number;
  healthFactor: number;
  status: 'active' | 'repaid' | 'liquidated' | 'overdue';
  createdAt: Date;
  dueDate: Date;
  repaymentHistory: Array<{
    date: Date;
    amount: number;
    type: 'principal' | 'interest';
  }>;
  onChainEvents: Array<{
    event: string;
    timestamp: Date;
    txHash: string;
  }>;
}

const mockLoan: LoanDetails = {
  loanId: 'LOAN-001',
  borrower: '0x1234...5678',
  collateralType: 'RWA',
  collateralAssets: [
    { id: '1', name: 'Downtown Office Building', value: 150000, type: 'Real Estate' },
  ],
  principalAmount: 100000,
  currentDebt: 105000,
  interestRate: 5.0,
  ltvRatio: 70,
  healthFactor: 1.8,
  status: 'active',
  createdAt: new Date('2024-01-15'),
  dueDate: new Date('2024-07-15'),
  repaymentHistory: [
    { date: new Date('2024-02-15'), amount: 2500, type: 'interest' },
    { date: new Date('2024-03-15'), amount: 2500, type: 'interest' },
  ],
  onChainEvents: [
    { event: 'Loan Created', timestamp: new Date('2024-01-15T10:30:00'), txHash: '0xabc...123' },
    { event: 'Collateral Locked', timestamp: new Date('2024-01-15T10:31:00'), txHash: '0xdef...456' },
    { event: 'Funds Disbursed', timestamp: new Date('2024-01-15T10:32:00'), txHash: '0xghi...789' },
  ],
};

export function LoanDashboard() {
  const [selectedLoan] = useState<LoanDetails>(mockLoan);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Active' };
      case 'repaid':
        return { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Repaid' };
      case 'liquidated':
        return { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Liquidated' };
      case 'overdue':
        return { icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Overdue' };
      default:
        return { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Unknown' };
    }
  };

  const statusConfig = getStatusConfig(selectedLoan.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6">
      {/* Loan Header */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Loan #{selectedLoan.loanId}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedLoan.collateralType} Collateral • Created {formatDate(selectedLoan.createdAt)}
              </p>
            </div>
          </div>
          
          <div className={`flex items-center space-x-2 px-4 py-2 rounded-xl ${statusConfig.bg}`}>
            <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
            <span className={`font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Principal Amount</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(selectedLoan.principalAmount)}
            </p>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Current Debt</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(selectedLoan.currentDebt)}
            </p>
            <p className="text-sm text-gray-500">
              +{formatCurrency(selectedLoan.currentDebt - selectedLoan.principalAmount)} interest
            </p>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Interest Rate</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {selectedLoan.interestRate.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-500">Fixed APR</p>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Health Factor</p>
            <p className={`text-2xl font-bold ${
              selectedLoan.healthFactor > 1.5 ? 'text-green-400' : 
              selectedLoan.healthFactor > 1.2 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {selectedLoan.healthFactor.toFixed(2)}
            </p>
            <p className="text-sm text-gray-500">
              {selectedLoan.healthFactor > 1.5 ? 'Healthy' : 
               selectedLoan.healthFactor > 1.2 ? 'Moderate' : 'At Risk'}
            </p>
          </div>
        </div>
      </div>

      {/* Collateral Information */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Collateral Assets</h3>
        
        <div className="space-y-4">
          {selectedLoan.collateralAssets.map((asset) => (
            <div key={asset.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <span className="text-xl">🏢</span>
                </div>
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">{asset.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{asset.type}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-900 dark:text-white font-medium">{formatCurrency(asset.value)}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Collateral Value</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">LTV Ratio</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {selectedLoan.ltvRatio.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 w-full bg-gray-800 rounded-full h-2">
              <div 
                className="h-2 bg-blue-500 rounded-full"
                style={{ width: `${selectedLoan.ltvRatio}%` }}
              />
            </div>
          </div>

          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Collateral</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(selectedLoan.collateralAssets.reduce((sum, a) => sum + a.value, 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Repayment Schedule */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Repayment Schedule</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="flex items-center space-x-3 p-4 bg-gray-800/50 rounded-xl">
            <Calendar className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Loan Due Date</p>
              <p className="text-gray-900 dark:text-white font-medium">{formatDate(selectedLoan.dueDate)}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-4 bg-gray-800/50 rounded-xl">
            <Clock className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Days Remaining</p>
              <p className="text-gray-900 dark:text-white font-medium">
                {Math.ceil((selectedLoan.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-300">Payment History</h4>
          {selectedLoan.repaymentHistory.map((payment, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {payment.type === 'principal' ? 'Principal Payment' : 'Interest Payment'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{formatDate(payment.date)}</p>
                </div>
              </div>
              <p className="text-gray-900 dark:text-white font-medium">{formatCurrency(payment.amount)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* On-Chain Transparency */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center space-x-3 mb-6">
          <Shield className="w-6 h-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">On-Chain Transparency</h3>
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          All loan events are recorded on the Sui blockchain for complete transparency and auditability.
        </p>

        <div className="space-y-3">
          {selectedLoan.onChainEvents.map((event, index) => (
            <div key={index} className="flex items-start justify-between p-4 bg-gray-800/50 rounded-xl">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-500/20 rounded-lg mt-1">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">{event.event}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {event.timestamp.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">
                    Tx: {event.txHash}
                  </p>
                </div>
              </div>
              <button className="text-blue-400 hover:text-blue-300 text-sm">
                View on Explorer →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
