'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { ArrowRight, Shield, Zap, DollarSign } from 'lucide-react';

export function CTASection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-20 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Ready to Unlock Your Assets?
          </h2>
          <p className="text-xl md:text-2xl text-blue-100 mb-12 max-w-3xl mx-auto">
            Join thousands of users who have already discovered the future of asset-backed lending.
            No credit checks, no waiting, just instant liquidity.
          </p>

          {/* Trust Indicators */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="flex items-center justify-center space-x-3 text-white">
              <Shield className="w-8 h-8 text-green-400" />
              <span className="text-lg font-semibold">Audited Smart Contracts</span>
            </div>
            <div className="flex items-center justify-center space-x-3 text-white">
              <Zap className="w-8 h-8 text-yellow-400" />
              <span className="text-lg font-semibold">Sui Blockchain Powered</span>
            </div>
            <div className="flex items-center justify-center space-x-3 text-white">
              <DollarSign className="w-8 h-8 text-blue-400" />
              <span className="text-lg font-semibold">$500K+ Loans Processed</span>
            </div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-6 justify-center items-center"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <button className="group px-8 py-4 bg-white text-blue-600 font-bold rounded-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2">
              <span>Get Started Now</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
            <button className="px-8 py-4 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-blue-600 transition-all duration-300">
              View Documentation
            </button>
          </motion.div>

          {/* Social Proof */}
          <motion.div
            className="mt-16 text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <p className="text-blue-200 mb-8">Trusted by leading organizations</p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
              {/* Placeholder for partner logos */}
              <div className="w-32 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-white font-semibold">Partner 1</span>
              </div>
              <div className="w-32 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-white font-semibold">Partner 2</span>
              </div>
              <div className="w-32 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-white font-semibold">Partner 3</span>
              </div>
              <div className="w-32 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-white font-semibold">Partner 4</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}