'use client';

import { useState, useEffect } from 'react';
import { 
  MapPin, 
  Calendar, 
  DollarSign, 
  FileText, 
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { Asset, AssetFilters, AssetType } from '@/types/assets';
import { AssetCard } from './asset-card';
import { AssetDetailsModal } from './asset-details-modal';
import { useAssets } from '@/hooks/use-assets';

interface AssetsGridProps {
  searchQuery: string;
  filters: AssetFilters;
}

export function AssetsGrid({ searchQuery, filters }: AssetsGridProps) {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const { 
    assets, 
    loading, 
    error, 
    pagination,
    fetchAssets,
    deleteAsset 
  } = useAssets();

  useEffect(() => {
    fetchAssets({ 
      ...filters, 
      search: searchQuery,
      page: 1,
      limit: 12 
    });
  }, [searchQuery, filters, fetchAssets]);

  const handleViewAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setShowDetailsModal(true);
  };

  const handleEditAsset = (asset: Asset) => {
    // TODO: Implement edit functionality
    console.log('Edit asset:', asset.id);
  };

  const handleDeleteAsset = async (asset: Asset) => {
    if (window.confirm(`Are you sure you want to delete "${asset.metadata.title}"?`)) {
      try {
        await deleteAsset(asset.id);
        // Refresh the list
        fetchAssets({ 
          ...filters, 
          search: searchQuery,
          page: pagination.currentPage,
          limit: 12 
        });
      } catch (error) {
        console.error('Failed to delete asset:', error);
      }
    }
  };

  const loadMore = () => {
    if (pagination.hasNextPage) {
      fetchAssets({ 
        ...filters, 
        search: searchQuery,
        page: pagination.currentPage + 1,
        limit: 12 
      });
    }
  };

  if (loading && assets.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl p-6 animate-pulse">
            <div className="h-4 bg-gray-700 rounded mb-4"></div>
            <div className="h-3 bg-gray-700 rounded mb-2"></div>
            <div className="h-3 bg-gray-700 rounded mb-4"></div>
            <div className="h-8 bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error Loading Assets</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => fetchAssets({ ...filters, search: searchQuery, page: 1, limit: 12 })}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-gray-900 dark:text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Assets Found</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {searchQuery || Object.keys(filters).length > 2
            ? 'Try adjusting your search or filters'
            : 'Start by tokenizing your first real-world asset'
          }
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            onView={() => handleViewAsset(asset)}
            onEdit={() => handleEditAsset(asset)}
            onDelete={() => handleDeleteAsset(asset)}
          />
        ))}
      </div>

      {/* Load More Button */}
      {pagination.hasNextPage && (
        <div className="text-center mt-8">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More Assets'}
          </button>
        </div>
      )}

      {/* Pagination Info */}
      {assets.length > 0 && (
        <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4">
          Showing {assets.length} of {pagination.totalCount} assets
        </div>
      )}

      {/* Asset Details Modal */}
      {showDetailsModal && selectedAsset && (
        <AssetDetailsModal
          asset={selectedAsset}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedAsset(null);
          }}
        />
      )}
    </>
  );
}