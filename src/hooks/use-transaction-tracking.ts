/**
 * React hooks for transaction tracking and status monitoring
 * Implements real transaction hash and status tracking
 */

import { useState, useEffect, useCallback } from 'react';
import { getTransactionService, type TransactionStatus } from '@/lib/blockchain/transaction-service';

/**
 * Hook for tracking a single transaction
 */
export function useTransactionStatus(deployHash?: string) {
  const [status, setStatus] = useState<TransactionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!deployHash) {
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const transactionService = getTransactionService();
      const transactionStatus = await transactionService.getTransactionStatus(deployHash);
      setStatus(transactionStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transaction status');
      console.error('Error fetching transaction status:', err);
    } finally {
      setLoading(false);
    }
  }, [deployHash]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll for updates if transaction is pending or processing
  useEffect(() => {
    if (!deployHash || !status) return;

    if (status.status === 'pending' || status.status === 'processing') {
      const interval = setInterval(fetchStatus, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [deployHash, status, fetchStatus]);

  return { status, loading, error, refetch: fetchStatus };
}

/**
 * Hook for tracking multiple transactions
 */
export function useTransactionHistory(userPublicKey?: string, limit: number = 50) {
  const [transactions, setTransactions] = useState<TransactionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!userPublicKey) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const transactionService = getTransactionService();
      const history = await transactionService.getTransactionHistory(userPublicKey, limit);
      setTransactions(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transaction history');
      console.error('Error fetching transaction history:', err);
    } finally {
      setLoading(false);
    }
  }, [userPublicKey, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { transactions, loading, error, refetch: fetchHistory };
}

/**
 * Hook for managing pending transactions
 */
export function usePendingTransactions() {
  const [pendingTxs, setPendingTxs] = useState<Map<string, TransactionStatus>>(new Map());

  const addTransaction = useCallback((deployHash: string, initialStatus?: Partial<TransactionStatus>) => {
    setPendingTxs(prev => {
      const newMap = new Map(prev);
      newMap.set(deployHash, {
        deployHash,
        status: 'pending',
        ...initialStatus,
      });
      return newMap;
    });
  }, []);

  const updateTransaction = useCallback((deployHash: string, update: Partial<TransactionStatus>) => {
    setPendingTxs(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(deployHash);
      if (existing) {
        newMap.set(deployHash, { ...existing, ...update });
      }
      return newMap;
    });
  }, []);

  const removeTransaction = useCallback((deployHash: string) => {
    setPendingTxs(prev => {
      const newMap = new Map(prev);
      newMap.delete(deployHash);
      return newMap;
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setPendingTxs(prev => {
      const newMap = new Map();
      for (const [hash, tx] of prev.entries()) {
        if (tx.status === 'pending' || tx.status === 'processing') {
          newMap.set(hash, tx);
        }
      }
      return newMap;
    });
  }, []);

  // Auto-update pending transactions
  useEffect(() => {
    if (pendingTxs.size === 0) return;

    const updatePendingTransactions = async () => {
      const transactionService = getTransactionService();
      const updates = new Map<string, TransactionStatus>();

      for (const [deployHash, tx] of pendingTxs.entries()) {
        if (tx.status === 'pending' || tx.status === 'processing') {
          try {
            const status = await transactionService.getTransactionStatus(deployHash);
            updates.set(deployHash, status);
          } catch (error) {
            console.error(`Error updating transaction ${deployHash}:`, error);
          }
        }
      }

      if (updates.size > 0) {
        setPendingTxs(prev => {
          const newMap = new Map(prev);
          for (const [hash, status] of updates.entries()) {
            newMap.set(hash, status);
          }
          return newMap;
        });
      }
    };

    const interval = setInterval(updatePendingTransactions, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [pendingTxs]);

  return {
    pendingTxs: Array.from(pendingTxs.values()),
    addTransaction,
    updateTransaction,
    removeTransaction,
    clearCompleted,
  };
}

/**
 * Hook for gas estimation
 */
export function useGasEstimation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estimateGas = useCallback(async (
    userPublicKey: string,
    contractAddress: string,
    entryPoint: string,
    args: any
  ) => {
    try {
      setLoading(true);
      setError(null);
      const transactionService = getTransactionService();
      const gasEstimate = await transactionService.estimateGas(
        userPublicKey,
        contractAddress,
        entryPoint,
        args
      );
      return gasEstimate;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Gas estimation failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return { estimateGas, loading, error };
}

/**
 * Hook for transaction confirmation tracking
 */
export function useTransactionConfirmation(deployHash?: string, requiredConfirmations: number = 1) {
  const [confirmations, setConfirmations] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!deployHash) {
      setConfirmations(0);
      setIsConfirmed(false);
      setLoading(false);
      return;
    }

    const checkConfirmations = async () => {
      try {
        setLoading(true);
        const transactionService = getTransactionService();
        const status = await transactionService.getTransactionStatus(deployHash);
        
        const currentConfirmations = status.confirmations || 0;
        setConfirmations(currentConfirmations);
        setIsConfirmed(currentConfirmations >= requiredConfirmations);
      } catch (error) {
        console.error('Error checking confirmations:', error);
      } finally {
        setLoading(false);
      }
    };

    // Initial check
    checkConfirmations();

    // Poll for updates if not confirmed
    if (!isConfirmed) {
      const interval = setInterval(checkConfirmations, 15000); // Check every 15 seconds
      return () => clearInterval(interval);
    }
  }, [deployHash, requiredConfirmations, isConfirmed]);

  return { confirmations, isConfirmed, loading };
}