'use client';

import { useState } from 'react';
import { 
  CheckCircle, 
  Clock,
  XCircle,
  AlertCircle,
  Filter,
  Download,
  Search,
  Calendar
} from 'lucide-react';

interface WithdrawalRecord {
  id: string;
  amount: number;
  method: 'crypto' | 'card' | 'usdsui';
  methodName: string;
  status: 'completed' | 'processing' | 'failed' | 'pending';
  fee: number;
  timestamp: Date;
  txHash?: string;
  destination: string;
}

const mockWithdrawals: WithdrawalRecord[] = [
  {
    id: '1',
    amount: 5000,
    method: 'usdsui',
    methodName: 'USDSui',
    status: 'completed',
    fee: 0,
    timestamp: new Date(Date.now() - 3600000),
    txHash: '0xabc...123',
    destination: '0x1234...5678',
  },
  {
    id: '2',
    amount: 2500,
    method: 'crypto',
    methodName: 'SUI',
    status: 'completed',
    fee: 0,
    timestamp: new Date(Date.now() - 86400000),
    txHash: '0xdef...456',
    destination: '0x8765...4321',
  },
  {
    id: '3',
    amount: 1000,
    method: 'card',
    methodName: 'Debit Card',
    status: 'processing',
    fee: 0,
    timestamp: new Date(Date.now() - 172800000),
    destination: '****1234',
  },
  {
    id: '4',
    amount: 3000,
    method: 'crypto',
    methodName: 'USDC',
    status: 'completed',
    fee: 0,
    timestamp: new Date(Date.now() - 259200000),
    txHash: '0xghi...789',
    destination: '0x9876...1234',
  },
];

interface WithdrawalLimits {
  daily: { used: number; limit: number };
  weekly: { used: number; limit: number };
  monthly: { used: number; limit: number };
}

const mockLimits: WithdrawalLimits = {
  daily: { used: 5000, limit: 10000 },
  weekly: { used: 12500, limit: 50000 },
  monthly: { used: 25000, limit: 200000 },
};

export function WithdrawalHistory() {
  const [filter, setFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

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
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Completed' };
      case 'processing':
        return { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Processing' };
      case 'failed':
        return { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Failed' };
      case 'pending':
        return { icon: AlertCircle, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Pending' };
      default:
        return { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Unknown' };
    }
  };

  const filteredWithdrawals = mockWithdrawals.filter(w => {
    if (filter !== 'all' && w.status !== filter) return false;
    if (searchTerm && !w.destination.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const getLimitPercentage = (used: number, limit: number) => {
    return (used / limit) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Withdrawal Limits */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Withdrawal Limits
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Daily', ...mockLimits.daily },
            { label: 'Weekly', ...mockLimits.weekly },
            { label: 'Monthly', ...mockLimits.monthly },
          ].map((limit) => {
            const percentage = getLimitPercentage(limit.used, limit.limit);
            
            return (
              <div key={limit.label} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{limit.label} Limit</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrency(limit.limit)}
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      percentage < 50 ? 'bg-green-500' : 
                      percentage < 80 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Used: {formatCurrency(limit.used)}</span>
                  <span className={`font-medium ${
                    percentage < 50 ? 'text-green-400' : 
                    percentage < 80 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Withdrawal History */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Withdrawal History
          </h3>
          
          <div className="flex items-center space-x-3">
            <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
              <Download className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-600 dark:text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by destination..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex space-x-2">
            {['all', 'completed', 'processing', 'failed'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === status
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Withdrawal List */}
        <div className="space-y-3">
          {filteredWithdrawals.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">No withdrawals found</p>
            </div>
          ) : (
            filteredWithdrawals.map((withdrawal) => {
              const statusConfig = getStatusConfig(withdrawal.status);
              const StatusIcon = statusConfig.icon;
              
              return (
                <div
                  key={withdrawal.id}
                  className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 ${statusConfig.bg} rounded-lg`}>
                      <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
                    </div>
                    
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="text-gray-900 dark:text-white font-medium">
                          {formatCurrency(withdrawal.amount)}
                        </p>
                        <span className="text-gray-600 dark:text-gray-400">•</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {withdrawal.methodName}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        To: {withdrawal.destination}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(withdrawal.timestamp)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg ${statusConfig.bg} ${statusConfig.color} mb-2`}>
                      {statusConfig.label}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Fee: {withdrawal.fee === 0 ? 'Free' : formatCurrency(withdrawal.fee)}
                    </p>
                    {withdrawal.txHash && (
                      <button className="text-xs text-blue-400 hover:text-blue-300 mt-1">
                        View Tx →
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Withdrawn</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(mockWithdrawals.reduce((sum, w) => sum + w.amount, 0))}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Fees Saved</p>
          <p className="text-2xl font-bold text-green-400">
            {formatCurrency(mockWithdrawals.reduce((sum, w) => sum + (w.fee === 0 ? 5 : 0), 0))}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Transactions</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {mockWithdrawals.length}
          </p>
        </div>
      </div>
    </div>
  );
}
