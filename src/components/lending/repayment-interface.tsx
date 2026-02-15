'use client';

import { useState } from 'react';
import { 
  DollarSign, 
  Calendar,
  CheckCircle,
  AlertCircle,
  TrendingDown,
  Loader2,
  Info
} from 'lucide-react';

interface RepaymentOption {
  id: string;
  type: 'full' | 'partial' | 'interest';
  label: string;
  amount: number;
  description: string;
  savings?: number;
}

export function RepaymentInterface() {
  const [selectedOption, setSelectedOption] = useState<string>('partial');
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const currentDebt = 105000;
  const principalRemaining = 100000;
  const interestAccrued = 5000;
  const nextPaymentDue = 2500;

  const repaymentOptions: RepaymentOption[] = [
    {
      id: 'full',
      type: 'full',
      label: 'Full Repayment',
      amount: currentDebt,
      description: 'Pay off entire loan and release collateral',
      savings: 2500,
    },
    {
      id: 'partial',
      type: 'partial',
      label: 'Partial Payment',
      amount: nextPaymentDue,
      description: 'Make scheduled payment to maintain loan health',
    },
    {
      id: 'interest',
      type: 'interest',
      label: 'Interest Only',
      amount: interestAccrued,
      description: 'Pay accrued interest to reduce debt',
    },
    {
      id: 'custom',
      type: 'partial',
      label: 'Custom Amount',
      amount: customAmount,
      description: 'Choose your own repayment amount',
    },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getNewDebt = () => {
    const option = repaymentOptions.find(o => o.id === selectedOption);
    if (!option) return currentDebt;
    return currentDebt - option.amount;
  };

  const getNewHealthFactor = () => {
    const newDebt = getNewDebt();
    const collateralValue = 150000;
    if (newDebt === 0) return Infinity;
    return (collateralValue * 0.8) / newDebt;
  };

  const handleRepay = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Reset form
      setCustomAmount(0);
    } catch (error) {
      console.error('Repayment failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Loan Status */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Current Loan Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Debt</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(currentDebt)}
            </p>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Principal Remaining</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(principalRemaining)}
            </p>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Interest Accrued</p>
            <p className="text-2xl font-bold text-yellow-400">
              {formatCurrency(interestAccrued)}
            </p>
          </div>
        </div>
      </div>

      {/* Repayment Options */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Select Repayment Option</h3>
        
        <div className="space-y-3 mb-6">
          {repaymentOptions.map((option) => {
            const isSelected = selectedOption === option.id;
            
            return (
              <div
                key={option.id}
                onClick={() => setSelectedOption(option.id)}
                className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-gray-900 dark:text-white font-medium">{option.label}</h4>
                      {option.savings && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                          Save {formatCurrency(option.savings)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{option.description}</p>
                    
                    {option.id === 'custom' && isSelected && (
                      <div className="mt-3">
                        <input
                          type="number"
                          value={customAmount || ''}
                          onChange={(e) => setCustomAmount(Number(e.target.value))}
                          placeholder="Enter amount"
                          max={currentDebt}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right ml-4">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(option.amount)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Repayment Impact */}
        {selectedOption && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
            <h4 className="text-sm font-medium text-blue-400 mb-3">Repayment Impact</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">New Debt</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {getNewDebt() === 0 ? 'Paid Off' : formatCurrency(getNewDebt())}
                </p>
                <p className="text-xs text-green-400">
                  -{formatCurrency(currentDebt - getNewDebt())}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">New Health Factor</p>
                <p className={`text-lg font-bold ${
                  getNewHealthFactor() === Infinity ? 'text-green-400' :
                  getNewHealthFactor() > 1.5 ? 'text-green-400' : 
                  getNewHealthFactor() > 1.2 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {getNewHealthFactor() === Infinity ? '∞' : getNewHealthFactor().toFixed(2)}
                </p>
                <p className="text-xs text-green-400">
                  Improved
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Interest Saved</p>
                <p className="text-lg font-bold text-green-400">
                  {formatCurrency(Math.min(interestAccrued, repaymentOptions.find(o => o.id === selectedOption)?.amount || 0))}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-300 space-y-2">
              <p>• Full repayment releases all collateral immediately</p>
              <p>• Partial payments improve your health factor</p>
              <p>• Interest-only payments prevent debt growth</p>
              <p>• All payments are recorded on-chain for transparency</p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleRepay}
          disabled={
            loading || 
            (selectedOption === 'custom' && (customAmount === 0 || customAmount > currentDebt))
          }
          className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
          {loading ? 'Processing...' : `Repay ${formatCurrency(repaymentOptions.find(o => o.id === selectedOption)?.amount || 0)}`}
        </button>
      </div>

      {/* Repayment History */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Repayment History</h3>
        
        <div className="space-y-3">
          {[
            { date: new Date('2024-03-15'), amount: 2500, type: 'Interest Payment', status: 'completed' },
            { date: new Date('2024-02-15'), amount: 2500, type: 'Interest Payment', status: 'completed' },
            { date: new Date('2024-01-15'), amount: 5000, type: 'Partial Payment', status: 'completed' },
          ].map((payment, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">{payment.type}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {payment.date.toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-900 dark:text-white font-medium">{formatCurrency(payment.amount)}</p>
                <p className="text-sm text-green-400">{payment.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
