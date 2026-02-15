'use client';

import { useState } from 'react';
import { 
  ArrowUpRight, 
  Wallet, 
  CreditCard,
  Gift,
  Info,
  CheckCircle,
  Loader2
} from 'lucide-react';

interface WithdrawalMethod {
  id: string;
  type: 'crypto' | 'card';
  name: string;
  description: string;
  fee: string;
  processingTime: string;
  icon: string;
  available: boolean;
}

const withdrawalMethods: WithdrawalMethod[] = [
  {
    id: 'crypto-sui',
    type: 'crypto',
    name: 'Crypto Withdrawal (SUI)',
    description: 'Withdraw to your SUI wallet',
    fee: 'Free (3 remaining)',
    processingTime: 'Instant',
    icon: '💎',
    available: true,
  },
  {
    id: 'crypto-usdc',
    type: 'crypto',
    name: 'Crypto Withdrawal (USDC)',
    description: 'Withdraw to USDC wallet',
    fee: 'Free (3 remaining)',
    processingTime: 'Instant',
    icon: '💵',
    available: true,
  },
  {
    id: 'card',
    type: 'card',
    name: 'Card Withdrawal',
    description: 'Withdraw to linked debit card',
    fee: 'Free (1 month remaining)',
    processingTime: '1-3 business days',
    icon: '💳',
    available: true,
  },
];

export function CryptoWithdrawalInterface() {
  const [selectedMethod, setSelectedMethod] = useState<WithdrawalMethod>(withdrawalMethods[0]);
  const [withdrawalAmount, setWithdrawalAmount] = useState<number>(0);
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const availableBalance = 5000; // Mock available balance

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleMaxClick = () => {
    setWithdrawalAmount(availableBalance);
  };

  const handleWithdraw = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Reset form
      setWithdrawalAmount(0);
      setWalletAddress('');
    } catch (error) {
      console.error('Withdrawal failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Withdrawal Method Selection */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Withdraw Funds</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Choose your withdrawal method
            </p>
          </div>
          <div className="p-3 bg-green-500/20 rounded-xl">
            <ArrowUpRight className="w-6 h-6 text-green-400" />
          </div>
        </div>

        {/* Available Balance */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Available to Withdraw</span>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(availableBalance)}
            </span>
          </div>
        </div>

        {/* Withdrawal Methods */}
        <div className="space-y-3 mb-6">
          {withdrawalMethods.map((method) => {
            const isSelected = selectedMethod.id === method.id;
            
            return (
              <div
                key={method.id}
                onClick={() => setSelectedMethod(method)}
                className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <span className="text-2xl">{method.icon}</span>
                    </div>
                    <div>
                      <h4 className="text-gray-900 dark:text-white font-medium">{method.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{method.description}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-400">{method.fee}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{method.processingTime}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* First-Time User Incentive Banner */}
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Gift className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-purple-400 font-medium text-sm">New User Incentives Active!</p>
              <p className="text-gray-300 text-sm mt-1">
                • 3 free crypto withdrawals with sponsored gas fees<br />
                • 1 month free card maintenance (no monthly charges)
              </p>
            </div>
          </div>
        </div>

        {/* Withdrawal Amount */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Withdrawal Amount
          </label>
          <div className="relative">
            <input
              type="number"
              value={withdrawalAmount || ''}
              onChange={(e) => setWithdrawalAmount(Number(e.target.value))}
              placeholder="0.00"
              max={availableBalance}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
              <button
                onClick={handleMaxClick}
                className="px-2 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/20 rounded"
              >
                MAX
              </button>
              <span className="text-gray-600 dark:text-gray-400">USD</span>
            </div>
          </div>
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-2">
            <span>Available Balance</span>
            <span>{formatCurrency(availableBalance)}</span>
          </div>
        </div>

        {/* Wallet Address (for crypto withdrawals) */}
        {selectedMethod.type === 'crypto' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Wallet Address
            </label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="Enter your wallet address"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Withdrawal Summary */}
        {withdrawalAmount > 0 && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Withdrawal Amount</span>
              <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(withdrawalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Processing Fee</span>
              <span className="text-green-400 font-medium">{selectedMethod.fee}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Processing Time</span>
              <span className="text-gray-900 dark:text-white font-medium">{selectedMethod.processingTime}</span>
            </div>
            <div className="pt-3 border-t border-gray-700 flex justify-between">
              <span className="text-gray-900 dark:text-white font-medium">You'll Receive</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(withdrawalAmount)}</span>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-300 space-y-2">
              <p>• Crypto withdrawals are instant with sponsored gas fees</p>
              <p>• Card withdrawals take 1-3 business days to process</p>
              <p>• USDSui withdrawals have zero fees and sponsored gas</p>
              <p>• Withdrawal limits and fraud checks apply</p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleWithdraw}
          disabled={
            loading || 
            withdrawalAmount === 0 || 
            withdrawalAmount > availableBalance ||
            (selectedMethod.type === 'crypto' && !walletAddress)
          }
          className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
          {loading ? 'Processing...' : `Withdraw ${withdrawalAmount > 0 ? formatCurrency(withdrawalAmount) : 'Funds'}`}
        </button>
      </div>

      {/* Recent Withdrawals */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Recent Withdrawals</h3>
        
        <div className="space-y-3">
          {[
            { id: 1, amount: 1000, method: 'Crypto (SUI)', status: 'completed', date: new Date(Date.now() - 86400000) },
            { id: 2, amount: 500, method: 'Card', status: 'processing', date: new Date(Date.now() - 172800000) },
          ].map((withdrawal) => (
            <div key={withdrawal.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  withdrawal.status === 'completed' ? 'bg-green-500/20' : 'bg-yellow-500/20'
                }`}>
                  {withdrawal.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                  )}
                </div>
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">{formatCurrency(withdrawal.amount)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{withdrawal.method}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-medium ${
                  withdrawal.status === 'completed' ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {withdrawal.status === 'completed' ? 'Completed' : 'Processing'}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {withdrawal.date.toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
