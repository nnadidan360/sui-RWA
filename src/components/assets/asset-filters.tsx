'use client';

import { X, RotateCcw } from 'lucide-react';
import { AssetFilters as AssetFiltersType, AssetType, VerificationStatus } from '@/types/assets';

interface AssetFiltersProps {
  filters: AssetFiltersType;
  onFiltersChange: (filters: AssetFiltersType) => void;
  onClose: () => void;
}

const assetTypeOptions: { value: AssetType; label: string }[] = [
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'commodity', label: 'Commodity' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
];

const statusOptions: { value: VerificationStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'text-yellow-400' },
  { value: 'under_review', label: 'Under Review', color: 'text-blue-400' },
  { value: 'approved', label: 'Approved', color: 'text-green-400' },
  { value: 'rejected', label: 'Rejected', color: 'text-red-400' },
  { value: 'requires_update', label: 'Requires Update', color: 'text-orange-400' },
];

const sortOptions = [
  { value: 'createdAt', label: 'Date Created' },
  { value: 'updatedAt', label: 'Last Updated' },
  { value: 'currentValue', label: 'Asset Value' },
  { value: 'title', label: 'Title' },
];

export function AssetFilters({ filters, onFiltersChange, onClose }: AssetFiltersProps) {
  const handleFilterChange = (key: keyof AssetFiltersType, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const resetFilters = () => {
    onFiltersChange({
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  };

  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key as keyof AssetFiltersType];
    return value !== undefined && value !== '' && !(key === 'sortBy' && value === 'createdAt') && !(key === 'sortOrder' && value === 'desc');
  });

  return (
    <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Asset Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Asset Type
          </label>
          <select
            value={filters.assetType || ''}
            onChange={(e) => handleFilterChange('assetType', e.target.value || undefined)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {assetTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Status
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Value Range */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Min Value (USD)
          </label>
          <input
            type="number"
            placeholder="0"
            value={filters.minValue || ''}
            onChange={(e) => handleFilterChange('minValue', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Max Value (USD)
          </label>
          <input
            type="number"
            placeholder="No limit"
            value={filters.maxValue || ''}
            onChange={(e) => handleFilterChange('maxValue', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Sort Options */}
      <div className="mt-6 pt-6 border-t border-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Sort By
            </label>
            <select
              value={filters.sortBy || 'createdAt'}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Sort Order
            </label>
            <select
              value={filters.sortOrder || 'desc'}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value as 'asc' | 'desc')}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}