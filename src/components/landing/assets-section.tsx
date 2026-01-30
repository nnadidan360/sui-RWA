'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Home, Car, TrendingUp, Coins, Gem, FileText } from 'lucide-react';

const assetTypes = [
  {
    icon: Coins,
    title: 'Cryptocurrency',
    description: 'SUI, USDC, USDT, and other major tokens',
    examples: ['SUI Token', 'Stablecoins', 'Blue-chip Crypto'],
    color: 'from-blue-500 to-purple-600'
  },
  {
    icon: Home,
    title: 'Real Estate',
    description: 'Residential properties and REITs',
    examples: ['Houses', 'Condos', 'REITs'],
    color: 'from-green-500 to-emerald-600'
  },
  {
    icon: Car,
    title: 'Vehicles',
    description: 'Cars, motorcycles, boats, and more',
    examples: ['Cars', 'Motorcycles', 'Boats'],
    color: 'from-orange-500 to-red-600'
  },
  {
    icon: TrendingUp,
    title: 'Stocks & Securities',
    description: 'Public company shares and ETFs',
    examples: ['Blue-chip Stocks', 'ETFs', 'Index Funds'],
    color: 'from-purple-500 to-pink-600'
  },
  {
    icon: Gem,
    title: 'Commodities',
    description: 'Precious metals and energy futures',
    examples: ['Gold', 'Silver', 'Oil Futures'],
    color: 'from-yellow-500 to-orange-600'
  },
  {
    icon: FileText,
    title: 'Bonds',
    description: 'Government and corporate bonds',
    examples: ['Treasury Bonds', 'Corporate Bonds', 'Municipal Bonds'],
    color: 'from-indigo-500 to-blue-600'
  }
];

export function AssetsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-20 bg-gradient-to-br from-slate-900 to-blue-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Collateralize Any Asset
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            From cryptocurrency to real estate, unlock liquidity from your diverse asset portfolio
            without selling your investments.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {assetTypes.map((asset, index) => (
            <motion.div
              key={index}
              className="group"
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 50, scale: 0.9 }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
            >
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 hover:bg-white/20 transition-all duration-300 border border-white/20 group-hover:border-white/40 group-hover:scale-105">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${asset.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <asset.icon className="w-8 h-8 text-white" />
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-4">
                  {asset.title}
                </h3>
                
                <p className="text-gray-300 mb-6 leading-relaxed">
                  {asset.description}
                </p>

                <div className="space-y-2">
                  {asset.examples.map((example, exampleIndex) => (
                    <div
                      key={exampleIndex}
                      className="flex items-center text-sm text-gray-400"
                    >
                      <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full mr-3"></div>
                      {example}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Process Flow */}
        <motion.div
          className="mt-20"
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <h3 className="text-3xl font-bold text-center text-white mb-12">
            How It Works
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Connect Assets', description: 'Link your crypto wallet or upload asset documentation' },
              { step: '2', title: 'Get Valuation', description: 'Our system provides instant asset valuation and loan terms' },
              { step: '3', title: 'Secure Loan', description: 'Smart contracts automatically secure your collateral' },
              { step: '4', title: 'Receive Funds', description: 'Get instant liquidity while keeping your assets' }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
                  {item.step}
                </div>
                <h4 className="text-xl font-semibold text-white mb-2">{item.title}</h4>
                <p className="text-gray-300 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}