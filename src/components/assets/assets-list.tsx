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
  XCircle,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import { Asset, AssetFilters, AssetType } from '@/types/assets';
import { AssetDetailsModal } from './asset-details-modal';
import { useAssets } from '@/hooks/use-assets';

interface AssetsListProps {
  searchQuery: string;
  filters: AssetFilters;
}

const assetTypeLabels: Record<AssetType, string> = {
  real_estate: 'Real Estate',
  commodity: 'Commodity',
  invoice: 'Invoice',
  equipment: 'Equipment',
  other: 'Other',
};

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Pending' },
  under_review: { icon: RefreshCw, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Under Review' },
  approved: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Approved' },
  rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Rejected' },
  requires_update: { icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Needs Update' },
};

export function AssetsList({ searchQuery, filters }: AssetsListProps) {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  
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
      limit: 20 
    });
  }, [searchQuery, filters, fetchAssets]);

  const handleViewAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setShowDetailsModal(true);
    setActiveMenu(null);
  };

  const handleEditAsset = (asset: Asset) => {
    // TODO: Implement edit functionality
    console.log('Edit asset:', asset.id);
    setActiveMenu(null);
  };

  const handleDeleteAsset = async (asset: Asset) => {
    if (window.confirm(`Are you sure you want to delete "${asset.metadata.title}"?`)) {
      try {
        await deleteAsset(asset.id);
        fetchAssets({ 
          ...filters, 
          search: searchQuery,
          page: pagination.currentPage,
          limit: 20 
        });
      } catch (error) {
        console.error('Failed to delete asset:', error);
      }
    }
    setActiveMenu(null);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  };

  if (loading && assets.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                <div className="h-4 bg-gray-700 rounded w-1/3"></div>
                <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                <div className="h-4 bg-gray-700 rounded w-1/6"></div>
              </div>
            ))}
          </div>
        </div>
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
          onClick={() => fetchAssets({ ...filters, search: searchQuery, page: 1, limit: 20 })}
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
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800">
          <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-600 dark:text-gray-400">
            <div className="col-span-4">Asset</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Value</div>
            <div className="col-span-1">Created</div>
            <div className="col-span-1"></div>
          </div>
        </div>

        {/* Assets List */}
        <div className="divide-y divide-gray-800">
          {assets.map((asset) => {
            const status = statusConfig[asset.verification.status];
            const StatusIcon = status.icon;

            return (
              <div
                key={asset.id}
                className="px-6 py-4 hover:bg-gray-100 dark:bg-gray-800/30 transition-colors group"
              >
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* Asset Info */}
                  <div className="col-span-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-gray-900 dark:text-white font-medium truncate group-hover:text-gray-100">
                          {asset.metadata.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm truncate">
                          {asset.metadata.description}
                        </p>
                        {asset.metadata.location && (
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <MapPin className="w-3 h-3 mr-1" />
                            {asset.metadata.location.address}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="col-span-2">
                    <span className="text-gray-300 text-sm">
                      {assetTypeLabels[asset.assetType]}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg ${status.bg} ${status.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </div>
                  </div>

                  {/* Value */}
                  <div className="col-span-2">
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatCurrency(asset.financialData.currentValue, asset.metadata.valuation.currency)}
                    </span>
                  </div>

                  {/* Created Date */}
                  <div className="col-span-1">
                    <span className="text-gray-600 dark:text-gray-400 text-sm">
                      {formatDate(asset.createdAt)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex justify-end">
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === asset.id ? null : asset.id)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {activeMenu === asset.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setActiveMenu(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20">
                            <button
                              onClick={() => handleViewAsset(asset)}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:text-gray-900 dark:text-white hover:bg-gray-700 transition-colors"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </button>
                            <button
                              onClick={() => handleEditAsset(asset)}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:text-gray-900 dark:text-white hover:bg-gray-700 transition-colors"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Asset
                            </button>
                            <button
                              onClick={() => handleDeleteAsset(asset)}
                              className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-700 transition-colors"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Asset
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Loan Utilization Indicator */}
                {asset.financialData.utilizationInLoans.length > 0 && (
                  <div className="mt-2 flex items-center text-xs text-green-400">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                    Used as collateral in {asset.financialData.utilizationInLoans.length} loan{asset.financialData.utilizationInLoans.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Load More */}
        {pagination.hasNextPage && (
          <div className="px-6 py-4 border-t border-gray-800">
            <button
              onClick={() => fetchAssets({ 
                ...filters, 
                search: searchQuery,
                page: pagination.currentPage + 1,
                limit: 20 
              })}
              disabled={loading}
              className="w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load More Assets'}
            </button>
          </div>
        )}
      </div>

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