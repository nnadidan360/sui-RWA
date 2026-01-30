'use client';

import { useState } from 'react';
import { Plus, Filter, Search, Grid, List } from 'lucide-react';
import { AssetsList } from './assets-list';
import { AssetsGrid } from './assets-grid';
import { AssetFilters } from './asset-filters';
import { CreateAssetModal } from './create-asset-modal';
import { AssetFilters as AssetFiltersType } from '@/types/assets';
// import { useUserAssets } from '@/hooks/use-blockchain-data';

type ViewMode = 'grid' | 'list';

export function AssetsOverview() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<AssetFiltersType>({
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  // Get real user assets data
  // const { data: assets, loading: assetsLoading } = useUserAssets();

  const handleFiltersChange = (newFilters: AssetFiltersType) => {
    setFilters(newFilters);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Real World Assets</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Tokenize and manage your physical assets</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-gray-900 dark:text-white font-medium rounded-xl transition-all duration-200"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tokenize Asset
        </button>
      </div>

      {/* Search and Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-600 dark:text-gray-400" />
          <input
            type="text"
            placeholder="Search assets by title, type, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Filters Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
              showFilters
                ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                : 'bg-white dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-900 dark:text-white shadow-sm'
            }`}
          >
            <Filter className="w-5 h-5 mr-2" />
            Filters
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all duration-200 ${
                viewMode === 'grid'
                  ? 'bg-blue-500 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-900 dark:text-white'
              }`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all duration-200 ${
                viewMode === 'list'
                  ? 'bg-blue-500 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-900 dark:text-white'
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <AssetFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Assets Display */}
      {viewMode === 'grid' ? (
        <AssetsGrid 
          searchQuery={searchQuery}
          filters={filters}
        />
      ) : (
        <AssetsList 
          searchQuery={searchQuery}
          filters={filters}
        />
      )}

      {/* Create Asset Modal */}
      {showCreateModal && (
        <CreateAssetModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}