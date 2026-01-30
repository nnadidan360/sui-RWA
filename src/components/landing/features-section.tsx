'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Zap, Shield, DollarSign, Clock, TrendingUp, Users } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Sub-second transaction finality on Sui blockchain vs 15+ seconds on traditional chains',
    color: 'from-yellow-400 to-orange-500'
  },
  {
    icon: Shield,
    title: 'Zero Credit Impact',
    description: 'Borrow without affecting your credit score - traditional lending damages your financial profile',
    color: 'from-green-400 to-emerald-500'
  },
  {
    icon: DollarSign,
    title: 'Transparent Pricing',
    description: 'Flat interest rates with no hidden fees. $5 activation vs $50-200 traditional origination fees',
    color: 'from-blue-400 to-cyan-500'
  },
  {
    icon: Clock,
    title: 'Instant Activation',
    description: 'Get approved and funded in minutes, not days. No paperwork, no waiting periods',
    color: 'from-purple-400 to-pink-500'
  },
  {
    icon: TrendingUp,
    title: 'Asset-Backed Security',
    description: 'Real-world assets provide stability vs volatile crypto-only protocols',
    color: 'from-indigo-400 to-blue-500'
  },
  {
    icon: Users,
    title: 'No Traditional Banking',
    description: 'Bypass traditional financial gatekeepers entirely with decentralized lending',
    color: 'from-red-400 to-pink-500'
  }
];

export function FeaturesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Why Choose Our Platform?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Experience the future of lending with Sui blockchain's revolutionary technology
            and our innovative approach to asset-backed loans.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="relative group"
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
            >
              <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 group-hover:border-gray-200">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  {feature.title}
                </h3>
                
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Comparison Chart */}
        <motion.div
          className="mt-20 bg-gradient-to-r from-slate-50 to-blue-50 rounded-3xl p-8 md:p-12"
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Traditional Lending vs Our Platform
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-red-500 font-semibold mb-2">Traditional Banks</div>
              <div className="space-y-3 text-gray-600">
                <div>15+ second confirmations</div>
                <div>Credit score required</div>
                <div>$50-200 origination fees</div>
                <div>Days to weeks approval</div>
                <div>Variable interest rates</div>
              </div>
            </div>
            
            <div className="flex items-center justify-center">
              <div className="text-4xl font-bold text-blue-600">VS</div>
            </div>
            
            <div className="text-center">
              <div className="text-green-500 font-semibold mb-2">Our Platform</div>
              <div className="space-y-3 text-gray-600">
                <div>Sub-second finality</div>
                <div>No credit checks</div>
                <div>$5 activation fee</div>
                <div>Instant approval</div>
                <div>Transparent flat rates</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}