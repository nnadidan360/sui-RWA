'use client';

import { useState, useEffect } from 'react';
import { Smartphone, Monitor, Tablet, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';

export interface RegisteredDevice {
  deviceId: string;
  deviceName: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  browserFingerprint: string;
  lastUsed: Date;
  location?: {
    country: string;
    city: string;
  };
  isCurrent: boolean;
  trustLevel: 'low' | 'medium' | 'high';
}

export interface DeviceRegistrationProps {
  onDeviceRegistered?: (device: RegisteredDevice) => void;
  onDeviceRemoved?: (deviceId: string) => void;
}

export function DeviceRegistration({ onDeviceRegistered, onDeviceRemoved }: DeviceRegistrationProps) {
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/devices');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load devices');
      }

      setDevices(data.devices);
    } catch (err: any) {
      setError(err.message || 'Failed to load devices');
    } finally {
      setIsLoading(false);
    }
  };

  const registerCurrentDevice = async () => {
    setIsRegistering(true);
    setError(null);

    try {
      // Collect device fingerprint components
      const fingerprint = await collectDeviceFingerprint();

      const response = await fetch('/api/auth/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register device');
      }

      setDevices([...devices, data.device]);
      onDeviceRegistered?.(data.device);
    } catch (err: any) {
      setError(err.message || 'Failed to register device');
    } finally {
      setIsRegistering(false);
    }
  };

  const removeDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to remove this device?')) {
      return;
    }

    try {
      const response = await fetch(`/api/auth/devices/${deviceId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove device');
      }

      setDevices(devices.filter(d => d.deviceId !== deviceId));
      onDeviceRemoved?.(deviceId);
    } catch (err: any) {
      setError(err.message || 'Failed to remove device');
    }
  };

  const collectDeviceFingerprint = async () => {
    // Collect browser and device information
    const fingerprint = {
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: (navigator as any).doNotTrack,
        plugins: Array.from(navigator.plugins || []).map((p: any) => p.name),
        mimeTypes: Array.from(navigator.mimeTypes || []).map((m: any) => m.type)
      },
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio,
        orientation: screen.orientation?.type
      },
      hardware: {
        cores: navigator.hardwareConcurrency || 0,
        memory: (navigator as any).deviceMemory,
        touchSupport: 'ontouchstart' in window,
        maxTouchPoints: navigator.maxTouchPoints
      },
      network: {
        connection: (navigator as any).connection?.effectiveType,
        downlink: (navigator as any).connection?.downlink,
        effectiveType: (navigator as any).connection?.effectiveType
      },
      timezone: {
        offset: new Date().getTimezoneOffset(),
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    return fingerprint;
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-6 h-6" />;
      case 'tablet':
        return <Tablet className="w-6 h-6" />;
      default:
        return <Monitor className="w-6 h-6" />;
    }
  };

  const getTrustLevelColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Registered Devices
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage devices that can access your account
          </p>
        </div>
        <button
          onClick={registerCurrentDevice}
          disabled={isRegistering}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {isRegistering ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Registering...
            </>
          ) : (
            'Register This Device'
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {devices.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Smartphone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              No devices registered yet
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Register your current device to get started
            </p>
          </div>
        ) : (
          devices.map((device) => (
            <div
              key={device.deviceId}
              className={`p-6 rounded-lg border-2 transition-all ${
                device.isCurrent
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-lg ${
                    device.isCurrent
                      ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {getDeviceIcon(device.deviceType)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {device.deviceName}
                      </h3>
                      {device.isCurrent && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {device.deviceType.charAt(0).toUpperCase() + device.deviceType.slice(1)} Device
                    </p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        Last used: {new Date(device.lastUsed).toLocaleDateString()}
                      </span>
                      {device.location && (
                        <span className="text-gray-500 dark:text-gray-400">
                          {device.location.city}, {device.location.country}
                        </span>
                      )}
                    </div>
                    <div className="mt-3">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getTrustLevelColor(device.trustLevel)}`}>
                        {device.trustLevel === 'high' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {device.trustLevel === 'medium' && <AlertCircle className="w-3 h-3 mr-1" />}
                        {device.trustLevel === 'low' && <AlertCircle className="w-3 h-3 mr-1" />}
                        {device.trustLevel.charAt(0).toUpperCase() + device.trustLevel.slice(1)} Trust
                      </span>
                    </div>
                  </div>
                </div>
                {!device.isCurrent && (
                  <button
                    onClick={() => removeDevice(device.deviceId)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Remove device"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-800 dark:text-yellow-200">
            <p className="font-medium mb-1">Device Security</p>
            <p>
              Your devices are protected by fingerprinting and fraud detection. 
              Remove any devices you no longer use or don't recognize.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
