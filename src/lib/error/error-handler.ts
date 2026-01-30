'use client';

export interface ErrorInfo {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'network' | 'validation' | 'authentication' | 'authorization' | 'system' | 'user';
  retryable: boolean;
  userMessage: string;
  technicalDetails?: string;
  suggestions?: string[];
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  category?: string;
  timestamp: number;
  userAgent?: string;
  url?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffFactor: number;
}

export class ErrorHandler {
  private errorCatalog = new Map<string, ErrorInfo>();
  private errorListeners = new Set<(error: ErrorInfo, context: ErrorContext) => void>();

  constructor() {
    this.initializeErrorCatalog();
  }

  private initializeErrorCatalog(): void {
    // Network errors
    this.registerError('NETWORK_TIMEOUT', {
      code: 'NETWORK_TIMEOUT',
      message: 'Request timed out',
      severity: 'medium',
      category: 'network',
      retryable: true,
      userMessage: 'The request took too long to complete. Please try again.',
      suggestions: ['Check your internet connection', 'Try again in a few moments'],
    });

    this.registerError('NETWORK_OFFLINE', {
      code: 'NETWORK_OFFLINE',
      message: 'No internet connection',
      severity: 'high',
      category: 'network',
      retryable: true,
      userMessage: 'You appear to be offline. Please check your internet connection.',
      suggestions: ['Check your internet connection', 'Try again when online'],
    });

    this.registerError('SERVER_ERROR', {
      code: 'SERVER_ERROR',
      message: 'Internal server error',
      severity: 'high',
      category: 'system',
      retryable: true,
      userMessage: 'Something went wrong on our end. Please try again.',
      suggestions: ['Try again in a few moments', 'Contact support if the problem persists'],
    });

    // Validation errors
    this.registerError('INVALID_INPUT', {
      code: 'INVALID_INPUT',
      message: 'Invalid input provided',
      severity: 'low',
      category: 'validation',
      retryable: false,
      userMessage: 'Please check your input and try again.',
      suggestions: ['Verify all required fields are filled', 'Check input format requirements'],
    });

    this.registerError('INSUFFICIENT_BALANCE', {
      code: 'INSUFFICIENT_BALANCE',
      message: 'Insufficient balance for transaction',
      severity: 'medium',
      category: 'validation',
      retryable: false,
      userMessage: 'You don\'t have enough balance to complete this transaction.',
      suggestions: ['Add more funds to your wallet', 'Reduce the transaction amount'],
    });

    // Authentication errors
    this.registerError('AUTH_REQUIRED', {
      code: 'AUTH_REQUIRED',
      message: 'Authentication required',
      severity: 'medium',
      category: 'authentication',
      retryable: false,
      userMessage: 'Please sign in to continue.',
      suggestions: ['Sign in to your account', 'Create an account if you don\'t have one'],
    });

    this.registerError('SESSION_EXPIRED', {
      code: 'SESSION_EXPIRED',
      message: 'Session has expired',
      severity: 'medium',
      category: 'authentication',
      retryable: false,
      userMessage: 'Your session has expired. Please sign in again.',
      suggestions: ['Sign in again', 'Enable "Remember me" for longer sessions'],
    });

    // Transaction errors
    this.registerError('TRANSACTION_FAILED', {
      code: 'TRANSACTION_FAILED',
      message: 'Transaction failed to execute',
      severity: 'high',
      category: 'system',
      retryable: true,
      userMessage: 'Your transaction failed to complete. Please try again.',
      suggestions: ['Check your wallet connection', 'Ensure sufficient gas fees', 'Try again with a higher gas limit'],
    });

    this.registerError('WALLET_NOT_CONNECTED', {
      code: 'WALLET_NOT_CONNECTED',
      message: 'Wallet not connected',
      severity: 'medium',
      category: 'authentication',
      retryable: false,
      userMessage: 'Please connect your wallet to continue.',
      suggestions: ['Connect your wallet', 'Install a compatible wallet extension'],
    });

    // Staking errors
    this.registerError('VALIDATOR_NOT_FOUND', {
      code: 'VALIDATOR_NOT_FOUND',
      message: 'Validator not found or inactive',
      severity: 'medium',
      category: 'validation',
      retryable: false,
      userMessage: 'The selected validator is not available.',
      suggestions: ['Choose a different validator', 'Check validator status'],
    });

    this.registerError('UNBONDING_PERIOD_ACTIVE', {
      code: 'UNBONDING_PERIOD_ACTIVE',
      message: 'Tokens are in unbonding period',
      severity: 'low',
      category: 'validation',
      retryable: false,
      userMessage: 'Your tokens are currently unbonding and cannot be withdrawn yet.',
      suggestions: ['Wait for the unbonding period to complete', 'Check your staking positions for completion date'],
    });

    // Lending errors
    this.registerError('COLLATERAL_INSUFFICIENT', {
      code: 'COLLATERAL_INSUFFICIENT',
      message: 'Insufficient collateral for loan',
      severity: 'medium',
      category: 'validation',
      retryable: false,
      userMessage: 'You need more collateral to secure this loan.',
      suggestions: ['Add more collateral', 'Reduce the loan amount', 'Use different collateral assets'],
    });

    this.registerError('LIQUIDATION_RISK', {
      code: 'LIQUIDATION_RISK',
      message: 'Position at risk of liquidation',
      severity: 'critical',
      category: 'system',
      retryable: false,
      userMessage: 'Your position is at risk of liquidation due to low health factor.',
      suggestions: ['Add more collateral immediately', 'Repay part of your loan', 'Monitor your health factor closely'],
    });
  }

  registerError(code: string, errorInfo: ErrorInfo): void {
    this.errorCatalog.set(code, errorInfo);
  }

  handleError(error: Error | string, context: ErrorContext = { timestamp: Date.now() }): ErrorInfo {
    let errorInfo: ErrorInfo;

    if (typeof error === 'string') {
      errorInfo = this.errorCatalog.get(error) || this.createGenericError(error);
    } else {
      errorInfo = this.mapErrorToInfo(error);
    }

    // Notify listeners
    this.notifyListeners(errorInfo, context);

    // Log error for debugging
    this.logError(errorInfo, context, error);

    return errorInfo;
  }

  private mapErrorToInfo(error: Error): ErrorInfo {
    // Try to match error message to known patterns
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('timed out')) {
      return this.errorCatalog.get('NETWORK_TIMEOUT')!;
    }

    if (message.includes('network') || message.includes('fetch')) {
      return this.errorCatalog.get('NETWORK_OFFLINE')!;
    }

    if (message.includes('unauthorized') || message.includes('401')) {
      return this.errorCatalog.get('AUTH_REQUIRED')!;
    }

    if (message.includes('forbidden') || message.includes('403')) {
      return {
        code: 'ACCESS_DENIED',
        message: 'Access denied',
        severity: 'medium',
        category: 'authorization',
        retryable: false,
        userMessage: 'You don\'t have permission to perform this action.',
        suggestions: ['Contact support for access', 'Check your account permissions'],
      };
    }

    if (message.includes('500') || message.includes('server error')) {
      return this.errorCatalog.get('SERVER_ERROR')!;
    }

    // Generic error for unknown cases
    return this.createGenericError(error.message);
  }

  private createGenericError(message: string): ErrorInfo {
    return {
      code: 'UNKNOWN_ERROR',
      message,
      severity: 'medium',
      category: 'system',
      retryable: true,
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalDetails: message,
      suggestions: ['Try again', 'Refresh the page', 'Contact support if the problem persists'],
    };
  }

  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    config: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
    }
  ): Promise<T> {
    let lastError: Error;
    let delay = config.baseDelay;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        const errorInfo = this.handleError(lastError, {
          timestamp: Date.now(),
          component: 'retry-handler',
          action: `attempt-${attempt}`,
        });

        if (!errorInfo.retryable || attempt === config.maxAttempts) {
          throw lastError;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Increase delay for next attempt
        delay = Math.min(delay * config.backoffFactor, config.maxDelay);
      }
    }

    throw lastError!;
  }

  onError(listener: (error: ErrorInfo, context: ErrorContext) => void): () => void {
    this.errorListeners.add(listener);
    
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  private notifyListeners(errorInfo: ErrorInfo, context: ErrorContext): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(errorInfo, context);
      } catch (error) {
        console.error('Error in error listener:', error);
      }
    });
  }

  private logError(errorInfo: ErrorInfo, context: ErrorContext, originalError?: Error | string): void {
    const logData = {
      error: errorInfo,
      context,
      originalError: originalError instanceof Error ? {
        name: originalError.name,
        message: originalError.message,
        stack: originalError.stack,
      } : originalError,
      timestamp: new Date().toISOString(),
    };

    // Log based on severity
    switch (errorInfo.severity) {
      case 'critical':
        console.error('CRITICAL ERROR:', logData);
        break;
      case 'high':
        console.error('HIGH SEVERITY ERROR:', logData);
        break;
      case 'medium':
        console.warn('MEDIUM SEVERITY ERROR:', logData);
        break;
      case 'low':
        console.info('LOW SEVERITY ERROR:', logData);
        break;
    }

    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      this.sendToErrorTracking(logData);
    }
  }

  private async sendToErrorTracking(logData: any): Promise<void> {
    try {
      // Send to error tracking service (e.g., Sentry, LogRocket, etc.)
      await fetch('/api/errors/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logData),
      });
    } catch (error) {
      console.error('Failed to send error to tracking service:', error);
    }
  }

  getErrorByCode(code: string): ErrorInfo | undefined {
    return this.errorCatalog.get(code);
  }

  getAllErrors(): ErrorInfo[] {
    return Array.from(this.errorCatalog.values());
  }
}

// Global error handler instance
let globalErrorHandler: ErrorHandler | null = null;

export function getErrorHandler(): ErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler();
  }
  return globalErrorHandler;
}

// Utility functions for common error scenarios
export function handleNetworkError(error: Error, context?: Partial<ErrorContext>): ErrorInfo {
  return getErrorHandler().handleError(error, {
    timestamp: Date.now(),
    category: 'network',
    ...context,
  });
}

export function handleValidationError(message: string, context?: Partial<ErrorContext>): ErrorInfo {
  return getErrorHandler().handleError('INVALID_INPUT', {
    timestamp: Date.now(),
    category: 'validation',
    ...context,
  });
}

export function handleTransactionError(error: Error, context?: Partial<ErrorContext>): ErrorInfo {
  return getErrorHandler().handleError(error, {
    timestamp: Date.now(),
    category: 'system',
    component: 'transaction',
    ...context,
  });
}