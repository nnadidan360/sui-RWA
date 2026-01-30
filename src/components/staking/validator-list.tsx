'use client';

import { useState } from 'react';
import { 
  Shield, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Filter,
  Search,
  ExternalLink,
  MoreVertical
} from 'lucide-react';
import { ValidatorInfo, ValidatorStatus } from '@/types/staking';

// Mock validator data
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
    website: 'https://validator1.com',
    description: 'Professional validator with 99%+ uptime and competitive rates.',
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
    website: 'https://securestaking.com',
    description: 'Enterprise-grade validator infrastructure with 24/7 monitoring.',
  },
  {
    address: '0x3456...7890',
    name: 'Community Validator',
    commission: 6.0,
    delegatedAmount: 67000,
    totalStaked: 1200000,
    performance: 96.8,
    uptime: 98.9,
    isActive: true,
    status: 'active',
    apr: 8.4,
    logo: '👥',
    description: 'Community-run validator supporting decentralization.',
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
    website: 'https://hpnode.com',
    description: 'High-performance validator with cutting-edge infrastructure.',
  },
  {
    address: '0x5678...9012',
    name: 'Inactive Validator',
    commission: 7.0,
    delegatedAmount: 0,
    totalStaked: 500000,
    performance: 85.2,
    uptime: 95.1,
    isActive: false,
    status: 'inactive',
    apr: 0,
    logo: '⏸️',
    description: 'Currently inactive validator.',
  },
];

const statusConfig: Record<ValidatorStatus, { icon: any; color: string; bg: string; label: string }> = {
  active: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Active' },
  inactive: { icon: XCircle, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-500/20', label: 'Inactive' },
  jailed: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Jailed' },
  unbonding: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Unbonding' },
};

export function ValidatorList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedValidators, setSelectedValidators] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'commission' | 'apr' | 'totalStaked' | 'performance' | 'uptime'>('apr');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} CSPR`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getPerformanceColor = (performance: number) => {
    if (performance >= 98) return 'text-green-400';
    if (performance >= 95) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return 'text-green-400';
    if (uptime >= 97) return 'text-yellow-400';
    return 'text-red-400';
  };

  const handleValidatorToggle = (address: string) => {
    setSelectedValidators(prev => 
      prev.includes(address) 
        ? prev.filter(addr => addr !== address)
        : [...prev, address]
    );
  };

  const filteredAndSortedValidators = mockValidators
    .filter(validator => 
      validator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      validator.address.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Validators</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Choose validators to delegate your stake</p>
        </div>
        {selectedValidators.length > 0 && (
          <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-gray-900 dark:text-white font-medium rounded-xl transition-colors">
            Delegate to {selectedValidators.length} Validator{selectedValidators.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-600 dark:text-gray-400" />
          <input
            type="text"
            placeholder="Search validators by name or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-3 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="apr">APR</option>
            <option value="commission">Commission</option>
            <option value="totalStaked">Total Staked</option>
            <option value="performance">Performance</option>
            <option value="uptime">Uptime</option>
          </select>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-3 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors"
          >
            {sortOrder === 'desc' ? '↓' : '↑'}
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
              showFilters
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-gray-900/50 text-gray-600 dark:text-gray-400 border border-gray-800 hover:text-gray-900 dark:text-white'
            }`}
          >
            <Filter className="w-5 h-5 mr-2" />
            Filters
          </button>
        </div>
      </div>

      {/* Validators List */}
      <div className="space-y-4">
        {filteredAndSortedValidators.map((validator) => {
          const status = statusConfig[validator.status];
          const StatusIcon = status.icon;
          const isSelected = selectedValidators.includes(validator.address);

          return (
            <div
              key={validator.address}
              className={`bg-gray-900/50 border rounded-2xl p-6 transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'border-blue-500 bg-blue-500/5'
                  : 'border-gray-800 hover:border-gray-700'
              }`}
              onClick={() => handleValidatorToggle(validator.address)}
            >
              {/* Validator Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="text-3xl">{validator.logo}</div>
                  <div>
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{validator.name}</h3>
                      {validator.website && (
                        <a
                          href={validator.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-gray-600 dark:text-gray-400 hover:text-blue-400 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 mt-1">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg ${status.bg} ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </div>
                      <span className="text-gray-600 dark:text-gray-400 text-sm font-mono">
                        {validator.address}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {validator.isActive && (
                    <div className="text-right">
                      <div className="flex items-center space-x-1 text-green-400 text-lg font-bold">
                        <TrendingUp className="w-5 h-5" />
                        <span>{formatPercentage(validator.apr)}</span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">APR</p>
                    </div>
                  )}
                  
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Validator Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="bg-gray-800/50 rounded-xl p-3">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Commission</p>
                  <p className="text-gray-900 dark:text-white font-semibold">{formatPercentage(validator.commission)}</p>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-3">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Staked</p>
                  <p className="text-gray-900 dark:text-white font-semibold">{formatCurrency(validator.totalStaked)}</p>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-3">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Your Delegation</p>
                  <p className="text-gray-900 dark:text-white font-semibold">{formatCurrency(validator.delegatedAmount)}</p>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-3">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Performance</p>
                  <p className={`font-semibold ${getPerformanceColor(validator.performance)}`}>
                    {formatPercentage(validator.performance)}
                  </p>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-3">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Uptime</p>
                  <p className={`font-semibold ${getUptimeColor(validator.uptime)}`}>
                    {formatPercentage(validator.uptime)}
                  </p>
                </div>
              </div>

              {/* Description */}
              {validator.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{validator.description}</p>
              )}

              {/* Performance Indicators */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {validator.performance >= 98 ? 'Excellent' : 
                       validator.performance >= 95 ? 'Good' : 'Poor'} Performance
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {validator.uptime >= 99 ? 'High' : 
                       validator.uptime >= 97 ? 'Medium' : 'Low'} Uptime
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <div className="flex items-center space-x-2 text-blue-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Selected</span>
                  </div>
                )}
              </div>

              {/* Warning for inactive validators */}
              {!validator.isActive && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-yellow-400 font-medium text-sm">Validator Inactive</p>
                    <p className="text-gray-300 text-sm">
                      This validator is currently inactive and not earning rewards.
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {selectedValidators.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Selection Summary</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{selectedValidators.length}</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Validators Selected</p>
            </div>
            
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {formatPercentage(
                  selectedValidators.reduce((sum, addr) => {
                    const validator = mockValidators.find(v => v.address === addr);
                    return sum + (validator?.commission || 0);
                  }, 0) / selectedValidators.length
                )}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Avg Commission</p>
            </div>
            
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {formatPercentage(
                  selectedValidators.reduce((sum, addr) => {
                    const validator = mockValidators.find(v => v.address === addr);
                    return sum + (validator?.apr || 0);
                  }, 0) / selectedValidators.length
                )}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Avg APR</p>
            </div>
            
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {formatPercentage(
                  selectedValidators.reduce((sum, addr) => {
                    const validator = mockValidators.find(v => v.address === addr);
                    return sum + (validator?.performance || 0);
                  }, 0) / selectedValidators.length
                )}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Avg Performance</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}