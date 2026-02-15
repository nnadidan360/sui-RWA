'use client';

import { useState, useEffect } from 'react';
import { Clock, MapPin, Monitor, Smartphone, Tablet, Loader2, LogOut, AlertCircle } from 'lucide-react';

export interface ActiveSession {
  sessionId: string;
  deviceName: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  ipAddress: string;
  location?: {
    country: string;
    city: string;
  };
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

export interface SessionManagementProps {
  onSessionRevoked?: (sessionId: string) => void;
}

export function SessionManagement({ onSessionRevoked }: SessionManagementProps) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/sessions');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load sessions');
      }

      setSessions(data.sessions);
    } catch (err: any) {
      setError(err.message || 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to end this session?')) {
      return;
    }

    setRevokingSessionId(sessionId);
    setError(null);

    try {
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to revoke session');
      }

      setSessions(sessions.filter(s => s.sessionId !== sessionId));
      onSessionRevoked?.(sessionId);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke session');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const revokeAllOtherSessions = async () => {
    if (!confirm('Are you sure you want to end all other sessions? You will remain signed in on this device.')) {
      return;
    }

    setError(null);

    try {
      const response = await fetch('/api/auth/sessions/revoke-all', {
        method: 'POST'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to revoke sessions');
      }

      // Keep only current session
      setSessions(sessions.filter(s => s.isCurrent));
    } catch (err: any) {
      setError(err.message || 'Failed to revoke sessions');
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-5 h-5" />;
      case 'tablet':
        return <Tablet className="w-5 h-5" />;
      default:
        return <Monitor className="w-5 h-5" />;
    }
  };

  const getTimeRemaining = (expiresAt: Date) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    
    return `${minutes}m`;
  };

  const formatLastActivity = (lastActivity: Date) => {
    const now = new Date();
    const activity = new Date(lastActivity);
    const diff = now.getTime() - activity.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
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
            Active Sessions
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your active login sessions across devices
          </p>
        </div>
        {sessions.filter(s => !s.isCurrent).length > 0 && (
          <button
            onClick={revokeAllOtherSessions}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center"
          >
            <LogOut className="w-4 h-4 mr-2" />
            End All Other Sessions
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {sessions.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              No active sessions
            </p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.sessionId}
              className={`p-6 rounded-lg border-2 transition-all ${
                session.isCurrent
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className={`p-3 rounded-lg ${
                    session.isCurrent
                      ? 'bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {getDeviceIcon(session.deviceType)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {session.deviceName}
                      </h3>
                      {session.isCurrent && (
                        <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                          Current Session
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-2 mt-3">
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="w-4 h-4 mr-2" />
                        <span>Last active: {formatLastActivity(session.lastActivity)}</span>
                      </div>
                      
                      {session.location && (
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                          <MapPin className="w-4 h-4 mr-2" />
                          <span>{session.location.city}, {session.location.country}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-mono">{session.ipAddress}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center space-x-4">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Created: {new Date(session.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Expires in: {getTimeRemaining(session.expiresAt)}
                      </div>
                    </div>
                  </div>
                </div>
                
                {!session.isCurrent && (
                  <button
                    onClick={() => revokeSession(session.sessionId)}
                    disabled={revokingSessionId === session.sessionId}
                    className="ml-4 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {revokingSessionId === session.sessionId ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Ending...
                      </>
                    ) : (
                      <>
                        <LogOut className="w-4 h-4 mr-2" />
                        End Session
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Session Security</p>
            <p>
              Sessions are automatically extended with activity and expire after 24 hours of inactivity. 
              End any sessions you don't recognize immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
