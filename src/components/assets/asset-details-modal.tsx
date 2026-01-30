'use client';

import { useState } from 'react';
import { 
  X, 
  MapPin, 
  Calendar, 
  DollarSign, 
  FileText, 
  User,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Download,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';
import { Asset, AssetType } from '@/types/assets';

interface AssetDetailsModalProps {
  asset: Asset;
  isOpen: boolean;
  onClose: () => void;
}

const assetTypeLabels: Record<AssetType, string> = {
  real_estate: 'Real Estate',
  commodity: 'Commodity',
  invoice: 'Invoice',
  equipment: 'Equipment',
  other: 'Other',
};

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Pending Review' },
  under_review: { icon: RefreshCw, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Under Review' },
  approved: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Approved' },
  rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Rejected' },
  requires_update: { icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Requires Update' },
};

const documentTypeLabels = {
  deed: 'Deed/Title',
  appraisal: 'Appraisal Report',
  insurance: 'Insurance Policy',
  permit: 'Permit/License',
  other: 'Other Document',
};

export function AssetDetailsModal({ asset, isOpen, onClose }: AssetDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'history' | 'loans'>('overview');
  
  if (!isOpen) return null;

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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const formatDateShort = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  };

  const getValueChange = () => {
    if (asset.financialData.valueHistory.length < 2) return null;
    
    const current = asset.financialData.currentValue;
    const previous = asset.financialData.valueHistory[asset.financialData.valueHistory.length - 2].value;
    const change = current - previous;
    const percentage = (change / previous) * 100;
    
    return {
      amount: change,
      percentage,
      isPositive: change >= 0,
    };
  };

  const valueChange = getValueChange();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/80" onClick={onClose} />
        
        <div className="relative w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-2xl shadow-xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div className="flex items-center space-x-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{asset.metadata.title}</h2>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">
                    {assetTypeLabels[asset.assetType]}
                  </span>
                  <div className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg ${status.bg} ${status.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-800">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'documents', label: 'Documents' },
                { id: 'history', label: 'History' },
                { id: 'loans', label: 'Loans' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:border-gray-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-600 dark:text-gray-400 text-sm">Current Value</span>
                      {valueChange && (
                        <div className={`flex items-center text-xs ${
                          valueChange.isPositive ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {valueChange.isPositive ? (
                            <TrendingUp className="w-3 h-3 mr-1" />
                          ) : (
                            <TrendingDown className="w-3 h-3 mr-1" />
                          )}
                          {valueChange.percentage.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(asset.financialData.currentValue, asset.metadata.valuation.currency)}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl p-4">
                    <span className="text-gray-600 dark:text-gray-400 text-sm">Token ID</span>
                    <p className="text-lg font-mono text-gray-900 dark:text-white mt-2 break-all">
                      {asset.tokenId}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl p-4">
                    <span className="text-gray-600 dark:text-gray-400 text-sm">Loan Utilization</span>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                      {asset.financialData.utilizationInLoans.length}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Active loans</p>
                  </div>
                </div>

                {/* Asset Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Asset Information</h3>
                    
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">Description</p>
                          <p className="text-gray-900 dark:text-white">{asset.metadata.description}</p>
                        </div>
                      </div>

                      {asset.metadata.location && (
                        <div className="flex items-start space-x-3">
                          <MapPin className="w-5 h-5 text-blue-400 mt-0.5" />
                          <div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Location</p>
                            <p className="text-gray-900 dark:text-white">{asset.metadata.location.address}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start space-x-3">
                        <User className="w-5 h-5 text-purple-400 mt-0.5" />
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">Owner</p>
                          <p className="text-gray-900 dark:text-white font-mono text-sm break-all">{asset.owner}</p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <Calendar className="w-5 h-5 text-green-400 mt-0.5" />
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">Created</p>
                          <p className="text-gray-900 dark:text-white">{formatDate(asset.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Verification Status</h3>
                    
                    <div className="space-y-3">
                      {Object.entries(asset.verification.complianceChecks).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400 text-sm capitalize">
                            {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                          </span>
                          <div className={`flex items-center ${value ? 'text-green-400' : 'text-gray-500'}`}>
                            {value ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {asset.verification.notes && (
                      <div className="mt-4 p-3 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg">
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Verification Notes</p>
                        <p className="text-gray-900 dark:text-white text-sm">{asset.verification.notes}</p>
                      </div>
                    )}

                    {asset.verification.rejectionReason && (
                      <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-red-400 text-sm mb-1">Rejection Reason</p>
                        <p className="text-gray-900 dark:text-white text-sm">{asset.verification.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* On-chain Data */}
                {asset.onChainData.contractAddress && (
                  <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">On-chain Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Contract Address</p>
                        <p className="text-gray-900 dark:text-white font-mono text-sm break-all">{asset.onChainData.contractAddress}</p>
                      </div>
                      {asset.onChainData.transactionHash && (
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">Transaction Hash</p>
                          <p className="text-gray-900 dark:text-white font-mono text-sm break-all">{asset.onChainData.transactionHash}</p>
                        </div>
                      )}
                      {asset.onChainData.blockNumber && (
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">Block Number</p>
                          <p className="text-gray-900 dark:text-white">{asset.onChainData.blockNumber}</p>
                        </div>
                      )}
                      {asset.onChainData.mintedAt && (
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">Minted At</p>
                          <p className="text-gray-900 dark:text-white">{formatDate(asset.onChainData.mintedAt)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Asset Documents</h3>
                
                {asset.metadata.documents.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">No documents uploaded</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {asset.metadata.documents.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl">
                        <div className="flex items-center space-x-3">
                          <FileText className="w-5 h-5 text-blue-400" />
                          <div>
                            <p className="text-gray-900 dark:text-white font-medium">{doc.fileName}</p>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                              {documentTypeLabels[doc.type]} • Uploaded {formatDateShort(doc.uploadDate)}
                            </p>
                            {doc.verifiedBy && (
                              <p className="text-green-400 text-xs mt-1">
                                ✓ Verified by {doc.verifiedBy} on {formatDateShort(doc.verificationDate!)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-700 rounded-lg transition-colors">
                            <Download className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-700 rounded-lg transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                {/* Value History */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Value History</h3>
                  <div className="space-y-3">
                    {asset.financialData.valueHistory.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg">
                        <div>
                          <p className="text-gray-900 dark:text-white font-medium">
                            {formatCurrency(entry.value, asset.metadata.valuation.currency)}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">Source: {entry.source}</p>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">{formatDate(entry.date)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audit Trail */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Audit Trail</h3>
                  <div className="space-y-3">
                    {asset.auditTrail.map((entry, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg">
                        <Activity className="w-5 h-5 text-blue-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-gray-900 dark:text-white font-medium capitalize">
                            {entry.action.replace(/_/g, ' ')}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            By {entry.performedBy} • {formatDate(entry.timestamp)}
                          </p>
                          {Object.keys(entry.details).length > 0 && (
                            <div className="mt-2 text-xs text-gray-500">
                              {JSON.stringify(entry.details, null, 2)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Loans Tab */}
            {activeTab === 'loans' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Loan Utilization</h3>
                
                {asset.financialData.utilizationInLoans.length === 0 ? (
                  <div className="text-center py-8">
                    <DollarSign className="w-12 h-12 text-gray-600 dark:text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">This asset is not currently used as collateral</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {asset.financialData.utilizationInLoans.map((loan, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl">
                        <div>
                          <p className="text-gray-900 dark:text-white font-medium">Loan #{loan.loanId}</p>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            Collateral: {formatCurrency(loan.amount, asset.metadata.valuation.currency)}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            Started: {formatDate(loan.startDate)}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-lg ${
                            loan.endDate ? 'bg-gray-500/20 text-gray-600 dark:text-gray-400' : 'bg-green-500/20 text-green-400'
                          }`}>
                            {loan.endDate ? 'Completed' : 'Active'}
                          </div>
                          {loan.endDate && (
                            <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                              Ended: {formatDate(loan.endDate)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}