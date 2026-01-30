'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  DollarSign, 
  TrendingUp, 
  CheckCircle,
  Loader2,
  Info,
  ArrowUpRight
} from 'lucide-react';

interface SupplyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const supplyAssets = [
  { 
    symbol: 'CSPR', 
    name: 'Casper Token', 
    apy: 6.5, 
    balance: 100000,
    poolSize: 1500000,
    utilization: 80,
    icon: '💎'
  },
  { 
    symbol: 'USDC', 
    name: 'USD Coin', 
    apy: 4.2, 
    balance: 5000,
    poolSize: 850000,
    utilization: 80,
    icon: '💵'
  },
];

export function SupplyModal({ isOpen, onClose }: SupplyModalProps) {
  const [selectedAsset, setSelectedAsset] = useState('CSPR');
  const [supplyAmount, setSupplyAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAsset('CSPR');
      setSupplyAmount(0);
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

  const getSelectedAssetData = () => {
    return supplyAssets.find(asset => asset.symbol === selectedAsset);
  };

  const getEstimatedEarnings = () => {
    const asset = getSelectedAssetData();
    if (!asset || supplyAmount === 0) return 0;
    
    return (supplyAmount * asset.apy) / 100;
  };

  const getPoolTokens = () => {
    const asset = getSelectedAssetData();
    if (!asset || supplyAmount === 0) return 0;
    
    // Simplified calculation - in reality this would be based on exchange rate
    return supplyAmount * 0.97; // Assuming 3% fee
  };

  const handleSubmit = async () => {
    if (supplyAmount === 0) return;
    
    setLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Close modal and reset
      onClose();
    } catch (error) {
      console.error('Failed to supply assets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedAssetData = getSelectedAssetData();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/80" onClick={onClose} />
        
        <div className="relative w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Supply Assets</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                Earn interest by supplying assets to lending pools
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
            {/* Asset Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Select Asset to Supply
              </label>
              <div className="space-y-3">
                {supplyAssets.map((asset) => (
                  <button
                    key={asset.symbol}
                    onClick={() => setSelectedAsset(asset.symbol)}
                    className={`w-full p-4 text-left border rounded-xl transition-all duration-200 ${
                      selectedAsset === asset.symbol
                        ? 'border-green-500 bg-green-500/10 text-gray-900 dark:text-white'
                        : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{asset.icon}</div>
                        <div>
                          <div className="font-medium">{asset.symbol}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{asset.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center text-green-400 font-medium">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          {formatPercentage(asset.apy)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">APY</div>
                      </div>
                    </div>
                    
                    <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Your Balance:</span>
                        <div className="text-gray-900 dark:text-white font-medium">
                          {formatCurrency(asset.balance, asset.symbol === 'CSPR' ? 'CSPR' : 'USD')}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Pool Size:</span>
                        <div className="text-gray-900 dark:text-white font-medium">
                          {formatCurrency(asset.poolSize, asset.symbol === 'CSPR' ? 'CSPR' : 'USD')}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Supply Amount */}
            {selectedAssetData && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Supply Amount
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <input
                    type="number"
                    value={supplyAmount || ''}
                    onChange={(e) => setSupplyAmount(Number(e.target.value))}
                    placeholder="0.00"
                    max={selectedAssetData.balance}
                    className="w-full pl-10 pr-20 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400">
                    {selectedAsset}
                  </div>
                </div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-2">
                  <span>Available balance</span>
                  <button
                    onClick={() => setSupplyAmount(selectedAssetData.balance)}
                    className="text-green-400 hover:text-green-300"
                  >
                    Max: {formatCurrency(selectedAssetData.balance, selectedAsset === 'CSPR' ? 'CSPR' : 'USD')}
                  </button>
                </div>
              </div>
            )}

            {/* Supply Summary */}
            {supplyAmount > 0 && selectedAssetData && (
              <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
                <h4 className="text-gray-900 dark:text-white font-medium">Supply Summary</h4>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Supply Amount</span>
                    <span className="text-gray-900 dark:text-white">
                      {formatCurrency(supplyAmount, selectedAsset === 'CSPR' ? 'CSPR' : 'USD')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Annual Earnings (Est.)</span>
                    <span className="text-green-400">
                      +{formatCurrency(getEstimatedEarnings(), selectedAsset === 'CSPR' ? 'CSPR' : 'USD')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Pool Tokens Received</span>
                    <span className="text-gray-900 dark:text-white">
                      {getPoolTokens().toLocaleString()} {selectedAsset}LP
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">APY</span>
                    <span className="text-green-400 font-medium">
                      {formatPercentage(selectedAssetData.apy)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Pool Information */}
            {selectedAssetData && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="text-blue-400 font-medium text-sm">Pool Information</h4>
                    <div className="text-gray-300 text-sm mt-2 space-y-1">
                      <div className="flex justify-between">
                        <span>Pool Utilization:</span>
                        <span>{formatPercentage(selectedAssetData.utilization)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Pool Size:</span>
                        <span>{formatCurrency(selectedAssetData.poolSize, selectedAsset === 'CSPR' ? 'CSPR' : 'USD')}</span>
                      </div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mt-2">
                      Interest rates are variable and depend on pool utilization. 
                      You can withdraw your assets at any time.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Benefits */}
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <h4 className="text-green-400 font-medium text-sm mb-3">Benefits of Supplying</h4>
              <div className="space-y-2 text-sm text-gray-300">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>Earn passive income through interest</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>Withdraw your assets anytime</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>Pool tokens can be used as collateral</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>Contribute to protocol liquidity</span>
                </div>
              </div>
            </div>
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
              disabled={loading || supplyAmount === 0 || !selectedAssetData || supplyAmount > selectedAssetData.balance}
              className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-gray-900 dark:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? 'Supplying...' : (
                <>
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Supply {selectedAsset}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}