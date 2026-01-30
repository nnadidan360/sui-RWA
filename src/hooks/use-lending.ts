'use client';

import { useState, useCallback } from 'react';
import { 
  LoanPosition, 
  LendingPool, 
  UserLendingPosition, 
  LendingFilters, 
  LendingPagination, 
  LendingResponse,
  BorrowRequest,
  PoolDeposit,
  PoolWithdrawal,
  LoanRepayment
} from '@/types/lending';

interface UseLendingReturn {
  // Data
  loans: LoanPosition[];
  pools: LendingPool[];
  userPositions: UserLendingPosition[];
  loading: boolean;
  error: string | null;
  pagination: LendingPagination;
  
  // Actions
  fetchLoans: (params: LendingFilters & { page?: number; limit?: number }) => Promise<void>;
  fetchPools: () => Promise<void>;
  fetchUserPositions: () => Promise<void>;
  createLoan: (request: BorrowRequest) => Promise<LoanPosition>;
  repayLoan: (repayment: LoanRepayment) => Promise<void>;
  supplyToPool: (deposit: PoolDeposit) => Promise<void>;
  withdrawFromPool: (withdrawal: PoolWithdrawal) => Promise<void>;
  refreshData: () => Promise<void>;
}

const defaultPagination: LendingPagination = {
  currentPage: 1,
  totalPages: 1,
  totalCount: 0,
  hasNextPage: false,
  hasPrevPage: false,
};

export function useLending(): UseLendingReturn {
  const [loans, setLoans] = useState<LoanPosition[]>([]);
  const [pools, setPools] = useState<LendingPool[]>([]);
  const [userPositions, setUserPositions] = useState<UserLendingPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<LendingPagination>(defaultPagination);

  const fetchLoans = useCallback(async (params: LendingFilters & { page?: number; limit?: number }) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      
      // Add pagination params
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());
      
      // Add filter params
      if (params.status) searchParams.set('status', params.status);
      if (params.collateralType) searchParams.set('collateralType', params.collateralType);
      if (params.minAmount) searchParams.set('minAmount', params.minAmount.toString());
      if (params.maxAmount) searchParams.set('maxAmount', params.maxAmount.toString());
      if (params.minHealthFactor) searchParams.set('minHealthFactor', params.minHealthFactor.toString());
      if (params.maxHealthFactor) searchParams.set('maxHealthFactor', params.maxHealthFactor.toString());
      if (params.sortBy) searchParams.set('sortBy', params.sortBy);
      if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

      const response = await fetch(`/api/lending/loans?${searchParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: LendingResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch loans');
      }

      if (data.data.loans) {
        setLoans(data.data.loans);
      }
      
      if (data.data.pagination) {
        setPagination(data.data.pagination);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error fetching loans:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPools = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/lending/pools');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: LendingResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch pools');
      }

      if (data.data.pools) {
        setPools(data.data.pools);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error fetching pools:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserPositions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/lending/positions');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: LendingResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch user positions');
      }

      if (data.data.userPositions) {
        setUserPositions(data.data.userPositions);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error fetching user positions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createLoan = useCallback(async (request: BorrowRequest): Promise<LoanPosition> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/lending/borrow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create loan');
      }

      // Refresh loans list
      await fetchLoans({ page: 1, limit: 10 });

      return data.data.loan;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchLoans]);

  const repayLoan = useCallback(async (repayment: LoanRepayment): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/lending/repay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(repayment),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to repay loan');
      }

      // Refresh loans list
      await fetchLoans({ page: 1, limit: 10 });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchLoans]);

  const supplyToPool = useCallback(async (deposit: PoolDeposit): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/lending/supply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deposit),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to supply to pool');
      }

      // Refresh pools and user positions
      await Promise.all([fetchPools(), fetchUserPositions()]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchPools, fetchUserPositions]);

  const withdrawFromPool = useCallback(async (withdrawal: PoolWithdrawal): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/lending/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(withdrawal),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to withdraw from pool');
      }

      // Refresh pools and user positions
      await Promise.all([fetchPools(), fetchUserPositions()]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchPools, fetchUserPositions]);

  const refreshData = useCallback(async () => {
    await Promise.all([
      fetchLoans({ page: 1, limit: 10 }),
      fetchPools(),
      fetchUserPositions(),
    ]);
  }, [fetchLoans, fetchPools, fetchUserPositions]);

  return {
    loans,
    pools,
    userPositions,
    loading,
    error,
    pagination,
    fetchLoans,
    fetchPools,
    fetchUserPositions,
    createLoan,
    repayLoan,
    supplyToPool,
    withdrawFromPool,
    refreshData,
  };
}