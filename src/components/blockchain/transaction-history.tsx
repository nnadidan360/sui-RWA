/**
 * Transaction History Component
 * Displays user's transaction history with real blockchain data
 */

'use client';

import { useState } from 'react';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  Filter,
  Search,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  FileText
} from 'lucide-react';
import { useTransactionHistory } from '@/hooks/use-transaction-tracking';
import { TransactionStatusBadge } from './transaction-tracker';

interface TransactionHistoryProps {
  userPublicKey?: string;
  limit?: number;
  showFilters?: boolean;
}

type TransactionFilter = 'all' | 'success' | 'failed' | 'pending';
type TransactionType = 'stake' | 'unstake' | 'deposit' | 'borrow' | 'repay' | 'tokenize' | 'transfer';

export function TransactionHistory({ 
  userPublicKey, 
  limit = 50, 
  showFilters = true 
}: TransactionHistoryProps) {
  const [filter, setFilter] = useState<TransactionFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { transactions, loading, error, refetch } = useTransactionHistory(userPublicKey, limit);

  const filteredTransactions = transactions.filter(tx => {
    // Filter by status
    if (filter !== 'all' && tx.status !== filter) {
      return false;
    }

    // Filter by search term (transaction hash)
    if (searchTerm && !tx.deployHash.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    return true;
  });

  const getTransactionTypeIcon = (type: TransactionType) => {
    switch (type) {
      case 'stake':
        return <Zap className="w-4 h-4 text-blue-500" />;
      case 'unstake':
        return <ArrowDownRight className="w-4 h-4 text-orange-500" />;
      case 'deposit':
        return <ArrowUpRight className="w-4 h-4 text-green-500" />;
      case 'borrow':
        return <ArrowDownRight className="w-4 h-4 text-purple-500" />;
      case 'repay':
        return <ArrowUpRight className="w-4 h-4 text-blue-500" />;
      case 'tokenize':
        return <FileText className="w-4 h-4 text-indigo-500" />;
      case 'transfer':
      default:
        return <ArrowUpRight className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTransactionTypeLabel = (type: TransactionType) => {
    switch (type) {
      case 'stake':
        return 'Stake CSPR';
      case 'unstake':
        return 'Unstake CSPR';
      case 'deposit':
        return 'Deposit';
      case 'borrow':
        return 'Borrow';
      case 'repay':
        return 'Repay Loan';
      case 'tokenize':
        return 'Tokenize Asset';
      case 'transfer':
      default:
        return 'Transfer';
    }
  };

  const formatHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const formatTimestamp = (timestamp?: Date) => {
    if (!timestamp) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(timestamp);
  };

  const getCasperExplorerUrl = (hash: string) => {
    return `https://testnet.cspr.live/deploy/${hash}`;
  };

  if (!userPublicKey) {
    return (
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
        <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Connect Your Wallet
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your wallet to view your transaction history
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Transaction History
          </h2>
          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by transaction hash..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as TransactionFilter)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Transaction List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-800">
        {loading && transactions.length === 0 ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600 dark:text-gray-400">Loading transactions...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400 mb-2">Failed to load transactions</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="w-8 h-8 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {transactions.length === 0 ? 'No transactions found' : 'No transactions match your filters'}
            </p>
          </div>
        ) : (
          filteredTransactions.map((tx) => (
            <div key={tx.deployHash} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Transaction Type Icon */}
                  <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    {getTransactionTypeIcon('transfer')} {/* Default to transfer for now */}
                  </div>

                  {/* Transaction Details */}
                  <div>
                    <div className="flex items-center space-x-3 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {getTransactionTypeLabel('transfer')} {/* Default to transfer for now */}
                      </h3>
                      <TransactionStatusBadge deployHash={tx.deployHash} />
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-mono">{formatHash(tx.deployHash)}</span>
                      <span>•</span>
                      <span>{formatTimestamp(new Date())}</span> {/* Would use actual timestamp */}
                      {tx.cost && (
                        <>
                          <span>•</span>
                          <span>{parseInt(tx.cost).toLocaleString()} motes</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <a
                    href={getCasperExplorerUrl(tx.deployHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="View on Casper Explorer"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-500" />
                  </a>
                </div>
              </div>

              {/* Error Message */}
              {tx.error && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-300">{tx.error}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {filteredTransactions.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </p>
        </div>
      )}
    </div>
  );
}