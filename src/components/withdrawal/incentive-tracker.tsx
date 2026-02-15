'use client';

import { 
  Gift, 
  Zap,
  CreditCard,
  TrendingUp,
  Calendar,
  CheckCircle,
  Clock
} from 'lucide-react';

interface IncentiveStatus {
  type: 'crypto_free' | 'card_free' | 'usdsui_promo';
  name: string;
  description: string;
  used: number;
  total: number;
  expiresAt?: Date;
  savings: number;
  icon: any;
  color: string;
}

const mockIncentives: IncentiveStatus[] = [
  {
    type: 'crypto_free',
    name: 'Free Crypto Withdrawals',
    description: 'First-time user benefit with sponsored gas fees',
    used: 0,
    total: 3,
    expiresAt: undefined,
    savings: 15, // $5 per transaction
    icon: Gift,
    color: 'purple',
  },
  {
    type: 'card_free',
    name: 'Free Card Maintenance',
    description: 'No monthly account charges for new users',
    used: 0,
    total: 30, // days
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    savings: 10,
    icon: CreditCard,
    color: 'green',
  },
  {
    type: 'usdsui_promo',
    name: 'USDSui Zero Fees',
    description: 'Permanent zero fees for USDSui withdrawals',
    used: 0,
    total: Infinity,
    expiresAt: undefined,
    savings: 50, // estimated
    icon: Zap,
    color: 'blue',
  },
];

export function IncentiveTracker() {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const getDaysRemaining = (date: Date) => {
    return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'purple':
        return { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/50' };
      case 'green':
        return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' };
      case 'blue':
        return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' };
      default:
        return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/50' };
    }
  };

  const totalSavings = mockIncentives.reduce((sum, incentive) => sum + incentive.savings, 0);

  return (
    <div className="space-y-6">
      {/* Total Savings Banner */}
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                ${totalSavings.toFixed(2)}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Savings from Incentives
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-green-400 font-medium">Active Incentives</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {mockIncentives.length}
            </p>
          </div>
        </div>
      </div>

      {/* Active Incentives */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Your Active Incentives
        </h3>
        
        <div className="space-y-4">
          {mockIncentives.map((incentive) => {
            const Icon = incentive.icon;
            const colors = getColorClasses(incentive.color);
            const remaining = incentive.total === Infinity ? Infinity : incentive.total - incentive.used;
            const percentage = incentive.total === Infinity ? 100 : ((incentive.total - incentive.used) / incentive.total) * 100;
            
            return (
              <div
                key={incentive.type}
                className={`bg-white dark:bg-gray-900/50 border ${colors.border} rounded-2xl p-6 shadow-sm`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4">
                    <div className={`p-3 ${colors.bg} rounded-xl`}>
                      <Icon className={`w-6 h-6 ${colors.text}`} />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        {incentive.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {incentive.description}
                      </p>
                      {incentive.expiresAt && (
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          <span>Expires {formatDate(incentive.expiresAt)} ({getDaysRemaining(incentive.expiresAt)} days)</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Savings</p>
                    <p className="text-xl font-bold text-green-400">
                      ${incentive.savings.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Usage Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {remaining === Infinity ? 'Unlimited' : `${remaining} of ${incentive.total} remaining`}
                    </span>
                    <span className={colors.text}>
                      {percentage.toFixed(0)}% available
                    </span>
                  </div>
                  
                  {incentive.total !== Infinity && (
                    <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          percentage > 66 ? 'bg-green-500' : 
                          percentage > 33 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  )}
                  
                  {incentive.total === Infinity && (
                    <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                      <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse" style={{ width: '100%' }} />
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {remaining > 0 || remaining === Infinity ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-green-400 font-medium">Active</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-400 font-medium">Exhausted</span>
                      </>
                    )}
                  </div>
                  
                  {incentive.type === 'usdsui_promo' && (
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded-full">
                      Permanent Benefit
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Incentive Benefits Summary */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          How to Maximize Your Incentives
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-start space-x-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <Gift className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                Use Your Free Crypto Withdrawals
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Save $5 per transaction on your first 3 crypto withdrawals with sponsored gas
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <CreditCard className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                Enjoy Free Card Maintenance
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                No monthly charges for 30 days - save $10 on account maintenance
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <Zap className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                Switch to USDSui for Permanent Savings
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Zero fees forever with sponsored gas - the best long-term option
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
