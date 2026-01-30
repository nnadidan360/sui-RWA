'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  Shield, 
  DollarSign, 
  TrendingDown,
  CheckCircle,
  Loader2,
  Calculator
} from 'lucide-react';
import { CollateralAsset } from '@/types/lending';

interface BorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Mock available collateral assets
const mockCollateralAssets: CollateralAsset[] = [
  {
    id: 'asset-1',
    type: 'asset_token',
    tokenId: 'RWA-001',
    title: 'Downtown Office Building',
    currentValue: 150000,
    currency: 'USD',
    utilizationRatio: 0,
  },
  {
    id: 'asset-2',
    type: 'asset_token',
    tokenId: 'RWA-002',
    title: 'Industrial Warehouse',
    currentValue: 85000,
    currency: 'USD',
    utilizationRatio: 25,
  },
  {
    id: 'staked-1',
    type: 'staked_token',
    tokenId: 'SCSPR-001',
    title: 'Staked CSPR Tokens',
    currentValue: 25000,
    currency: 'USD',
    utilizationRatio: 0,
  },
];

const borrowAssets = [
  { symbol: 'CSPR', name: 'Casper Token', apy: 8.2, available: 300000 },
  { symbol: 'USDC', name: 'USD Coin', apy: 5.8, available: 170000 },
];

export function BorrowModal({ isOpen, onClose }: BorrowModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCollateral, setSelectedCollateral] = useState<string[]>([]);
  const [borrowAsset, setBorrowAsset] = useState('CSPR');
  const [borrowAmount, setBorrowAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setSelectedCollateral([]);
      setBorrowAsset('CSPR');
      setBorrowAmount(0);
      setLoading(false);
    }
  }, [isOpen]);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    if (currency === 'CSPR') {
      return `${amount.toLocaleString()} CSPR`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getSelectedCollateralValue = () => {
    return selectedCollateral.reduce((sum, id) => {
      const asset = mockCollateralAssets.find(a => a.id === id);
      return sum + (asset ? asset.currentValue * (1 - asset.utilizationRatio / 100) : 0);
    }, 0);
  };

  const getMaxBorrowAmount = () => {
    const collateralValue = getSelectedCollateralValue();
    const maxLTV = 0.75; // 75% max loan-to-value ratio
    return collateralValue * maxLTV;
  };

  const getCurrentLTV = () => {
    const collateralValue = getSelectedCollateralValue();
    if (collateralValue === 0) return 0;
    const borrowValue = borrowAsset === 'CSPR' ? borrowAmount * 0.05 : borrowAmount;
    return (borrowValue / collateralValue) * 100;
  };

  const getHealthFactor = () => {
    const collateralValue = getSelectedCollateralValue();
    const liquidationThreshold = 0.8; // 80% liquidation threshold
    const borrowValue = borrowAsset === 'CSPR' ? borrowAmount * 0.05 : borrowAmount;
    
    if (borrowValue === 0) return Infinity;
    return (collateralValue * liquidationThreshold) / borrowValue;
  };

  const getInterestRate = () => {
    const asset = borrowAssets.find(a => a.symbol === borrowAsset);
    return asset ? asset.apy : 0;
  };

  const handleCollateralToggle = (assetId: string) => {
    setSelectedCollateral(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const handleNext = () => {
    if (currentStep === 1 && selectedCollateral.length === 0) return;
    if (currentStep === 2 && (borrowAmount === 0 || borrowAmount > getMaxBorrowAmount())) return;
    
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Close modal and reset
      onClose();
    } catch (error) {
      console.error('Failed to create loan:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/80" onClick={onClose} />
        
        <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Borrow Assets</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                Step {currentStep} of 3: {
                  currentStep === 1 ? 'Select Collateral' :
                  currentStep === 2 ? 'Loan Details' : 'Review & Confirm'
                }
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="px-6 py-4 border-b border-gray-800">
            <div className="flex items-center space-x-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step < currentStep 
                      ? 'bg-green-500 text-gray-900 dark:text-white' 
                      : step === currentStep 
                      ? 'bg-blue-500 text-gray-900 dark:text-white' 
                      : 'bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {step < currentStep ? <CheckCircle className="w-4 h-4" /> : step}
                  </div>
                  {step < 3 && (
                    <div className={`w-16 h-1 mx-2 ${
                      step < currentStep ? 'bg-green-500' : 'bg-gray-700'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Step 1: Select Collateral */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Select Collateral Assets</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                    Choose the assets you want to use as collateral for your loan.
                  </p>
                </div>

                <div className="space-y-3">
                  {mockCollateralAssets.map((asset) => {
                    const isSelected = selectedCollateral.includes(asset.id);
                    const availableValue = asset.currentValue * (1 - asset.utilizationRatio / 100);
                    
                    return (
                      <div
                        key={asset.id}
                        onClick={() => handleCollateralToggle(asset.id)}
                        className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              asset.type === 'asset_token' 
                                ? 'bg-purple-500/20 text-purple-400' 
                                : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {asset.type === 'asset_token' ? '🏢' : '💎'}
                            </div>
                            <div>
                              <h4 className="text-gray-900 dark:text-white font-medium">{asset.title}</h4>
                              <p className="text-gray-600 dark:text-gray-400 text-sm">
                                {asset.type === 'asset_token' ? 'Real World Asset' : 'Staked Token'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-gray-900 dark:text-white font-medium">
                              {formatCurrency(availableValue, asset.currency)}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                              {asset.utilizationRatio > 0 && (
                                <span className="text-yellow-400">
                                  {asset.utilizationRatio}% utilized
                                </span>
                              )}
                              {asset.utilizationRatio === 0 && 'Available'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedCollateral.length > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-400 font-medium">Total Collateral Value</span>
                      <span className="text-gray-900 dark:text-white font-bold">
                        {formatCurrency(getSelectedCollateralValue())}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Loan Details */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Loan Details</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                    Configure your loan amount and terms.
                  </p>
                </div>

                {/* Asset Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Asset to Borrow
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {borrowAssets.map((asset) => (
                      <button
                        key={asset.symbol}
                        onClick={() => setBorrowAsset(asset.symbol)}
                        className={`p-4 text-left border rounded-xl transition-all duration-200 ${
                          borrowAsset === asset.symbol
                            ? 'border-blue-500 bg-blue-500/10 text-gray-900 dark:text-white'
                            : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{asset.symbol}</span>
                          <span className="text-sm text-green-400">{formatPercentage(asset.apy)} APR</span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{asset.name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatCurrency(asset.available, asset.symbol === 'CSPR' ? 'CSPR' : 'USD')} available
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Borrow Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Borrow Amount
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <input
                      type="number"
                      value={borrowAmount || ''}
                      onChange={(e) => setBorrowAmount(Number(e.target.value))}
                      placeholder="0.00"
                      max={getMaxBorrowAmount()}
                      className="w-full pl-10 pr-20 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400">
                      {borrowAsset}
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-2">
                    <span>Available to borrow</span>
                    <button
                      onClick={() => setBorrowAmount(getMaxBorrowAmount())}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Max: {formatCurrency(getMaxBorrowAmount(), borrowAsset === 'CSPR' ? 'CSPR' : 'USD')}
                    </button>
                  </div>
                </div>

                {/* Loan Metrics */}
                {borrowAmount > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-800/50 rounded-xl p-4">
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">LTV Ratio</p>
                      <p className="text-gray-900 dark:text-white font-semibold">{formatPercentage(getCurrentLTV())}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4">
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Interest Rate</p>
                      <p className="text-gray-900 dark:text-white font-semibold">{formatPercentage(getInterestRate())}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4">
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Health Factor</p>
                      <p className={`font-semibold ${
                        getHealthFactor() > 1.5 ? 'text-green-400' : 
                        getHealthFactor() > 1.2 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {getHealthFactor() === Infinity ? '∞' : getHealthFactor().toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review & Confirm */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Review Your Loan</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                    Please review the loan details before confirming.
                  </p>
                </div>

                {/* Loan Summary */}
                <div className="bg-gray-800/50 rounded-xl p-6 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Borrow Amount</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatCurrency(borrowAmount, borrowAsset === 'CSPR' ? 'CSPR' : 'USD')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Interest Rate</span>
                    <span className="text-gray-900 dark:text-white font-medium">{formatPercentage(getInterestRate())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">LTV Ratio</span>
                    <span className="text-gray-900 dark:text-white font-medium">{formatPercentage(getCurrentLTV())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Health Factor</span>
                    <span className={`font-medium ${
                      getHealthFactor() > 1.5 ? 'text-green-400' : 
                      getHealthFactor() > 1.2 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {getHealthFactor() === Infinity ? '∞' : getHealthFactor().toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Collateral Value</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatCurrency(getSelectedCollateralValue())}
                    </span>
                  </div>
                </div>

                {/* Risk Warning */}
                {getHealthFactor() < 1.5 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div>
                      <p className="text-yellow-400 font-medium text-sm">Moderate Risk</p>
                      <p className="text-gray-300 text-sm">
                        Your health factor is below 1.5. Monitor your position closely to avoid liquidation.
                      </p>
                    </div>
                  </div>
                )}

                {getHealthFactor() >= 1.5 && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-green-400 mt-0.5" />
                    <div>
                      <p className="text-green-400 font-medium text-sm">Healthy Position</p>
                      <p className="text-gray-300 text-sm">
                        Your loan has a good health factor and low liquidation risk.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-800">
            <div className="flex space-x-3">
              {currentStep > 1 && (
                <button
                  onClick={handleBack}
                  disabled={loading}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  Back
                </button>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              
              {currentStep < 3 ? (
                <button
                  onClick={handleNext}
                  disabled={
                    loading || 
                    (currentStep === 1 && selectedCollateral.length === 0) ||
                    (currentStep === 2 && (borrowAmount === 0 || borrowAmount > getMaxBorrowAmount()))
                  }
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-gray-900 dark:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-gray-900 dark:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {loading ? 'Creating Loan...' : 'Confirm Loan'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}