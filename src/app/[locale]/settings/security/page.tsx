'use client';

import { useState } from 'react';
import { DeviceRegistration, SessionManagement } from '@/components/auth';
import { Shield, Smartphone, Clock } from 'lucide-react';

export default function SecuritySettingsPage() {
  const [activeTab, setActiveTab] = useState<'devices' | 'sessions'>('devices');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Security Settings
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your devices and active sessions
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('devices')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'devices'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-5 h-5" />
                  <span>Devices</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('sessions')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'sessions'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span>Active Sessions</span>
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          {activeTab === 'devices' && (
            <DeviceRegistration
              onDeviceRegistered={(device) => {
                console.log('Device registered:', device);
              }}
              onDeviceRemoved={(deviceId) => {
                console.log('Device removed:', deviceId);
              }}
            />
          )}
          {activeTab === 'sessions' && (
            <SessionManagement
              onSessionRevoked={(sessionId) => {
                console.log('Session revoked:', sessionId);
              }}
            />
          )}
        </div>

        {/* Security Info */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
            Account Abstraction Security
          </h3>
          <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <p>
              Your account is secured by Sui blockchain's account abstraction technology. 
              This means:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>No private keys to manage or lose</li>
              <li>Device-based authentication with fingerprinting</li>
              <li>Multi-layered fraud detection and prevention</li>
              <li>Flexible recovery options without seed phrases</li>
              <li>Gas-free transactions with sponsored fees</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
