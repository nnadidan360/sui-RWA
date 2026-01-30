'use client';

import { useState } from 'react';
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
  RefreshCw
} from 'lucide-react';
import { Asset, AssetType } from '@/types/assets';

interface AssetCardProps {
  asset: Asset;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const assetTypeLabels: Record<AssetType, string> = {
  real_estate: 'Real Estate',
  commodity: 'Commodity',
  invoice: 'Invoice',
  equipment: 'Equipment',
  other: 'Other',
};

const assetTypeColors: Record<AssetType, string> = {
  real_estate: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  commodity: 'bg-green-500/20 text-green-400 border-green-500/30',
  invoice: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  equipment: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  other: 'bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30',
};

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Pending' },
  under_review: { icon: RefreshCw, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Under Review' },
  approved: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Approved' },
  rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Rejected' },
  requires_update: { icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Needs Update' },
};

export function AssetCard({ asset, onView, onEdit, onDelete }: AssetCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const status = statusConfig[asset.verification.status];
  const StatusIcon = status.icon;

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

  return (
    <div className="group relative bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm hover:border-gray-700 rounded-2xl p-6 transition-all duration-200 hover:shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-lg border ${assetTypeColors[asset.assetType]}`}>
              {assetTypeLabels[asset.assetType]}
            </span>
            <div className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg ${status.bg} ${status.color}`}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-gray-100 line-clamp-2">
            {asset.metadata.title}
          </h3>
        </div>
        
        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20">
                <button
                  onClick={() => {
                    onView();
                    setShowMenu(false);
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:text-gray-900 dark:text-white hover:bg-gray-700 transition-colors"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </button>
                <button
                  onClick={() => {
                    onEdit();
                    setShowMenu(false);
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:text-gray-900 dark:text-white hover:bg-gray-700 transition-colors"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Asset
                </button>
                <button
                  onClick={() => {
                    onDelete();
                    setShowMenu(false);
                  }}
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

      {/* Description */}
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
        {asset.metadata.description}
      </p>

      {/* Details */}
      <div className="space-y-3 mb-4">
        {/* Value */}
        <div className="flex items-center text-sm">
          <DollarSign className="w-4 h-4 text-green-400 mr-2" />
          <span className="text-gray-600 dark:text-gray-400">Value:</span>
          <span className="text-gray-900 dark:text-white font-medium ml-2">
            {formatCurrency(asset.financialData.currentValue, asset.metadata.valuation.currency)}
          </span>
        </div>

        {/* Location */}
        {asset.metadata.location && (
          <div className="flex items-center text-sm">
            <MapPin className="w-4 h-4 text-blue-400 mr-2" />
            <span className="text-gray-600 dark:text-gray-400">Location:</span>
            <span className="text-gray-900 dark:text-white ml-2 truncate">
              {asset.metadata.location.address}
            </span>
          </div>
        )}

        {/* Created Date */}
        <div className="flex items-center text-sm">
          <Calendar className="w-4 h-4 text-purple-400 mr-2" />
          <span className="text-gray-600 dark:text-gray-400">Created:</span>
          <span className="text-gray-900 dark:text-white ml-2">
            {formatDate(asset.createdAt)}
          </span>
        </div>

        {/* Documents */}
        <div className="flex items-center text-sm">
          <FileText className="w-4 h-4 text-orange-400 mr-2" />
          <span className="text-gray-600 dark:text-gray-400">Documents:</span>
          <span className="text-gray-900 dark:text-white ml-2">
            {asset.metadata.documents.length} file{asset.metadata.documents.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-800">
        <div className="text-xs text-gray-500">
          ID: {asset.tokenId.slice(0, 12)}...
        </div>
        <button
          onClick={onView}
          className="px-3 py-1.5 text-sm font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-all duration-200"
        >
          View Details
        </button>
      </div>

      {/* Loan Utilization Indicator */}
      {asset.financialData.utilizationInLoans.length > 0 && (
        <div className="absolute top-4 right-4">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" title="Used as collateral" />
        </div>
      )}
    </div>
  );
}