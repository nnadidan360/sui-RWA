'use client';

import { useEffect, useState } from 'react';
import { Bell, X, Check, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { 
  getPushNotificationService, 
  NotificationConfig,
  NotificationTypes,
  createNotificationConfig 
} from '@/lib/notifications/push-service';
import { useRealtime } from '@/hooks/use-realtime';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  severity: 'info' | 'warning' | 'error' | 'success';
  actions?: Array<{
    label: string;
    action: string;
    primary?: boolean;
  }>;
}

export function NotificationManager() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  
  const { subscribe } = useRealtime({ autoConnect: true });
  const pushService = getPushNotificationService();

  useEffect(() => {
    // Initialize push notifications
    initializePushNotifications();

    // Subscribe to real-time events
    const unsubscribeTransaction = subscribe('transaction_update', handleTransactionUpdate);
    const unsubscribeStaking = subscribe('staking_update', handleStakingUpdate);
    const unsubscribeLending = subscribe('lending_update', handleLendingUpdate);
    const unsubscribeSecurity = subscribe('security_alert', handleSecurityAlert);

    return () => {
      unsubscribeTransaction();
      unsubscribeStaking();
      unsubscribeLending();
      unsubscribeSecurity();
    };
  }, [subscribe]);

  const initializePushNotifications = async () => {
    const initialized = await pushService.initialize();
    if (initialized) {
      const currentPermission = pushService.getPermissionStatus();
      setPermission(currentPermission);
      setPushEnabled(currentPermission === 'granted' && pushService.isSubscribed());
    }
  };

  const handleTransactionUpdate = (event: any) => {
    const { data } = event;
    
    let severity: 'info' | 'warning' | 'error' | 'success' = 'info';
    let title = 'Transaction Update';
    let message = 'Your transaction has been updated';

    switch (data.status) {
      case 'confirmed':
        severity = 'success';
        title = 'Transaction Confirmed';
        message = `Transaction ${data.hash?.slice(0, 10)}... has been confirmed`;
        break;
      case 'failed':
        severity = 'error';
        title = 'Transaction Failed';
        message = `Transaction ${data.hash?.slice(0, 10)}... has failed`;
        break;
      case 'pending':
        severity = 'info';
        title = 'Transaction Pending';
        message = `Transaction ${data.hash?.slice(0, 10)}... is pending confirmation`;
        break;
    }

    addNotification({
      id: `tx_${data.id || Date.now()}`,
      type: 'transaction',
      title,
      message,
      timestamp: new Date(),
      read: false,
      severity,
      actions: [
        { label: 'View Details', action: 'view_transaction', primary: true },
      ],
    });

    // Show push notification for important updates
    if (pushEnabled && (data.status === 'confirmed' || data.status === 'failed')) {
      const notificationConfig = createNotificationConfig(
        data.status === 'confirmed' ? NotificationTypes.TRANSACTION_CONFIRMED : NotificationTypes.TRANSACTION_FAILED,
        data
      );
      pushService.showNotification(notificationConfig);
    }
  };

  const handleStakingUpdate = (event: any) => {
    const { data } = event;
    
    let severity: 'info' | 'warning' | 'error' | 'success' = 'info';
    let title = 'Staking Update';
    let message = 'Your staking position has been updated';

    switch (data.type) {
      case 'rewards_available':
        severity = 'success';
        title = 'Staking Rewards Available';
        message = `You have ${data.amount} CSPR in rewards to claim`;
        break;
      case 'unbonding_complete':
        severity = 'success';
        title = 'Unbonding Complete';
        message = `Your ${data.amount} CSPR tokens are now available`;
        break;
      case 'delegation_created':
        severity = 'info';
        title = 'Delegation Created';
        message = `Successfully delegated ${data.amount} CSPR to validator`;
        break;
    }

    addNotification({
      id: `staking_${data.id || Date.now()}`,
      type: 'staking',
      title,
      message,
      timestamp: new Date(),
      read: false,
      severity,
      actions: [
        { label: 'View Staking', action: 'view_staking', primary: true },
      ],
    });

    // Show push notification for rewards and unbonding
    if (pushEnabled && (data.type === 'rewards_available' || data.type === 'unbonding_complete')) {
      const notificationConfig = createNotificationConfig(
        data.type === 'rewards_available' ? NotificationTypes.STAKING_REWARDS : NotificationTypes.UNBONDING_COMPLETE,
        data
      );
      pushService.showNotification(notificationConfig);
    }
  };

  const handleLendingUpdate = (event: any) => {
    const { data } = event;
    
    let severity: 'info' | 'warning' | 'error' | 'success' = 'info';
    let title = 'Lending Update';
    let message = 'Your lending position has been updated';

    switch (data.type) {
      case 'liquidation_warning':
        severity = 'error';
        title = 'Liquidation Warning';
        message = `Your loan is at risk! Health factor: ${data.healthFactor}`;
        break;
      case 'loan_liquidated':
        severity = 'error';
        title = 'Loan Liquidated';
        message = 'Your loan has been liquidated due to insufficient collateral';
        break;
      case 'loan_created':
        severity = 'success';
        title = 'Loan Created';
        message = `Successfully borrowed ${data.amount} against your collateral`;
        break;
    }

    addNotification({
      id: `lending_${data.id || Date.now()}`,
      type: 'lending',
      title,
      message,
      timestamp: new Date(),
      read: false,
      severity,
      actions: [
        { label: 'View Lending', action: 'view_lending', primary: true },
      ],
    });

    // Show push notification for critical lending events
    if (pushEnabled && (data.type === 'liquidation_warning' || data.type === 'loan_liquidated')) {
      const notificationConfig = createNotificationConfig(
        data.type === 'liquidation_warning' ? NotificationTypes.LOAN_LIQUIDATION_WARNING : NotificationTypes.LOAN_LIQUIDATED,
        data
      );
      pushService.showNotification(notificationConfig);
    }
  };

  const handleSecurityAlert = (event: any) => {
    const { data } = event;
    
    addNotification({
      id: `security_${data.alertId || Date.now()}`,
      type: 'security',
      title: 'Security Alert',
      message: data.message || 'A security event has been detected',
      timestamp: new Date(),
      read: false,
      severity: 'error',
      actions: [
        { label: 'View Details', action: 'view_security', primary: true },
      ],
    });

    // Always show push notification for security alerts
    if (pushEnabled) {
      const notificationConfig = createNotificationConfig(NotificationTypes.SECURITY_ALERT, data);
      pushService.showNotification(notificationConfig);
    }
  };

  const addNotification = (notification: NotificationItem) => {
    setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50 notifications
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const enablePushNotifications = async () => {
    const permission = await pushService.requestPermission();
    setPermission(permission);
    
    if (permission === 'granted') {
      const subscription = await pushService.subscribe(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '');
      setPushEnabled(subscription !== null);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success':
        return 'border-l-green-500';
      case 'warning':
        return 'border-l-yellow-500';
      case 'error':
        return 'border-l-red-500';
      default:
        return 'border-l-blue-500';
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-xs text-gray-900 dark:text-white font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </div>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-96 bg-gray-900 border border-gray-800 rounded-xl shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h3>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Push Notification Settings */}
          {!pushEnabled && permission !== 'denied' && (
            <div className="p-4 border-b border-gray-800 bg-blue-500/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-900 dark:text-white font-medium">Enable Push Notifications</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Get notified of important events</p>
                </div>
                <button
                  onClick={enablePushNotifications}
                  className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-gray-900 dark:text-white text-sm rounded-lg transition-colors"
                >
                  Enable
                </button>
              </div>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-600 dark:text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-800 border-l-4 ${getSeverityColor(notification.severity)} ${
                    !notification.read ? 'bg-gray-100 dark:bg-gray-800/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getSeverityIcon(notification.severity)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">{notification.title}</h4>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{notification.message}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {notification.timestamp.toLocaleTimeString()}
                        </p>
                        
                        {/* Actions */}
                        {notification.actions && notification.actions.length > 0 && (
                          <div className="flex space-x-2 mt-3">
                            {notification.actions.map((action, index) => (
                              <button
                                key={index}
                                onClick={() => {
                                  // Handle action
                                  console.log('Action clicked:', action.action);
                                  markAsRead(notification.id);
                                }}
                                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                                  action.primary
                                    ? 'bg-blue-500 hover:bg-blue-600 text-gray-900 dark:text-white'
                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                }`}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => removeNotification(notification.id)}
                      className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white ml-2"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}