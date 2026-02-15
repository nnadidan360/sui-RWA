'use client';

import { useState } from 'react';
import { 
  Shield, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Lock,
  Unlock,
  Info
} from 'lucide-react';

interface CreditCapability {
  id: string;
  capabilityId: string;
  maxBorrowAmount: number;
  usedAmount: number;
  assetRefs: string[];
  expiry: Date;
  policyId: string;
  isActive: boolean;
  createdAt: Date;
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
}

const mockCapabilities: CreditCapability[] = [
  {
    id: '1',
    capabilityId: 'CAP-001',
    maxBorrowAmount: 150000,
    usedAmount: 100000,
    assetRefs: ['RWA-001', 'RWA-002'],
    expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    policyId: 'POLICY-001',
    isActive: true,
    createdAt: new Date('2024-01-15'),
    riskBand: 'LOW',
  },
  {
    id: '2',
    capabilityId: 'CAP-002',
    maxBorrowAmount: 50000,
    usedAmount: 25000,
    assetRefs: ['CRYPTO-001'],
    expiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    policyId: 'POLICY-002',
    isActive: true,
    createdAt: new Date('2024-02-01'),
    riskBand: 'MEDIUM',
  },
];

export function CreditCapabilityVisualization() {
  const [selectedCapability, setSelectedCapability] = useState<CreditCapability | null>(mockCapabilities[0]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const getRiskBandConfig = (riskBand: string) => {
    switch (riskBand) {
      case 'LOW':
        return { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Low Risk' };
      case 'MEDIUM':
        return { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Medium Risk' };
      case 'HIGH':
        return { color: 'text-red-400', bg: 'bg-red-500/20', label: 'High Risk' };
      default:
        return { color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Unknown' };
    }
  };

  const getUtilizationPercentage = (capability: CreditCapability) => {
    return (capability.usedAmount / capability.maxBorrowAmount) * 100;
  };

  const getDaysUntilExpiry = (expiry: Date) => {
    return Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const totalBorrowingPower = mockCapabilities.reduce((sum, cap) => sum + cap.maxBorrowAmount, 0);
  const totalUsed = mockCapabilities.reduce((sum, cap) => sum + cap.usedAmount, 0);
  const totalAvailable = totalBorrowingPower - totalUsed;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Shield className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex items-center text-sm text-blue-400">
              <TrendingUp className="w-4 h-4 mr-1" />
              Active
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(totalBorrowingPower)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Borrowing Power</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Unlock className="h-5 w-5 text-green-400" />
            </div>
            <div className="flex items-center text-sm text-green-400">
              Available
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(totalAvailable)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Available Credit</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Lock className="h-5 w-5 text-purple-400" />
            </div>
            <div className="flex items-center text-sm text-purple-400">
              In Use
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(totalUsed)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Currently Borrowed</p>
          </div>
        </div>
      </div>

      {/* Capabilities List */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Your Credit Capabilities</h3>
        
        <div className="space-y-4">
          {mockCapabilities.map((capability) => {
            const riskConfig = getRiskBandConfig(capability.riskBand);
            const utilization = getUtilizationPercentage(capability);
            const daysLeft = getDaysUntilExpiry(capability.expiry);
            
            return (
              <div
                key={capability.id}
                onClick={() => setSelectedCapability(capability)}
                className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                  selectedCapability?.id === capability.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-gray-900 dark:text-white font-medium">
                        Capability #{capability.capabilityId}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {capability.assetRefs.length} asset{capability.assetRefs.length !== 1 ? 's' : ''} • Expires in {daysLeft} days
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className={`px-3 py-1 rounded-lg ${riskConfig.bg}`}>
                      <span className={`text-sm font-medium ${riskConfig.color}`}>
                        {riskConfig.label}
                      </span>
                    </div>
                    {capability.isActive ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Max Borrow</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(capability.maxBorrowAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Used</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(capability.usedAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Available</p>
                    <p className="text-sm font-medium text-green-400">
                      {formatCurrency(capability.maxBorrowAmount - capability.usedAmount)}
                    </p>
                  </div>
                </div>

                {/* Utilization Bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
                    <span>Utilization: {utilization.toFixed(1)}%</span>
                    <span>{capability.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        utilization < 50 ? 'bg-green-500' : 
                        utilization < 75 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Capability View */}
      {selectedCapability && (
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Capability Details - {selectedCapability.capabilityId}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Capability Information</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Capability ID</span>
                    <span className="text-gray-900 dark:text-white font-medium">{selectedCapability.capabilityId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Policy ID</span>
                    <span className="text-gray-900 dark:text-white font-medium">{selectedCapability.policyId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Created</span>
                    <span className="text-gray-900 dark:text-white font-medium">{formatDate(selectedCapability.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Expires</span>
                    <span className="text-gray-900 dark:text-white font-medium">{formatDate(selectedCapability.expiry)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Borrowing Limits</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Max Borrow Amount</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatCurrency(selectedCapability.maxBorrowAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Currently Used</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatCurrency(selectedCapability.usedAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Available</span>
                    <span className="text-green-400 font-medium">
                      {formatCurrency(selectedCapability.maxBorrowAmount - selectedCapability.usedAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Risk Band</span>
                    <span className={`font-medium ${getRiskBandConfig(selectedCapability.riskBand).color}`}>
                      {getRiskBandConfig(selectedCapability.riskBand).label}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Linked Assets */}
          <div className="mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Linked Assets</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedCapability.assetRefs.map((assetRef, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <span className="text-sm">🏢</span>
                  </div>
                  <div>
                    <p className="text-gray-900 dark:text-white font-medium text-sm">Asset {assetRef}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Verified</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expiry Warning */}
          {getDaysUntilExpiry(selectedCapability.expiry) < 30 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-yellow-400 font-medium text-sm">Expiring Soon</p>
                <p className="text-gray-300 text-sm mt-1">
                  This capability expires in {getDaysUntilExpiry(selectedCapability.expiry)} days. 
                  Renew it to maintain your borrowing power.
                </p>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mt-6">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-300 space-y-2">
                <p>• Capabilities are time-bound and revocable</p>
                <p>• Each capability is linked to specific verified assets</p>
                <p>• Risk bands determine interest rates and terms</p>
                <p>• All capabilities are recorded on-chain for transparency</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
