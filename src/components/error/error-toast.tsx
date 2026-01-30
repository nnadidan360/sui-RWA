'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { ErrorInfo } from '@/lib/error/error-handler';

interface ToastItem {
  id: string;
  error: ErrorInfo;
  timestamp: number;
}

interface ErrorToastProps {
  errors: ErrorInfo[];
  onDismiss: (id: string) => void;
}

export function ErrorToast({ errors, onDismiss }: ErrorToastProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    // Add new errors as toasts
    errors.forEach(error => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const toast: ToastItem = {
        id,
        error,
        timestamp: Date.now(),
      };

      setToasts(prev => [...prev, toast]);

      // Auto-dismiss after delay based on severity
      const dismissDelay = getSeverityDismissDelay(error.severity);
      if (dismissDelay > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, dismissDelay);
      }
    });
  }, [errors]);

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    onDismiss(id);
  };

  const getSeverityDismissDelay = (severity: string): number => {
    switch (severity) {
      case 'low':
        return 3000; // 3 seconds
      case 'medium':
        return 5000; // 5 seconds
      case 'high':
        return 8000; // 8 seconds
      case 'critical':
        return 0; // Manual dismiss only
      default:
        return 5000;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'low':
        return <Info className="w-5 h-5 text-blue-400" />;
      case 'medium':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-400" />;
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      default:
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getSeverityColors = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
      case 'high':
        return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
      case 'critical':
        return 'bg-red-500/10 border-red-500/20 text-red-400';
      default:
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
    }
  };

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`p-4 rounded-xl border backdrop-blur-sm animate-in slide-in-from-right duration-300 ${getSeverityColors(toast.error.severity)}`}
        >
          <div className="flex items-start space-x-3">
            {getSeverityIcon(toast.error.severity)}
            
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {toast.error.code}
              </h4>
              <p className="text-sm text-gray-300 mt-1">
                {toast.error.userMessage}
              </p>
              
              {toast.error.suggestions && toast.error.suggestions.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Suggestions:</p>
                  <ul className="text-xs text-gray-300 space-y-1">
                    {toast.error.suggestions.slice(0, 2).map((suggestion, index) => (
                      <li key={index} className="flex items-start">
                        <span className="mr-1">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {toast.error.retryable && (
                <button
                  onClick={() => {
                    // Emit retry event
                    window.dispatchEvent(new CustomEvent('error-retry', {
                      detail: { errorCode: toast.error.code }
                    }));
                    dismissToast(toast.id);
                  }}
                  className="mt-3 px-3 py-1 bg-white/10 hover:bg-white/20 text-gray-900 dark:text-white text-xs rounded-lg transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
            
            <button
              onClick={() => dismissToast(toast.id)}
              className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Global error toast manager
let globalToastErrors: ErrorInfo[] = [];
const globalToastListeners: Set<(errors: ErrorInfo[]) => void> = new Set();

export function addGlobalError(error: ErrorInfo) {
  globalToastErrors = [error, ...globalToastErrors.slice(0, 4)]; // Keep last 5 errors
  globalToastListeners.forEach(listener => listener([error]));
}

export function useGlobalErrorToast() {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);

  useEffect(() => {
    const listener = (newErrors: ErrorInfo[]) => {
      setErrors(newErrors);
    };

    globalToastListeners.add(listener);

    return () => {
      globalToastListeners.delete(listener);
    };
  }, []);

  const dismissError = (id: string) => {
    setErrors([]);
  };

  return { errors, dismissError };
}

// Success toast for positive feedback
export function SuccessToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl backdrop-blur-sm animate-in slide-in-from-right duration-300">
        <div className="flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          
          <div className="flex-1 min-w-0">
            <p className="text-sm text-green-400 font-medium">Success</p>
            <p className="text-sm text-gray-300 mt-1">{message}</p>
          </div>
          
          <button
            onClick={onDismiss}
            className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}