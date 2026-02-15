'use client';

import { useState } from 'react';
import { 
  Wallet, 
  CreditCard,
  Zap,
  Gift,
  CheckCircle,
  Info,
  ArrowRight
} from 'lucide-react';

interface WithdrawalMethod {
  id: string;
  type: 'crypto' | 'card' | 'usdsui';
  name: string;
  description: string;
  fee: string;
  feeAmount: number;
  processingTime: string;
  icon: any;
  available: boolean;
  incentive?: {
    type: 'free_transactions' | 'free_maintenance' | 'zero_fee';
    remaining?: number;
    description: string;
  };
}

const withdrawalMethods: WithdrawalMethod[] = [
  {
    id: 'usdsui',
    type: 'usdsui',
    name: 'USDSui Withdrawal',
    description: 'Withdraw to USDSui with zero fees and sponsored gas',
    fee: 'Free',
    feeAmount: 0,
    processingTime: 'Instant',
    icon: Zap,
    available: true,
    incentive: {
      type: 'zero_fee',
      description: 'Always free with sponsored gas',
    },
  },
  {
    id: 'crypto-sui',
    type: 'crypto',
    name: 'Crypto Withdrawal (SUI)',
    description: 'Withdraw to your SUI wallet address',
    fee: 'Free',
    feeAmount: 0,
    processingTime: 'Instant',
    icon: Wallet,
    available: true,
    incentive: {
      type: 'free_transactions',
      remaining: 3,
      description: '3 free transactions remaining',
    },
  },
  {
    id: 'crypto-usdc',
    type: 'crypto',
    name: 'Crypto Withdrawal (USDC)',
    description: 'Withdraw to your USDC wallet address',
    fee: 'Free',
    feeAmount: 0,
    processingTime: 'Instant',
    icon: Wallet,
    available: true,
    incentive: {
      type: 'free_transactions',
      remaining: 3,
      description: '3 free transactions remaining',
    },
  },
  {
    id: 'card',
    type: 'card',
    name: 'Card Withdrawal',
    description: 'Withdraw to your linked debit card',
    fee: 'Free',
    feeAmount: 0,
    processingTime: '1-3 business days',
    icon: CreditCard,
    available: true,
    incentive: {
      type: 'free_maintenance',
      remaining: 30,
      description: '1 month free maintenance',
    },
  },
];

interface WithdrawalMethodSelectorProps {
  onMethodSelect: (method: WithdrawalMethod) => void;
  selectedMethodId?: string;
}

export function WithdrawalMethodSelector({ onMethodSelect, selectedMethodId }: WithdrawalMethodSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<WithdrawalMethod | null>(
    withdrawalMethods.find(m => m.id === selectedMethodId) || null
  );

  const handleMethodSelect = (method: WithdrawalMethod) => {
    setSelectedMethod(method);
    onMethodSelect(method);
  };

  return (
    <div className="space-y-6">
      {/* USDSui Promotion Banner */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-blue-500/20 rounded-xl">
            <Zap className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              USDSui - Zero Fees Forever
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
              Withdraw using USDSui and enjoy zero withdrawal fees with sponsored gas. 
              Help grow TVL and get the best rates!
            </p>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2 text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span>Zero Fees</span>
              </div>
              <div className="flex items-center space-x-2 text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span>Sponsored Gas</span>
              </div>
              <div className="flex items-center space-x-2 text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span>Instant Processing</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Withdrawal Methods */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Select Withdrawal Method
        </h3>
        
        <div className="space-y-3">
          {withdrawalMethods.map((method) => {
            const isSelected = selectedMethod?.id === method.id;
            const Icon = method.icon;
            
            return (
              <div
                key={method.id}
                onClick={() => handleMethodSelect(method)}
                className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/50'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                } ${!method.available && 'opacity-50 cursor-not-allowed'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      method.type === 'usdsui' ? 'bg-blue-500/20' :
                      method.type === 'crypto' ? 'bg-purple-500/20' : 'bg-green-500/20'
                    }`}>
                      <Icon className={`w-6 h-6 ${
                        method.type === 'usdsui' ? 'text-blue-400' :
                        method.type === 'crypto' ? 'text-purple-400' : 'text-green-400'
                      }`} />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="text-gray-900 dark:text-white font-medium">
                          {method.name}
                        </h4>
                        {method.incentive && (
                          <div className="flex items-center space-x-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                            <Gift className="w-3 h-3" />
                            <span>Incentive</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {method.description}
                      </p>
                      
                      {method.incentive && (
                        <div className="flex items-center space-x-2 text-xs text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          <span>{method.incentive.description}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right ml-4">
                    <p className={`text-lg font-bold ${
                      method.feeAmount === 0 ? 'text-green-400' : 'text-gray-900 dark:text-white'
                    }`}>
                      {method.fee}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {method.processingTime}
                    </p>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Selected Method</span>
                      <div className="flex items-center space-x-2 text-blue-400">
                        <CheckCircle className="w-4 h-4" />
                        <span>Ready to withdraw</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Method Comparison */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-300 space-y-2">
            <p><strong>USDSui:</strong> Best option with zero fees and instant processing</p>
            <p><strong>Crypto:</strong> First 3 withdrawals free for new users</p>
            <p><strong>Card:</strong> 1 month free maintenance, then standard fees apply</p>
          </div>
        </div>
      </div>
    </div>
  );
}
