'use client';

import { useState } from 'react';
import { 
  AlertTriangle, 
  Bell, 
  Mail, 
  MessageSquare,
  Shield,
  X,
  Check
} from 'lucide-react';

interface Alert {
  id: string;
  vaultId: string;
  assetType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  currentLTV: number;
  threshold: number;
  message: string;
  timestamp: Date;
  read: boolean;
}

const mockAlerts: Alert[] = [
  {
    id: 'alert-1',
    vaultId: 'vault-1',
    assetType: 'SUI',
    severity: 'low',
    currentLTV: 35,
    threshold: 35,
    message: 'Your SUI vault has reached 35% LTV. Consider adding collateral or repaying loans.',
    timestamp: new Date(Date.now() - 3600000),
    read: false,
  },
  {
    id: 'alert-2',
    vaultId: 'vault-2',
    assetType: 'USDC',
    severity: 'medium',
    currentLTV: 45,
    threshold: 45,
    message: 'Your USDC vault has reached 45% LTV. Action recommended to avoid liquidation risk.',
    timestamp: new Date(Date.now() - 7200000),
    read: true,
  },
];

export function LiquidationAlertSystem() {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [notificationSettings, setNotificationSettings] = useState({
    email: true,
    sms: false,
    push: true,
    threshold35: true,
    threshold45: true,
    threshold55: true,
  });

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/50', icon: AlertTriangle };
      case 'high':
        return { color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/50', icon: AlertTriangle };
      case 'medium':
        return { color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', icon: AlertTriangle };
      default:
        return { color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/50', icon: Shield };
    }
  };

  const markAsRead = (alertId: string) => {
    setAlerts(alerts.map(alert => 
      alert.id === alertId ? { ...alert, read: true } : alert
    ));
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(alerts.filter(alert => alert.id !== alertId));
  };

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <div className="space-y-6">
      {/* Alert Summary */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Bell className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Liquidation Alerts</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          {unreadCount > 0 && (
            <button
              onClick={() => setAlerts(alerts.map(a => ({ ...a, read: true })))}
              className="px-4 py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Alert Thresholds Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">35% LTV</span>
            </div>
            <p className="text-xs text-gray-300">First warning - Monitor position</p>
          </div>
          
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">45% LTV</span>
            </div>
            <p className="text-xs text-gray-300">Moderate risk - Action recommended</p>
          </div>
          
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-red-400">55% LTV</span>
            </div>
            <p className="text-xs text-gray-300">High risk - Urgent action needed</p>
          </div>
        </div>

        {/* Active Alerts */}
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">No active alerts</p>
              <p className="text-sm text-gray-500 mt-1">All your vaults are healthy</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const config = getSeverityConfig(alert.severity);
              const Icon = config.icon;
              
              return (
                <div
                  key={alert.id}
                  className={`p-4 border rounded-xl ${config.border} ${config.bg} ${
                    !alert.read ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-blue-500/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className={`p-2 ${config.bg} rounded-lg mt-1`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className={`font-medium ${config.color}`}>
                            {alert.assetType} Vault - {alert.currentLTV}% LTV
                          </h4>
                          {!alert.read && (
                            <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                              New
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 mb-2">{alert.message}</p>
                        <p className="text-xs text-gray-500">
                          {alert.timestamp.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      {!alert.read && (
                        <button
                          onClick={() => markAsRead(alert.id)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        title="Dismiss"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Notification Settings</h3>
        
        <div className="space-y-6">
          {/* Notification Channels */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-4">Notification Channels</h4>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl cursor-pointer hover:bg-gray-800 transition-colors">
                <div className="flex items-center space-x-3">
                  <Mail className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <div>
                    <p className="text-gray-900 dark:text-white font-medium">Email Notifications</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Receive alerts via email</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.email}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, email: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl cursor-pointer hover:bg-gray-800 transition-colors">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <div>
                    <p className="text-gray-900 dark:text-white font-medium">SMS Notifications</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Receive alerts via text message</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.sms}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, sms: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl cursor-pointer hover:bg-gray-800 transition-colors">
                <div className="flex items-center space-x-3">
                  <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <div>
                    <p className="text-gray-900 dark:text-white font-medium">Push Notifications</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Receive browser push notifications</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.push}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, push: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>
          </div>

          {/* Alert Thresholds */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-4">Alert Thresholds</h4>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl cursor-pointer hover:bg-gray-800 transition-colors">
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">35% LTV Alert</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">First warning threshold</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.threshold35}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, threshold35: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl cursor-pointer hover:bg-gray-800 transition-colors">
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">45% LTV Alert</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Moderate risk threshold</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.threshold45}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, threshold45: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl cursor-pointer hover:bg-gray-800 transition-colors">
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">55% LTV Alert</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">High risk threshold</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.threshold55}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, threshold55: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>
          </div>

          <button className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
