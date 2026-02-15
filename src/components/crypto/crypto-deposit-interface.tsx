'use client';

import { useState } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  Shield, 
  AlertCircle,
  ChevronDown,
  Info
} from 'lucide-react';

interface CryptoAsset {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  maxLTV: number;
  icon: string;
}

const supportedAssets: CryptoAsset[] = [
  { symbol: 'SUI', name: 'Sui Token', balance: 1000, usdValue: 1.5, maxLTV: 30, icon: '💎' },
  { symbol: 'USDC', name: 'USD Coin', balance: 5000, usdValue: 1.0, maxLTV: 30, icon: '💵' },
  { symbol: 'USDT', name: 'Tether', balance: 3000, usdValue: 1.0, maxLTV: 30, icon: '💰' },
];

export function CryptoDepositInterface() {
  const [selectedAsset, setSelectedAsset] = useState<CryptoAsset>(supportedAssets[0]);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [showAssetSelector, setShowAssetSelector] = useState(false);

  const calculateCreditAvailable = () => {
    const depositValue = depositAmount * selectedAsset.usdValue;
    return depositValue * (selectedAsset.maxLTV / 100);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleMaxClick = () => {
    setDepositAmount(selectedAsset.balance);
  };

  return (
    <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Deposit Crypto</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Lock crypto assets to access instant credit
          </p>
        </div>
        <div className="p-3 bg-blue-500/20 rounded-xl">
          <Wallet className="w-6 h-6 text-blue-400" />
        </div>
      </div>

      {/* Asset Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select Asset
        </label>
        <div className="relative">
          <button
            onClick={() => setShowAssetSelector(!showAssetSelector)}
            className="w-full flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{selectedAsset.icon}</span>
              <div className="text-left">
                <p className="text-gray-900 dark:text-white font-medium">{selectedAsset.symbol}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedAsset.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-gray-900 dark:text-white font-medium">
                  {selectedAsset.balance.toLocaleString()} {selectedAsset.symbol}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formatCurrency(selectedAsset.balance * selectedAsset.usdValue)}
                </p>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${showAssetSelector ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {showAssetSelector && (
            <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-lg overflow-hidden">
              {supportedAssets.map((asset) => (
                <button
                  key={asset.symbol}
                  onClick={() => {
                    setSelectedAsset(asset);
                    setShowAssetSelector(false);
                    setDepositAmount(0);
                  }}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{asset.icon}</span>
                    <div className="text-left">
                      <p className="text-gray-900 dark:text-white font-medium">{asset.symbol}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{asset.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-900 dark:text-white font-medium">
                      {asset.balance.toLocaleString()} {asset.symbol}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatCurrency(asset.balance * asset.usdValue)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deposit Amount */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Deposit Amount
        </label>
        <div className="relative">
          <input
            type="number"
            value={depositAmount || ''}
            onChange={(e) => setDepositAmount(Number(e.target.value))}
            placeholder="0.00"
            max={selectedAsset.balance}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
            <button
              onClick={handleMaxClick}
              className="px-2 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/20 rounded"
            >
              MAX
            </button>
            <span className="text-gray-600 dark:text-gray-400">{selectedAsset.symbol}</span>
          </div>
        </div>
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-2">
          <span>Available Balance</span>
          <span>{selectedAsset.balance.toLocaleString()} {selectedAsset.symbol}</span>
        </div>
      </div>

      {/* LTV Display */}
      {depositAmount > 0 && (
        <div className="mb-6 space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Deposit Value</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {formatCurrency(depositAmount * selectedAsset.usdValue)}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Max LTV</span>
              <span className="text-gray-900 dark:text-white font-medium">{selectedAsset.maxLTV}%</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-blue-500/20">
              <span className="text-sm font-medium text-blue-400">Credit Available</span>
              <span className="text-lg font-bold text-blue-400">
                {formatCurrency(calculateCreditAvailable())}
              </span>
            </div>
          </div>

          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-start space-x-3">
            <Shield className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-green-400 font-medium text-sm">Instant Credit Access</p>
              <p className="text-gray-300 text-sm mt-1">
                Your crypto is locked in a secure vault. Borrow up to {selectedAsset.maxLTV}% LTV with no loan count limits.
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
            <p>• Assets are locked in Sui smart contracts</p>
            <p>• Instant credit availability up to 30% LTV</p>
            <p>• Progressive alerts at 35%, 45%, 55% LTV</p>
            <p>• Automated liquidation at 60% LTV threshold</p>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        disabled={depositAmount === 0 || depositAmount > selectedAsset.balance}
        className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        <Wallet className="w-5 h-5 mr-2" />
        Deposit {selectedAsset.symbol}
      </button>
    </div>
  );
}
