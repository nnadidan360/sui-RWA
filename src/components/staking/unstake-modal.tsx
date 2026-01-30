'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  ArrowDownRight, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Loader2,
  Info,
  Zap
} from 'lucide-react';

interface UnstakeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UnstakeModal({ isOpen, onClose }: UnstakeModalProps) {
  const [unstakeAmount, setUnstakeAmount] = useState<number>(0);
  const [instantUnstake, setInstantUnstake] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mock user staking data
  const availableStCSPR = 52500;
  const exchangeRate = 1.058;
  const unbondingPeriod = 21; // days
  const instantUnstakeFee = 0.5; // 0.5%

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setUnstakeAmount(0);
      setInstantUnstake(false);
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

  const getCSPRAmount = () => {
    return unstakeAmount / exchangeRate;
  };

  const getInstantUnstakeFeeAmount = () => {
    return getCSPRAmount() * (instantUnstakeFee / 100);
  };

  const getNetCSPRAmount = () => {
    const cspr = getCSPRAmount();
    return instantUnstake ? cspr - getInstantUnstakeFeeAmount() : cspr;
  };

  const getCompletionDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + unbondingPeriod);
    return date;
  };

  const handleSubmit = async () => {
    if (unstakeAmount === 0 || unstakeAmount > availableStCSPR) return;
    
    setLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Close modal and reset
      onClose();
    } catch (error) {
      console.error('Failed to unstake:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/80" onClick={onClose} />
        
        <div className="relative w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Unstake Tokens</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                Convert your stCSPR back to CSPR tokens
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Unstake Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Unstake Amount
              </label>
              <div className="relative">
                <ArrowDownRight className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-600 dark:text-gray-400" />
                <input
                  type="number"
                  value={unstakeAmount || ''}
                  onChange={(e) => setUnstakeAmount(Number(e.target.value))}
                  placeholder="0"
                  max={availableStCSPR}
                  className="w-full pl-10 pr-20 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400">
                  stCSPR
                </div>
              </div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-2">
                <span>Available balance</span>
                <button
                  onClick={() => setUnstakeAmount(availableStCSPR)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Max: {formatCurrency(availableStCSPR, 'stCSPR')}
                </button>
              </div>
            </div>

            {/* Unstaking Options */}
            {unstakeAmount > 0 && (
              <div className="space-y-4">
                <h3 className="text-gray-900 dark:text-white font-medium">Unstaking Options</h3>
                
                {/* Standard Unstaking */}
                <div
                  onClick={() => setInstantUnstake(false)}
                  className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                    !instantUnstake
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <Clock className="w-5 h-5 text-blue-400" />
                      <span className="text-gray-900 dark:text-white font-medium">Standard Unstaking</span>
                    </div>
                    {!instantUnstake && <CheckCircle className="w-5 h-5 text-blue-400" />}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 ml-8">
                    <p>• No fees</p>
                    <p>• {unbondingPeriod}-day unbonding period</p>
                    <p>• You will receive: {formatCurrency(getCSPRAmount())}</p>
                    <p>• Available: {getCompletionDate().toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Instant Unstaking */}
                <div
                  onClick={() => setInstantUnstake(true)}
                  className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                    instantUnstake
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <Zap className="w-5 h-5 text-orange-400" />
                      <span className="text-gray-900 dark:text-white font-medium">Instant Unstaking</span>
                    </div>
                    {instantUnstake && <CheckCircle className="w-5 h-5 text-orange-400" />}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 ml-8">
                    <p>• {formatPercentage(instantUnstakeFee)} fee ({formatCurrency(getInstantUnstakeFeeAmount())})</p>
                    <p>• Immediate availability</p>
                    <p>• You will receive: {formatCurrency(getNetCSPRAmount())}</p>
                    <p>• Available: Immediately</p>
                  </div>
                </div>
              </div>
            )}

            {/* Unstake Summary */}
            {unstakeAmount > 0 && (
              <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
                <h4 className="text-gray-900 dark:text-white font-medium">Unstake Summary</h4>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Unstake Amount</span>
                    <span className="text-gray-900 dark:text-white">
                      {formatCurrency(unstakeAmount, 'stCSPR')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Exchange Rate</span>
                    <span className="text-gray-900 dark:text-white">
                      1 stCSPR = {(1 / exchangeRate).toFixed(4)} CSPR
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">CSPR Amount</span>
                    <span className="text-gray-900 dark:text-white">
                      {formatCurrency(getCSPRAmount())}
                    </span>
                  </div>
                  {instantUnstake && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Instant Fee ({formatPercentage(instantUnstakeFee)})</span>
                      <span className="text-red-400">
                        -{formatCurrency(getInstantUnstakeFeeAmount())}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-700 pt-2">
                    <span className="text-gray-600 dark:text-gray-400">You will receive</span>
                    <span className="text-green-400 font-medium">
                      {formatCurrency(getNetCSPRAmount())}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Available</span>
                    <span className="text-gray-900 dark:text-white">
                      {instantUnstake ? 'Immediately' : getCompletionDate().toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Important Information */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <h4 className="text-blue-400 font-medium text-sm">Important Information</h4>
                  <div className="text-gray-300 text-sm mt-2 space-y-1">
                    <p>• Standard unstaking requires a {unbondingPeriod}-day unbonding period</p>
                    <p>• During unbonding, your tokens will not earn rewards</p>
                    <p>• Instant unstaking is subject to availability and fees</p>
                    <p>• You can track your unbonding requests in your positions</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Warning for large amounts */}
            {unstakeAmount > availableStCSPR * 0.5 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-yellow-400 font-medium text-sm">Large Unstake Amount</p>
                  <p className="text-gray-300 text-sm mt-1">
                    You're unstaking a large portion of your staked tokens. Consider keeping some staked to continue earning rewards.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-800">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSubmit}
              disabled={loading || unstakeAmount === 0 || unstakeAmount > availableStCSPR}
              className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-gray-900 dark:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? 'Processing...' : (
                <>
                  <ArrowDownRight className="w-4 h-4 mr-2" />
                  {instantUnstake ? 'Instant Unstake' : 'Start Unbonding'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}