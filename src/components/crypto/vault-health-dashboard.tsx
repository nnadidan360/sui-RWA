'use client';

import { useState } from 'react';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Shield,
  DollarSign,
  Clock
} from 'lucide-react';

interface CryptoVault {
  id: string;
  assetType: string;
  depositedAmount: number;
  currentValue: number;
  borrowedAmount: number;
  ltv: number;
  healthFactor: number;
  liquidationThreshold: number;
  lastUpdate: Date;
}

const mockVaults: CryptoVault[] = [
  {
    id: 'vault-1',
    assetType: 'SUI',
    depositedAmount: 10000,
    currentValue: 15000,
    borrowedAmount: 3000,
    ltv: 20,
    healthFactor: 2.5,
    liquidationThreshold: 60,
    lastUpdate: new Date(),
  },
  {
    id: 'vault-2',
    assetType: 'USDC',
    depositedAmount: 5000,
    currentValue: 5000,
    borrowedAmount: 1200,
    ltv: 24,
    healthFactor: 2.08,
    liquidationThreshold: 60,
    lastUpdate: new Date(),
  },
];

export function VaultHealthDashboard() {
  const [selectedVault, setSelectedVault] = useState<CryptoVault | null>(mockVaults[0]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getHealthStatus = (healthFactor: number) => {
    if (healthFactor > 1.5) return { label: 'Healthy', color: 'text-green-400', bg: 'bg-green-500/20', icon: Shield };
    if (healthFactor > 1.2) return { label: 'Moderate Risk', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: AlertTriangle };
    return { label: 'High Risk', color: 'text-red-400', bg: 'bg-red-500/20', icon: AlertTriangle };
  };

  const getLTVStatus = (ltv: number) => {
    if (ltv < 30) return { color: 'text-green-400', bg: 'bg-green-500' };
    if (ltv < 45) return { color: 'text-yellow-400', bg: 'bg-yellow-500' };
    return { color: 'text-red-400', bg: 'bg-red-500' };
  };

  const totalCollateralValue = mockVaults.reduce((sum, v) => sum + v.currentValue, 0);
  const totalBorrowed = mockVaults.reduce((sum, v) => sum + v.borrowedAmount, 0);
  const averageLTV = totalBorrowed / totalCollateralValue * 100;
  const averageHealthFactor = mockVaults.reduce((sum, v) => sum + v.healthFactor, 0) / mockVaults.length;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Collateral */}
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <DollarSign className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex items-center text-sm text-blue-400">
              <TrendingUp className="w-4 h-4 mr-1" />
              +5.2%
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(totalCollateralValue)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Collateral</p>
          </div>
        </div>

        {/* Average LTV */}
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Activity className="h-5 w-5 text-purple-400" />
            </div>
            <div className={`flex items-center text-sm ${getLTVStatus(averageLTV).color}`}>
              {averageLTV < 30 ? <TrendingDown className="w-4 h-4 mr-1" /> : <TrendingUp className="w-4 h-4 mr-1" />}
              {averageLTV.toFixed(1)}%
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {averageLTV.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Average LTV</p>
          </div>
        </div>

        {/* Average Health Factor */}
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-2 ${getHealthStatus(averageHealthFactor).bg} rounded-lg`}>
              <Shield className="h-5 w-5 text-green-400" />
            </div>
            <div className={`flex items-center text-sm ${getHealthStatus(averageHealthFactor).color}`}>
              {getHealthStatus(averageHealthFactor).label}
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {averageHealthFactor.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Health Factor</p>
          </div>
        </div>
      </div>

      {/* Vault List */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Your Crypto Vaults</h3>
        
        <div className="space-y-4">
          {mockVaults.map((vault) => {
            const healthStatus = getHealthStatus(vault.healthFactor);
            const ltvStatus = getLTVStatus(vault.ltv);
            const HealthIcon = healthStatus.icon;
            
            return (
              <div
                key={vault.id}
                onClick={() => setSelectedVault(vault)}
                className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                  selectedVault?.id === vault.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <span className="text-xl">💎</span>
                    </div>
                    <div>
                      <h4 className="text-gray-900 dark:text-white font-medium">{vault.assetType} Vault</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {vault.depositedAmount.toLocaleString()} {vault.assetType}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 ${healthStatus.bg} rounded-lg`}>
                      <HealthIcon className={`w-4 h-4 ${healthStatus.color}`} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Collateral Value</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(vault.currentValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Borrowed</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(vault.borrowedAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">LTV</p>
                    <p className={`text-sm font-medium ${ltvStatus.color}`}>
                      {vault.ltv.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Health Factor</p>
                    <p className={`text-sm font-medium ${healthStatus.color}`}>
                      {vault.healthFactor.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* LTV Progress Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
                    <span>Current LTV: {vault.ltv.toFixed(1)}%</span>
                    <span>Liquidation: {vault.liquidationThreshold}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${ltvStatus.bg}`}
                      style={{ width: `${(vault.ltv / vault.liquidationThreshold) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Vault View */}
      {selectedVault && (
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedVault.assetType} Vault Details
            </h3>
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <Clock className="w-4 h-4" />
              <span>Updated {selectedVault.lastUpdate.toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Collateral Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">Collateral Information</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Deposited Amount</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {selectedVault.depositedAmount.toLocaleString()} {selectedVault.assetType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Current Value</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {formatCurrency(selectedVault.currentValue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Available to Borrow</span>
                  <span className="text-green-400 font-medium">
                    {formatCurrency(selectedVault.currentValue * 0.3 - selectedVault.borrowedAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Risk Metrics */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">Risk Metrics</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Current LTV</span>
                  <span className={`font-medium ${getLTVStatus(selectedVault.ltv).color}`}>
                    {selectedVault.ltv.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Max LTV</span>
                  <span className="text-gray-900 dark:text-white font-medium">30%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Liquidation Threshold</span>
                  <span className="text-red-400 font-medium">{selectedVault.liquidationThreshold}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Health Factor</span>
                  <span className={`font-medium ${getHealthStatus(selectedVault.healthFactor).color}`}>
                    {selectedVault.healthFactor.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors">
              Add Collateral
            </button>
            <button className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors">
              Borrow More
            </button>
            <button className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-colors">
              Repay Loan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
