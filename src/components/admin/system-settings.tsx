'use client';

/**
 * System Settings Component for Admin Dashboard
 * Manages platform configuration and administrative settings
 * Requirements: 6.1, 6.4, 6.5
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Shield, 
  Database, 
  Bell, 
  Key,
  Globe,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Lock,
  Unlock
} from 'lucide-react';

interface SystemSettings {
  riskParameters: {
    collateralRatio: number;
    liquidationThreshold: number;
    baseInterestRate: number;
    maxLoanAmount: number;
  };
  securitySettings: {
    sessionTimeout: number;
    maxLoginAttempts: number;
    twoFactorRequired: boolean;
    ipWhitelisting: boolean;
  };
  notificationSettings: {
    emailAlerts: boolean;
    smsAlerts: boolean;
    pushNotifications: boolean;
    alertThresholds: {
      highRiskLoan: number;
      suspiciousActivity: number;
      systemHealth: number;
    };
  };
  systemConfiguration: {
    maintenanceMode: boolean;
    emergencyPause: boolean;
    debugMode: boolean;
    apiRateLimit: number;
  };
}

export function SystemSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'risk' | 'security' | 'notifications' | 'system'>('risk');
  const [hasChanges, setHasChanges] = useState(false);

  // Mock settings data
  const mockSettings: SystemSettings = {
    riskParameters: {
      collateralRatio: 150,
      liquidationThreshold: 120,
      baseInterestRate: 5.5,
      maxLoanAmount: 1000000
    },
    securitySettings: {
      sessionTimeout: 30,
      maxLoginAttempts: 5,
      twoFactorRequired: true,
      ipWhitelisting: false
    },
    notificationSettings: {
      emailAlerts: true,
      smsAlerts: false,
      pushNotifications: true,
      alertThresholds: {
        highRiskLoan: 80,
        suspiciousActivity: 3,
        systemHealth: 95
      }
    },
    systemConfiguration: {
      maintenanceMode: false,
      emergencyPause: false,
      debugMode: false,
      apiRateLimit: 1000
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      // In a real implementation, this would fetch from the settings API
      // const response = await fetch('/api/admin/settings');
      // const data = await response.json();
      
      // For now, use mock data
      setTimeout(() => {
        setSettings(mockSettings);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    try {
      setSaving(true);
      // In a real implementation, this would save to the settings API
      // const response = await fetch('/api/admin/settings', {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(settings)
      // });
      
      // Mock save delay
      setTimeout(() => {
        setSaving(false);
        setHasChanges(false);
        // Show success message
      }, 1500);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaving(false);
    }
  };

  const updateSetting = (section: keyof SystemSettings, key: string, value: any) => {
    if (!settings) return;
    
    setSettings(prev => ({
      ...prev!,
      [section]: {
        ...prev![section],
        [key]: value
      }
    }));
    setHasChanges(true);
  };

  const updateNestedSetting = (section: keyof SystemSettings, parentKey: string, key: string, value: any) => {
    if (!settings) return;
    
    setSettings(prev => ({
      ...prev!,
      [section]: {
        ...prev![section],
        [parentKey]: {
          ...(prev![section] as any)[parentKey],
          [key]: value
        }
      }
    }));
    setHasChanges(true);
  };

  const toggleEmergencyPause = () => {
    if (!settings) return;
    
    const newValue = !settings.systemConfiguration.emergencyPause;
    updateSetting('systemConfiguration', 'emergencyPause', newValue);
    
    // In a real implementation, this would immediately trigger emergency protocols
    console.log(`Emergency pause ${newValue ? 'activated' : 'deactivated'}`);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (loading && !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Failed to load system settings</p>
        <button 
          onClick={fetchSettings}
          className="mt-4 px-4 py-2 bg-blue-600 text-gray-900 dark:text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2 inline" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">System Settings</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Configure platform parameters and security settings</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {hasChanges && (
            <span className="text-yellow-400 text-sm flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Unsaved changes
            </span>
          )}
          
          <button 
            onClick={saveSettings}
            disabled={!hasChanges || saving}
            className="flex items-center px-4 py-2 bg-green-600 text-gray-900 dark:text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Emergency Controls */}
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          Emergency Controls
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800/30 rounded-lg">
            <div>
              <p className="text-gray-900 dark:text-white font-medium">Emergency Pause</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Immediately halt all platform operations</p>
            </div>
            <button
              onClick={toggleEmergencyPause}
              className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                settings.systemConfiguration.emergencyPause
                  ? 'bg-red-600 text-gray-900 dark:text-white hover:bg-red-700'
                  : 'bg-gray-600 text-gray-900 dark:text-white hover:bg-gray-700'
              }`}
            >
              {settings.systemConfiguration.emergencyPause ? (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  PAUSED
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4 mr-2" />
                  ACTIVE
                </>
              )}
            </button>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800/30 rounded-lg">
            <div>
              <p className="text-gray-900 dark:text-white font-medium">Maintenance Mode</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Enable maintenance mode for updates</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.systemConfiguration.maintenanceMode}
                onChange={(e) => updateSetting('systemConfiguration', 'maintenanceMode', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Settings Navigation */}
      <div className="border-b border-gray-800">
        <nav className="flex space-x-8">
          {[
            { id: 'risk', label: 'Risk Parameters', icon: Shield },
            { id: 'security', label: 'Security', icon: Key },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'system', label: 'System', icon: Database },
          ].map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as any)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeSection === section.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:border-gray-600'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {section.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl p-6">
        {/* Risk Parameters */}
        {activeSection === 'risk' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Risk Parameters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Collateral Ratio (%)
                </label>
                <input
                  type="number"
                  value={settings.riskParameters.collateralRatio}
                  onChange={(e) => updateSetting('riskParameters', 'collateralRatio', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Minimum collateral required for loans</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Liquidation Threshold (%)
                </label>
                <input
                  type="number"
                  value={settings.riskParameters.liquidationThreshold}
                  onChange={(e) => updateSetting('riskParameters', 'liquidationThreshold', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Threshold for automatic liquidation</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Base Interest Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.riskParameters.baseInterestRate}
                  onChange={(e) => updateSetting('riskParameters', 'baseInterestRate', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Base annual interest rate for loans</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Loan Amount ($)
                </label>
                <input
                  type="number"
                  value={settings.riskParameters.maxLoanAmount}
                  onChange={(e) => updateSetting('riskParameters', 'maxLoanAmount', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Maximum loan amount per user</p>
              </div>
            </div>
          </div>
        )}

        {/* Security Settings */}
        {activeSection === 'security' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Security Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Session Timeout (minutes)
                </label>
                <input
                  type="number"
                  value={settings.securitySettings.sessionTimeout}
                  onChange={(e) => updateSetting('securitySettings', 'sessionTimeout', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Login Attempts
                </label>
                <input
                  type="number"
                  value={settings.securitySettings.maxLoginAttempts}
                  onChange={(e) => updateSetting('securitySettings', 'maxLoginAttempts', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800/30 rounded-lg">
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">Two-Factor Authentication Required</p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Require 2FA for all admin accounts</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.securitySettings.twoFactorRequired}
                    onChange={(e) => updateSetting('securitySettings', 'twoFactorRequired', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800/30 rounded-lg">
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">IP Whitelisting</p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Restrict admin access to specific IP addresses</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.securitySettings.ipWhitelisting}
                    onChange={(e) => updateSetting('securitySettings', 'ipWhitelisting', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Notification Settings */}
        {activeSection === 'notifications' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notification Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800/30 rounded-lg">
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">Email Alerts</p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Send critical alerts via email</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notificationSettings.emailAlerts}
                    onChange={(e) => updateSetting('notificationSettings', 'emailAlerts', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800/30 rounded-lg">
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">SMS Alerts</p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Send urgent alerts via SMS</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notificationSettings.smsAlerts}
                    onChange={(e) => updateSetting('notificationSettings', 'smsAlerts', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900 dark:text-white">Alert Thresholds</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    High Risk Loan (%)
                  </label>
                  <input
                    type="number"
                    value={settings.notificationSettings.alertThresholds.highRiskLoan}
                    onChange={(e) => updateNestedSetting('notificationSettings', 'alertThresholds', 'highRiskLoan', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Suspicious Activity Count
                  </label>
                  <input
                    type="number"
                    value={settings.notificationSettings.alertThresholds.suspiciousActivity}
                    onChange={(e) => updateNestedSetting('notificationSettings', 'alertThresholds', 'suspiciousActivity', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    System Health (%)
                  </label>
                  <input
                    type="number"
                    value={settings.notificationSettings.alertThresholds.systemHealth}
                    onChange={(e) => updateNestedSetting('notificationSettings', 'alertThresholds', 'systemHealth', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* System Configuration */}
        {activeSection === 'system' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">System Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  API Rate Limit (requests/hour)
                </label>
                <input
                  type="number"
                  value={settings.systemConfiguration.apiRateLimit}
                  onChange={(e) => updateSetting('systemConfiguration', 'apiRateLimit', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Maximum API requests per user per hour</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800/30 rounded-lg">
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">Debug Mode</p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Enable detailed logging and debugging</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.systemConfiguration.debugMode}
                    onChange={(e) => updateSetting('systemConfiguration', 'debugMode', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}