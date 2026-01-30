'use client';

import { useState, useCallback } from 'react';
import { Asset, AssetFilters, AssetsPagination, AssetsResponse } from '@/types/assets';

interface UseAssetsReturn {
  assets: Asset[];
  loading: boolean;
  error: string | null;
  pagination: AssetsPagination;
  fetchAssets: (params: AssetFilters & { page?: number; limit?: number; search?: string }) => Promise<void>;
  createAsset: (assetData: any) => Promise<Asset>;
  updateAsset: (id: string, updates: Partial<Asset>) => Promise<Asset>;
  deleteAsset: (id: string) => Promise<void>;
  refreshAssets: () => Promise<void>;
}

const defaultPagination: AssetsPagination = {
  currentPage: 1,
  totalPages: 1,
  totalCount: 0,
  hasNextPage: false,
  hasPrevPage: false,
};

export function useAssets(): UseAssetsReturn {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<AssetsPagination>(defaultPagination);
  const [lastParams, setLastParams] = useState<any>(null);

  const fetchAssets = useCallback(async (params: AssetFilters & { page?: number; limit?: number; search?: string }) => {
    setLoading(true);
    setError(null);
    setLastParams(params);

    try {
      const searchParams = new URLSearchParams();
      
      // Add pagination params
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());
      
      // Add filter params
      if (params.assetType) searchParams.set('assetType', params.assetType);
      if (params.status) searchParams.set('status', params.status);
      if (params.owner) searchParams.set('owner', params.owner);
      if (params.minValue) searchParams.set('minValue', params.minValue.toString());
      if (params.maxValue) searchParams.set('maxValue', params.maxValue.toString());
      if (params.sortBy) searchParams.set('sortBy', params.sortBy);
      if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
      if (params.search) searchParams.set('search', params.search);

      const response = await fetch(`/api/assets?${searchParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: AssetsResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch assets');
      }

      // If this is a new page request (not page 1), append to existing assets
      if (params.page && params.page > 1) {
        setAssets(prev => [...prev, ...data.data.assets]);
      } else {
        setAssets(data.data.assets);
      }
      
      setPagination(data.data.pagination);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error fetching assets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createAsset = useCallback(async (assetData: any): Promise<Asset> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assetData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create asset');
      }

      // Refresh the assets list
      if (lastParams) {
        await fetchAssets(lastParams);
      }

      return data.data.asset;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchAssets, lastParams]);

  const updateAsset = useCallback(async (id: string, updates: Partial<Asset>): Promise<Asset> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/assets/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update asset');
      }

      // Update the asset in the local state
      setAssets(prev => prev.map(asset => 
        asset.id === id ? { ...asset, ...data.data.asset } : asset
      ));

      return data.data.asset;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAsset = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/assets/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete asset');
      }

      // Remove the asset from local state
      setAssets(prev => prev.filter(asset => asset.id !== id));
      
      // Update pagination count
      setPagination(prev => ({
        ...prev,
        totalCount: prev.totalCount - 1,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAssets = useCallback(async () => {
    if (lastParams) {
      await fetchAssets({ ...lastParams, page: 1 });
    }
  }, [fetchAssets, lastParams]);

  return {
    assets,
    loading,
    error,
    pagination,
    fetchAssets,
    createAsset,
    updateAsset,
    deleteAsset,
    refreshAssets,
  };
}