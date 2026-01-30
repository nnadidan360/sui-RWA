'use client';

import { useState, useCallback } from 'react';
import { 
  StakingPosition, 
  ValidatorInfo, 
  StakingMetrics, 
  StakingReward,
  StakingFilters, 
  ValidatorFilters,
  StakingPagination, 
  StakingResponse,
  StakeRequest,
  UnstakeRequest,
  RewardClaimRequest,
  ValidatorDelegationRequest,
  RedelegationRequest,
  ExternalWalletBalance
} from '@/types/staking';

interface UseStakingReturn {
  // Data
  positions: StakingPosition[];
  validators: ValidatorInfo[];
  metrics: StakingMetrics | null;
  rewards: StakingReward[];
  walletBalance: ExternalWalletBalance | null;
  loading: boolean;
  error: string | null;
  pagination: StakingPagination;
  
  // Actions
  fetchPositions: (params: StakingFilters & { page?: number; limit?: number }) => Promise<void>;
  fetchValidators: (params: ValidatorFilters) => Promise<void>;
  fetchMetrics: () => Promise<void>;
  fetchRewards: () => Promise<void>;
  fetchWalletBalance: () => Promise<void>;
  stake: (request: StakeRequest) => Promise<StakingPosition>;
  unstake: (request: UnstakeRequest) => Promise<void>;
  claimRewards: (request: RewardClaimRequest) => Promise<void>;
  delegateToValidator: (request: ValidatorDelegationRequest) => Promise<void>;
  redelegate: (request: RedelegationRequest) => Promise<void>;
  refreshData: () => Promise<void>;
}

const defaultPagination: StakingPagination = {
  currentPage: 1,
  totalPages: 1,
  totalCount: 0,
  hasNextPage: false,
  hasPrevPage: false,
};

export function useStaking(): UseStakingReturn {
  const [positions, setPositions] = useState<StakingPosition[]>([]);
  const [validators, setValidators] = useState<ValidatorInfo[]>([]);
  const [metrics, setMetrics] = useState<StakingMetrics | null>(null);
  const [rewards, setRewards] = useState<StakingReward[]>([]);
  const [walletBalance, setWalletBalance] = useState<ExternalWalletBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<StakingPagination>(defaultPagination);

  const fetchPositions = useCallback(async (params: StakingFilters & { page?: number; limit?: number }) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      
      // Add pagination params
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());
      
      // Add filter params
      if (params.minAmount) searchParams.set('minAmount', params.minAmount.toString());
      if (params.maxAmount) searchParams.set('maxAmount', params.maxAmount.toString());
      if (params.hasUnbonding !== undefined) searchParams.set('hasUnbonding', params.hasUnbonding.toString());
      if (params.sortBy) searchParams.set('sortBy', params.sortBy);
      if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

      const response = await fetch(`/api/staking/positions?${searchParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: StakingResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch staking positions');
      }

      if (data.data.positions) {
        setPositions(data.data.positions);
      }
      
      if (data.data.pagination) {
        setPagination(data.data.pagination);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error fetching staking positions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchValidators = useCallback(async (params: ValidatorFilters) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      
      // Add filter params
      if (params.status) searchParams.set('status', params.status);
      if (params.minCommission) searchParams.set('minCommission', params.minCommission.toString());
      if (params.maxCommission) searchParams.set('maxCommission', params.maxCommission.toString());
      if (params.minAPR) searchParams.set('minAPR', params.minAPR.toString());
      if (params.maxAPR) searchParams.set('maxAPR', params.maxAPR.toString());
      if (params.minUptime) searchParams.set('minUptime', params.minUptime.toString());
      if (params.sortBy) searchParams.set('sortBy', params.sortBy);
      if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

      const response = await fetch(`/api/staking/validators?${searchParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: StakingResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch validators');
      }

      if (data.data.validators) {
        setValidators(data.data.validators);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error fetching validators:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/staking/metrics');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: StakingResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch staking metrics');
      }

      if (data.data.metrics) {
        setMetrics(data.data.metrics);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error fetching staking metrics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRewards = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/staking/rewards');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: StakingResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch rewards');
      }

      if (data.data.rewards) {
        setRewards(data.data.rewards);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error fetching rewards:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWalletBalance = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/staking/wallet-balance');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch wallet balance');
      }

      setWalletBalance(data.data.balance);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error fetching wallet balance:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const stake = useCallback(async (request: StakeRequest): Promise<StakingPosition> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/staking/stake', {
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
        throw new Error(data.error || 'Failed to stake tokens');
      }

      // Refresh positions
      await fetchPositions({ page: 1, limit: 10 });

      return data.data.position;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchPositions]);

  const unstake = useCallback(async (request: UnstakeRequest): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/staking/unstake', {
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
        throw new Error(data.error || 'Failed to unstake tokens');
      }

      // Refresh positions
      await fetchPositions({ page: 1, limit: 10 });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchPositions]);

  const claimRewards = useCallback(async (request: RewardClaimRequest): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/staking/claim-rewards', {
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
        throw new Error(data.error || 'Failed to claim rewards');
      }

      // Refresh positions and rewards
      await Promise.all([
        fetchPositions({ page: 1, limit: 10 }),
        fetchRewards(),
      ]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchPositions, fetchRewards]);

  const delegateToValidator = useCallback(async (request: ValidatorDelegationRequest): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/staking/delegate', {
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
        throw new Error(data.error || 'Failed to delegate to validator');
      }

      // Refresh positions
      await fetchPositions({ page: 1, limit: 10 });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchPositions]);

  const redelegate = useCallback(async (request: RedelegationRequest): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/staking/redelegate', {
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
        throw new Error(data.error || 'Failed to redelegate');
      }

      // Refresh positions
      await fetchPositions({ page: 1, limit: 10 });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchPositions]);

  const refreshData = useCallback(async () => {
    await Promise.all([
      fetchPositions({ page: 1, limit: 10 }),
      fetchValidators({}),
      fetchMetrics(),
      fetchRewards(),
      fetchWalletBalance(),
    ]);
  }, [fetchPositions, fetchValidators, fetchMetrics, fetchRewards, fetchWalletBalance]);

  return {
    positions,
    validators,
    metrics,
    rewards,
    walletBalance,
    loading,
    error,
    pagination,
    fetchPositions,
    fetchValidators,
    fetchMetrics,
    fetchRewards,
    fetchWalletBalance,
    stake,
    unstake,
    claimRewards,
    delegateToValidator,
    redelegate,
    refreshData,
  };
}