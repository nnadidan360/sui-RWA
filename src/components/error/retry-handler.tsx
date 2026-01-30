'use client';

import { useState, useCallback } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { getErrorHandler, RetryConfig } from '@/lib/error/error-handler';

interface RetryHandlerProps {
  operation: () => Promise<any>;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  retryConfig?: Partial<RetryConfig>;
  children: (props: {
    execute: () => Promise<void>;
    isLoading: boolean;
    error: Error | null;
    retryCount: number;
    canRetry: boolean;
  }) => React.ReactNode;
}

export function RetryHandler({
  operation,
  onSuccess,
  onError,
  retryConfig,
  children,
}: RetryHandlerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const errorHandler = getErrorHandler();
  const maxRetries = retryConfig?.maxAttempts || 3;

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await errorHandler.retryWithBackoff(operation, {
        maxAttempts: maxRetries,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2,
        ...retryConfig,
      });

      setRetryCount(0);
      onSuccess?.(result);
    } catch (err) {
      const error = err as Error;
      setError(error);
      setRetryCount(prev => prev + 1);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [operation, onSuccess, onError, retryConfig, maxRetries, errorHandler]);

  const canRetry = retryCount < maxRetries && error !== null;

  return (
    <>
      {children({
        execute,
        isLoading,
        error,
        retryCount,
        canRetry,
      })}
    </>
  );
}

// Pre-built retry button component
interface RetryButtonProps {
  onRetry: () => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function RetryButton({
  onRetry,
  isLoading = false,
  disabled = false,
  className = '',
  children,
}: RetryButtonProps) {
  return (
    <button
      onClick={onRetry}
      disabled={disabled || isLoading}
      className={`inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 dark:text-white font-medium rounded-xl transition-colors ${className}`}
    >
      <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
      {children || (isLoading ? 'Retrying...' : 'Retry')}
    </button>
  );
}

// Error state component with retry functionality
interface ErrorStateProps {
  error: Error;
  onRetry?: () => Promise<void>;
  canRetry?: boolean;
  isRetrying?: boolean;
  title?: string;
  description?: string;
}

export function ErrorState({
  error,
  onRetry,
  canRetry = true,
  isRetrying = false,
  title = 'Something went wrong',
  description,
}: ErrorStateProps) {
  const errorHandler = getErrorHandler();
  const errorInfo = errorHandler.handleError(error);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      
      <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md">
        {description || errorInfo.userMessage}
      </p>

      {errorInfo.suggestions && errorInfo.suggestions.length > 0 && (
        <div className="mb-6 text-left">
          <p className="text-sm text-gray-300 mb-2">Try these suggestions:</p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            {errorInfo.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start">
                <span className="mr-2">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onRetry && canRetry && errorInfo.retryable && (
        <RetryButton
          onRetry={onRetry}
          isLoading={isRetrying}
          className="mb-4"
        />
      )}

      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 text-left max-w-md">
          <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white text-sm">
            Error Details (Development)
          </summary>
          <div className="mt-2 p-3 bg-gray-800 rounded-lg text-xs font-mono text-gray-300 overflow-auto max-h-32">
            <div className="mb-2">
              <strong>Code:</strong> {errorInfo.code}
            </div>
            <div className="mb-2">
              <strong>Message:</strong> {error.message}
            </div>
            {error.stack && (
              <div>
                <strong>Stack:</strong>
                <pre className="whitespace-pre-wrap text-xs">{error.stack}</pre>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

// Hook for managing retry state
export function useRetry<T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const errorHandler = getErrorHandler();
  const maxRetries = config?.maxAttempts || 3;

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await errorHandler.retryWithBackoff(operation, {
        maxAttempts: maxRetries,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2,
        ...config,
      });

      setData(result);
      setRetryCount(0);
      return result;
    } catch (err) {
      const error = err as Error;
      setError(error);
      setRetryCount(prev => prev + 1);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [operation, config, maxRetries, errorHandler]);

  const retry = useCallback(() => {
    return execute();
  }, [execute]);

  const reset = useCallback(() => {
    setError(null);
    setData(null);
    setRetryCount(0);
  }, []);

  const canRetry = retryCount < maxRetries && error !== null;

  return {
    execute,
    retry,
    reset,
    isLoading,
    error,
    data,
    retryCount,
    canRetry,
  };
}