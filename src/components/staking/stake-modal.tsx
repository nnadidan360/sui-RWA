'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  Zap, 
  TrendingUp,
  CheckCircle,
  Loader2,
  Info,
  AlertTriangle
} from 'lucide-react';
import { ValidatorInfo } from '@/types/staking';

interface StakeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Mock validator data for selection
const mockValidators: ValidatorInfo[] = [
  {
    address: '0x1234...5678',
    name: 'Casper Validator 1',
    commission: 5.0,
    delegatedAmount: 125000,
    totalStaked: 2500000,
    performance: 98.5,
    uptime: 99.8,
    isActive: true,
    status: 'active',
    apr: 8.7,
    logo: '🛡️',
  },
  {
    address: '0x2345...6789',
    name: 'Secure Staking Co',
    commission: 4.5,
    delegatedAmount: 89000,
    totalStaked: 1800000,
    performance: 97.2,
    uptime: 99.5,
    isActive: true,
    status: 'active',
    apr: 8.9,
    logo: '🔒',
  },
  {
    address: '0x4567...8901',
    name: 'High Performance Node',
    commission: 3.5,
    delegatedAmount: 156000,
    totalStaked: 3200000,
    performance: 99.1,
    uptime: 99.9,
    isActive: true,
    status: 'active',
    apr: 9.1,
    logo: '⚡',
  },
];

type DistributionStrategy = 'equal' | 'performance' | 'custom';

export function StakeModal({ isOpen, onClose }: StakeModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [stakeAmount, setStakeAmount] = useState<number>(0);
  const [selectedValidators, setSelectedValidators] = useState<string[]>([]);
  const [distributionStrategy, setDistributionStrategy] = useState<DistributionStrategy>('equal');
  const [customDistribution, setCustomDistribution] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(false);

  const availableBalance = 100000; // Mock available CSPR balance
  const minStakeAmount = 1000;
  const exchangeRate = 1.058;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setStakeAmount(0);
      setSelectedValidators([]);
      setDistributionStrategy('equal');
      setCustomDistribution({});
      setLoading(false);
    }
  }, [isOpen]);

  const formatCurrency = (amount: number, currency: string = 'CSPR') => {
    if (currency === 'CSPR' || currency === 'stCSPR') {
      return `${amount.toLocaleString()} ${currency}`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getExpectedStCSPR = () => {
    return stakeAmount * exchangeRate;
  };

  const getEstimatedAPR = () => {
    if (selectedValidators.length === 0) return 0;
    
    const totalAPR = selectedValidators.reduce((sum, address) => {
      const validator = mockValidators.find(v => v.address === address);
      return sum + (validator?.apr || 0);
    }, 0);
    
    return totalAPR / selectedValidators.length;
  };

  const getEstimatedAnnualRewards = () => {
    return (stakeAmount * getEstimatedAPR()) / 100;
  };

  const handleValidatorToggle = (address: string) => {
    setSelectedValidators(prev => {
      if (prev.includes(address)) {
        return prev.filter(addr => addr !== address);
      } else if (prev.length < 5) { // Max 5 validators
        return [...prev, address];
      }
      return prev;
    });
  };

  const getDistributionAmount = (validatorAddress: string) => {
    if (distributionStrategy === 'equal') {
      return stakeAmount / selectedValidators.length;
    } else if (distributionStrategy === 'performance') {
      const validator = mockValidators.find(v => v.address === validatorAddress);
      if (!validator) return 0;
      
      const totalPerformance = selectedValidators.reduce((sum, addr) => {
        const val = mockValidators.find(v => v.address === addr);
        return sum + (val?.performance || 0);
      }, 0);
      
      return (validator.performance / totalPerformance) * stakeAmount;
    } else {
      return (customDistribution[validatorAddress] || 0) * stakeAmount / 100;
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && (stakeAmount < minStakeAmount || stakeAmount > availableBalance)) return;
    if (currentStep === 2 && selectedValidators.length === 0) return;
    
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
      console.error('Failed to stake:', error);
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
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Stake CSPR Tokens</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                Step {currentStep} of 3: {
                  currentStep === 1 ? 'Stake Amount' :
                  currentStep === 2 ? 'Select Validators' : 'Review & Confirm'
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
            {/* Step 1: Stake Amount */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">How much CSPR do you want to stake?</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                    Stake your CSPR tokens to earn rewards while maintaining liquidity with stCSPR tokens.
                  </p>
                </div>

                {/* Stake Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Stake Amount
                  </label>
                  <div className="relative">
                    <Zap className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <input
                      type="number"
                      value={stakeAmount || ''}
                      onChange={(e) => setStakeAmount(Number(e.target.value))}
                      placeholder="0"
                      min={minStakeAmount}
                      max={availableBalance}
                      className="w-full pl-10 pr-20 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400">
                      CSPR
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-2">
                    <span>Min: {formatCurrency(minStakeAmount)}</span>
                    <button
                      onClick={() => setStakeAmount(availableBalance)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Max: {formatCurrency(availableBalance)}
                    </button>
                  </div>
                </div>

                {/* Expected Returns */}
                {stakeAmount >= minStakeAmount && (
                  <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
                    <h4 className="text-gray-900 dark:text-white font-medium">Expected Returns</h4>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">You will receive</span>
                        <span className="text-gray-900 dark:text-white">
                          {formatCurrency(getExpectedStCSPR(), 'stCSPR')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Exchange Rate</span>
                        <span className="text-gray-900 dark:text-white">
                          1 CSPR = {exchangeRate.toFixed(4)} stCSPR
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Estimated APR</span>
                        <span className="text-green-400 font-medium">
                          ~{formatPercentage(8.5)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Est. Annual Rewards</span>
                        <span className="text-green-400 font-medium">
                          +{formatCurrency((stakeAmount * 8.5) / 100)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Benefits */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                      <h4 className="text-blue-400 font-medium text-sm">Liquid Staking Benefits</h4>
                      <div className="text-gray-300 text-sm mt-2 space-y-1">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-3 h-3 text-green-400" />
                          <span>Earn staking rewards automatically</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-3 h-3 text-green-400" />
                          <span>Use stCSPR tokens in DeFi protocols</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-3 h-3 text-green-400" />
                          <span>No minimum lock-up period</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-3 h-3 text-green-400" />
                          <span>Professional validator management</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Select Validators */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Select Validators</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                    Choose up to 5 validators to delegate your stake. We recommend selecting multiple validators for better diversification.
                  </p>
                </div>

                {/* Distribution Strategy */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Distribution Strategy
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'equal', label: 'Equal Split', desc: 'Distribute equally across validators' },
                      { id: 'performance', label: 'Performance Based', desc: 'Weight by validator performance' },
                      { id: 'custom', label: 'Custom', desc: 'Set custom distribution percentages' },
                    ].map((strategy) => (
                      <button
                        key={strategy.id}
                        onClick={() => setDistributionStrategy(strategy.id as DistributionStrategy)}
                        className={`p-3 text-left border rounded-xl transition-all duration-200 ${
                          distributionStrategy === strategy.id
                            ? 'border-blue-500 bg-blue-500/10 text-gray-900 dark:text-white'
                            : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600'
                        }`}
                      >
                        <div className="font-medium text-sm">{strategy.label}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{strategy.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Validator Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Available Validators ({selectedValidators.length}/5 selected)
                  </label>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {mockValidators.map((validator) => {
                      const isSelected = selectedValidators.includes(validator.address);
                      const distributionAmount = isSelected ? getDistributionAmount(validator.address) : 0;

                      return (
                        <div
                          key={validator.address}
                          onClick={() => handleValidatorToggle(validator.address)}
                          className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="text-2xl">{validator.logo}</div>
                              <div>
                                <h4 className="text-gray-900 dark:text-white font-medium">{validator.name}</h4>
                                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                                  <span>{formatPercentage(validator.commission)} commission</span>
                                  <span>{formatPercentage(validator.apr)} APR</span>
                                  <span>{formatPercentage(validator.performance)} performance</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              {isSelected && (
                                <div>
                                  <p className="text-gray-900 dark:text-white font-medium">
                                    {formatCurrency(distributionAmount)}
                                  </p>
                                  <p className="text-blue-400 text-sm">
                                    {formatPercentage((distributionAmount / stakeAmount) * 100)}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selection Summary */}
                {selectedValidators.length > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-blue-400 font-medium">Selection Summary</span>
                      <span className="text-gray-900 dark:text-white font-bold">
                        {formatCurrency(stakeAmount)} total
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Validators:</span>
                        <span className="text-gray-900 dark:text-white ml-2">{selectedValidators.length}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Avg APR:</span>
                        <span className="text-green-400 ml-2">{formatPercentage(getEstimatedAPR())}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review & Confirm */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Review Your Stake</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                    Please review your staking details before confirming the transaction.
                  </p>
                </div>

                {/* Stake Summary */}
                <div className="bg-gray-800/50 rounded-xl p-6 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Stake Amount</span>
                    <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(stakeAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">You will receive</span>
                    <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(getExpectedStCSPR(), 'stCSPR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Exchange Rate</span>
                    <span className="text-gray-900 dark:text-white font-medium">1 CSPR = {exchangeRate.toFixed(4)} stCSPR</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Estimated APR</span>
                    <span className="text-green-400 font-medium">{formatPercentage(getEstimatedAPR())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Est. Annual Rewards</span>
                    <span className="text-green-400 font-medium">+{formatCurrency(getEstimatedAnnualRewards())}</span>
                  </div>
                </div>

                {/* Validator Distribution */}
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <h4 className="text-gray-900 dark:text-white font-medium mb-3">Validator Distribution</h4>
                  <div className="space-y-2">
                    {selectedValidators.map((address) => {
                      const validator = mockValidators.find(v => v.address === address);
                      const amount = getDistributionAmount(address);
                      
                      return (
                        <div key={address} className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <span className="text-xl">{validator?.logo}</span>
                            <span className="text-gray-900 dark:text-white">{validator?.name}</span>
                          </div>
                          <span className="text-gray-300">{formatCurrency(amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Important Notice */}
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-yellow-400 font-medium text-sm">Important Notice</p>
                    <p className="text-gray-300 text-sm mt-1">
                      Your CSPR tokens will be staked through our external wallet infrastructure. 
                      You can unstake at any time, but there is a 21-day unbonding period for the underlying CSPR tokens.
                    </p>
                  </div>
                </div>
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
                    (currentStep === 1 && (stakeAmount < minStakeAmount || stakeAmount > availableBalance)) ||
                    (currentStep === 2 && selectedValidators.length === 0)
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
                  {loading ? 'Staking...' : 'Confirm Stake'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}