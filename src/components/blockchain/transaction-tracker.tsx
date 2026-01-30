/**
 * Transaction Tracker Component
 * Displays real transaction status and hash tracking
 */

'use client';

import { useState } from 'react';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  Copy, 
  Loader2,
  AlertCircle,
  Hash
} from 'lucide-react';
import { useTransactionStatus, useTransactionConfirmation } from '@/hooks/use-transaction-tracking';

interface TransactionTrackerProps {
  deployHash: string;
  title?: string;
  requiredConfirmations?: number;
  onConfirmed?: () => void;
  showDetails?: boolean;
}

export function TransactionTracker({
  deployHash,
  title = 'Transaction',
  requiredConfirmations = 1,
  onConfirmed,
  showDetails = true,
}: TransactionTrackerProps) {
  const [copied, setCopied] = useState(false);
  const { status, loading, error } = useTransactionStatus(deployHash);
  const { confirmations, isConfirmed } = useTransactionConfirmation(deployHash, requiredConfirmations);

  // Call onConfirmed when transaction is confirmed
  if (isConfirmed && onConfirmed) {
    onConfirmed();
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const getStatusIcon = () => {
    if (loading) {
      return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
    }

    switch (status?.status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />;
      case 'pending':
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    if (loading) return 'Loading...';
    if (error) return 'Error loading status';

    switch (status?.status) {
      case 'success':
        return isConfirmed ? 'Confirmed' : `Success (${confirmations}/${requiredConfirmations} confirmations)`;
      case 'failed':
        return 'Failed';
      case 'processing':
        return 'Processing...';
      case 'pending':
      default:
        return 'Pending';
    }
  };

  const getStatusColor = () => {
    if (error) return 'text-red-500';

    switch (status?.status) {
      case 'success':
        return isConfirmed ? 'text-green-500' : 'text-yellow-500';
      case 'failed':
        return 'text-red-500';
      case 'processing':
        return 'text-yellow-500';
      case 'pending':
      default:
        return 'text-gray-500';
    }
  };

  const formatHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const getCasperExplorerUrl = (hash: string) => {
    // Casper testnet explorer URL
    return `https://testnet.cspr.live/deploy/${hash}`;
  };

  return (
    <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
            <p className={`text-sm ${getStatusColor()}`}>{getStatusText()}</p>
          </div>
        </div>
        
        {status?.status === 'success' && (
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-sm text-green-500">
              <CheckCircle className="w-4 h-4" />
              <span>Success</span>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Hash */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="flex items-center space-x-2">
            <Hash className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Transaction Hash:</span>
          </div>
          <div className="flex items-center space-x-2">
            <code className="text-sm font-mono text-gray-900 dark:text-white">
              {formatHash(deployHash)}
            </code>
            <button
              onClick={() => copyToClipboard(deployHash)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title="Copy full hash"
            >
              <Copy className="w-4 h-4 text-gray-500" />
            </button>
            <a
              href={getCasperExplorerUrl(deployHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title="View on Casper Explorer"
            >
              <ExternalLink className="w-4 h-4 text-gray-500" />
            </a>
          </div>
        </div>

        {copied && (
          <div className="text-sm text-green-500 text-center">
            Transaction hash copied to clipboard!
          </div>
        )}

        {/* Transaction Details */}
        {showDetails && status && (
          <div className="space-y-2">
            {status.cost && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Gas Used:</span>
                <span className="text-gray-900 dark:text-white font-mono">
                  {parseInt(status.cost).toLocaleString()} motes
                </span>
              </div>
            )}
            
            {status.blockNumber && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Block Number:</span>
                <span className="text-gray-900 dark:text-white font-mono">
                  {status.blockNumber.toLocaleString()}
                </span>
              </div>
            )}

            {confirmations > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Confirmations:</span>
                <span className="text-gray-900 dark:text-white">
                  {confirmations}/{requiredConfirmations}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {status?.error && (
          <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Transaction Failed</p>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">{status.error}</p>
            </div>
          </div>
        )}

        {/* Loading Error */}
        {error && (
          <div className="flex items-start space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Status Check Failed</p>
              <p className="text-sm text-yellow-600 dark:text-yellow-300 mt-1">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact Transaction Status Component
 */
interface TransactionStatusBadgeProps {
  deployHash: string;
  showHash?: boolean;
}

export function TransactionStatusBadge({ deployHash, showHash = false }: TransactionStatusBadgeProps) {
  const { status, loading } = useTransactionStatus(deployHash);

  const getStatusColor = () => {
    switch (status?.status) {
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'pending':
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const getStatusText = () => {
    if (loading) return 'Loading...';
    
    switch (status?.status) {
      case 'success':
        return 'Success';
      case 'failed':
        return 'Failed';
      case 'processing':
        return 'Processing';
      case 'pending':
      default:
        return 'Pending';
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
        {loading && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
        {getStatusText()}
      </span>
      {showHash && (
        <code className="text-xs font-mono text-gray-500">
          {deployHash.slice(0, 8)}...
        </code>
      )}
    </div>
  );
}