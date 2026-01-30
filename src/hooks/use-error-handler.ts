'use client';

import { useState, useCallback, useEffect } from 'react';
import { getErrorHandler, ErrorInfo, ErrorContext } from '@/lib/error/error-handler';

export interface UseErrorHandlerReturn {
  error: ErrorInfo | null;
  isError: boolean;
  clearError: () => void;
  handleError: (error: Error | string, context?: Partial<ErrorContext>) => ErrorInfo;
  retryOperation: <T>(operation: () => Promise<T>) => Promise<T>;
}

export function useErrorHandler(): UseErrorHandlerReturn {
  const [error, setError] = useState<ErrorInfo | null>(null);
  const errorHandler = getErrorHandler();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((error: Error | string, context?: Partial<ErrorContext>): ErrorInfo => {
    const errorInfo = errorHandler.handleError(error, {
      timestamp: Date.now(),
      ...context,
    });
    
    setError(errorInfo);
    return errorInfo;
  }, [errorHandler]);

  const retryOperation = useCallback(async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      clearError();
      return await errorHandler.retryWithBackoff(operation);
    } catch (error) {
      handleError(error as Error);
      throw error;
    }
  }, [errorHandler, handleError, clearError]);

  // Listen for global errors
  useEffect(() => {
    const unsubscribe = errorHandler.onError((errorInfo) => {
      setError(errorInfo);
    });

    return unsubscribe;
  }, [errorHandler]);

  return {
    error,
    isError: error !== null,
    clearError,
    handleError,
    retryOperation,
  };
}

// Specialized error hooks for different components
export function useTransactionErrors() {
  const { error, isError, clearError, handleError } = useErrorHandler();

  const handleTransactionError = useCallback((error: Error | string) => {
    return handleError(error, {
      component: 'transaction',
    });
  }, [handleError]);

  return {
    error,
    isError,
    clearError,
    handleTransactionError,
  };
}

export function useValidationErrors() {
  const { error, isError, clearError, handleError } = useErrorHandler();

  const handleValidationError = useCallback((field: string, message: string) => {
    return handleError('INVALID_INPUT', {
      component: 'validation',
      action: field,
    });
  }, [handleError]);

  return {
    error,
    isError,
    clearError,
    handleValidationError,
  };
}

export function useNetworkErrors() {
  const { error, isError, clearError, handleError, retryOperation } = useErrorHandler();

  const handleNetworkError = useCallback((error: Error) => {
    return handleError(error, {
      component: 'network',
    });
  }, [handleError]);

  return {
    error,
    isError,
    clearError,
    handleNetworkError,
    retryOperation,
  };
}