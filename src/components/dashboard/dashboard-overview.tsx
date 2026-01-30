'use client';

import { useTranslations } from 'next-intl';
import { Coins, CreditCard, Shield, ArrowUpRight, ArrowDownRight, Zap, DollarSign } from 'lucide-react';

type ChangeType = 'positive' | 'negative' | 'neutral';

export function DashboardOverview() {
  const t = useTranslations('dashboard');
  const commonT = useTranslations('common');
  const assetsT = useTranslations('assets');
  const lendingT = useTranslations('lending');
  const stakingT = useTranslations('staking');

  const stats = [
    {
      name: t('totalValue'),
      value: '$0.00',
      change: '+0.00%',
      changeType: 'positive' as ChangeType,
      icon: DollarSign,
      description: commonT('loading')
    },
    {
      name: stakingT('rewards'),
      value: '0.00 CSPR',
      change: '+0.00%',
      changeType: 'positive' as ChangeType,
      icon: Zap,
      description: 'Annual percentage yield'
    },
    {
      name: 'Active Loans',
      value: '0',
      change: '0',
      changeType: 'neutral' as ChangeType,
      icon: CreditCard,
      description: 'Borrowed positions'
    },
    {
      name: assetsT('title'),
      value: '0',
      change: '+0',
      changeType: 'neutral' as ChangeType,
      icon: Coins,
      description: 'Real-world assets'
    },
  ];

  const quickActions = [
    {
      name: stakingT('stake') + ' CSPR',
      description: 'Earn rewards while maintaining liquidity',
      icon: Zap,
      gradient: 'from-blue-500 to-cyan-500',
      href: '/staking'
    },
    {
      name: assetsT('tokenize'),
      description: 'Convert real-world assets to tokens',
      icon: Coins,
      gradient: 'from-purple-500 to-pink-500',
      href: '/assets'
    },
    {
      name: 'Get Loan',
      description: 'Borrow against your tokenized assets',
      icon: CreditCard,
      gradient: 'from-green-500 to-emerald-500',
      href: '/lending'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="relative overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-500/10 dark:via-purple-500/10 dark:to-pink-500/10 border border-blue-500/20 dark:border-blue-500/20 rounded-2xl p-8">
          <div className="relative z-10">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-gray-900 dark:text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome to RWA Protocol</h1>
                <p className="text-gray-600 dark:text-gray-400">Liquid staking and real-world asset lending on Casper</p>
              </div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-yellow-500 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Security First Architecture</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    External wallet custody, SafeERC20 standards, and comprehensive access controls protect your assets.
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full blur-3xl"></div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <stat.icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div className={`flex items-center text-sm ${
                stat.changeType === 'positive' 
                  ? 'text-green-600 dark:text-green-400' 
                  : stat.changeType === 'negative' 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {stat.changeType === 'positive' && <ArrowUpRight className="w-4 h-4 mr-1" />}
                {stat.changeType === 'negative' && <ArrowDownRight className="w-4 h-4 mr-1" />}
                {stat.change}
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{stat.value}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{stat.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">{t('quickActions')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {quickActions.map((action) => (
            <a
              key={action.name}
              href={action.href}
              className="group relative overflow-hidden bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 rounded-xl p-6 text-left transition-all duration-200 block"
            >
              <div className="flex items-start space-x-4">
                <div className={`p-3 bg-gradient-to-r ${action.gradient} rounded-lg`}>
                  <action.icon className="h-6 w-6 text-gray-900 dark:text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-gray-800 dark:group-hover:text-gray-100 mb-1">
                    {action.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300">
                    {action.description}
                  </p>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            </a>
          ))}
        </div>
      </div>

      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staking Overview */}
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{stakingT('liquidStaking')}</h3>
            <div className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Active</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">{stakingT('stakedAmount')}</span>
              <span className="text-gray-900 dark:text-white font-medium">0.00 CSPR</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">{stakingT('rewards')}</span>
              <span className="text-green-600 dark:text-green-400 font-medium">+0.00 CSPR</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">APY</span>
              <span className="text-blue-600 dark:text-blue-400 font-medium">~8.5%</span>
            </div>
          </div>

          <a
            href="/staking"
            className="w-full mt-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-gray-900 dark:text-white font-medium py-3 rounded-xl transition-all duration-200 text-center block"
          >
            {stakingT('stake')}
          </a>
        </div>

        {/* Lending Overview */}
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{lendingT('positions')}</h3>
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
              <span>No positions</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Total Borrowed</span>
              <span className="text-gray-900 dark:text-white font-medium">$0.00</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Collateral Value</span>
              <span className="text-gray-900 dark:text-white font-medium">$0.00</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">{lendingT('healthFactor')}</span>
              <span className="text-gray-600 dark:text-gray-400 font-medium">-</span>
            </div>
          </div>

          <a
            href="/lending"
            className="w-full mt-6 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium py-3 rounded-xl transition-all duration-200 border border-gray-300 dark:border-gray-700 text-center block"
          >
            Explore {lendingT('title')}
          </a>
        </div>
      </div>
    </div>
  );
}