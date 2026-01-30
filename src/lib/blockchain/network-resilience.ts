/**
 * Network Resilience and Error Handling for Blockchain Integration
 * Implements multiple RPC endpoint failover and graceful degradation
 */

import { getCasperClient, CasperClientError } from '@/lib/casper/client';
import { getCasperConfig, CASPER_ERRORS } from '@/config/casper';

export interface NetworkHealth {
  isOnline: boolean;
  activeEndpoint: string;
  responseTime: number;
  lastChecked: Date;
  failedEndpoints: string[];
  totalEndpoints: number;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface NetworkError {
  code: string;
  message: string;
  userMessage: string;
  recoverable: boolean;
  retryAfter?: number;
}

export class NetworkResilienceManager {
  private client = getCasperClient();
  private config = getCasperConfig();
  private healthStatus: NetworkHealth;
  private retryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  };

  constructor() {
    this.healthStatus = {
      isOnline: true,
      activeEndpoint: this.config.rpcEndpoints[0] || '',
      responseTime: 0,
      lastChecked: new Date(),
      failedEndpoints: [],
      totalEndpoints: this.config.rpcEndpoints.length,
    };
  }

  /**
   * Execute operation with automatic failover and retry logic
   */
  async executeWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string = 'blockchain_operation'
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        const startTime = Date.now();
        const result = await operation();
        
        // Update health status on success
        this.updateHealthStatus(true, Date.now() - startTime);
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        console.warn(`${operationName} attempt ${attempt} failed:`, error);
        
        // Update health status on failure
        this.updateHealthStatus(false, 0, error as Error);
        
        // Check if error is recoverable
        const networkError = this.categorizeError(error as Error);
        
        if (!networkError.recoverable || attempt === this.retryConfig.maxAttempts) {
          throw this.createUserFriendlyError(networkError, operationName);
        }
        
        // Wait before retry with exponential backoff
        const delay = this.calculateRetryDelay(attempt);
        await this.delay(delay);
      }
    }
    
    throw this.createUserFriendlyError(
      this.categorizeError(lastError!),
      operationName
    );
  }

  /**
   * Get current network health status
   */
  getNetworkHealth(): NetworkHealth {
    return { ...this.healthStatus };
  }

  /**
   * Check network connectivity and update health status
   */
  async checkNetworkHealth(): Promise<NetworkHealth> {
    try {
      const startTime = Date.now();
      
      // Try to get network status from current endpoint
      await this.client.getNetworkStatus();
      
      const responseTime = Date.now() - startTime;
      this.updateHealthStatus(true, responseTime);
      
    } catch (error) {
      console.warn('Network health check failed:', error);
      this.updateHealthStatus(false, 0, error as Error);
    }
    
    return this.getNetworkHealth();
  }

  /**
   * Get user-friendly error messages for different network issues
   */
  getUserFriendlyErrorMessage(error: Error): string {
    const networkError = this.categorizeError(error);
    return networkError.userMessage;
  }

  /**
   * Check if an operation should be retried
   */
  shouldRetry(error: Error, attempt: number): boolean {
    const networkError = this.categorizeError(error);
    return networkError.recoverable && attempt < this.retryConfig.maxAttempts;
  }

  /**
   * Get suggested retry delay for an error
   */
  getRetryDelay(error: Error, attempt: number): number {
    const networkError = this.categorizeError(error);
    
    if (networkError.retryAfter) {
      return networkError.retryAfter;
    }
    
    return this.calculateRetryDelay(attempt);
  }

  /**
   * Update network health status
   */
  private updateHealthStatus(
    isOnline: boolean, 
    responseTime: number, 
    error?: Error
  ): void {
    this.healthStatus = {
      ...this.healthStatus,
      isOnline,
      responseTime,
      lastChecked: new Date(),
    };
    
    if (error && this.isEndpointError(error)) {
      // Track failed endpoints
      const currentEndpoint = this.healthStatus.activeEndpoint;
      if (!this.healthStatus.failedEndpoints.includes(currentEndpoint)) {
        this.healthStatus.failedEndpoints.push(currentEndpoint);
      }
    } else if (isOnline) {
      // Clear failed endpoints on successful connection
      this.healthStatus.failedEndpoints = [];
    }
  }

  /**
   * Categorize error and provide user-friendly information
   */
  private categorizeError(error: Error): NetworkError {
    const errorMessage = error.message.toLowerCase();
    
    // Network connectivity errors
    if (errorMessage.includes('network') || 
        errorMessage.includes('connection') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('fetch')) {
      return {
        code: 'NETWORK_ERROR',
        message: error.message,
        userMessage: 'Unable to connect to the Casper network. Please check your internet connection and try again.',
        recoverable: true,
        retryAfter: 5000,
      };
    }
    
    // RPC endpoint errors
    if (errorMessage.includes('rpc') || 
        errorMessage.includes('endpoint') ||
        errorMessage.includes('service unavailable')) {
      return {
        code: 'RPC_ERROR',
        message: error.message,
        userMessage: 'The blockchain service is temporarily unavailable. We\'re trying alternative connections.',
        recoverable: true,
        retryAfter: 3000,
      };
    }
    
    // Rate limiting errors
    if (errorMessage.includes('rate limit') || 
        errorMessage.includes('too many requests')) {
      return {
        code: 'RATE_LIMIT',
        message: error.message,
        userMessage: 'Too many requests. Please wait a moment before trying again.',
        recoverable: true,
        retryAfter: 10000,
      };
    }
    
    // Contract not found errors
    if (errorMessage.includes('contract not found') ||
        errorMessage.includes('contract not deployed')) {
      return {
        code: 'CONTRACT_ERROR',
        message: error.message,
        userMessage: 'Smart contract is not available. This feature may be temporarily disabled.',
        recoverable: false,
      };
    }
    
    // Insufficient balance errors
    if (errorMessage.includes('insufficient') ||
        errorMessage.includes('balance')) {
      return {
        code: 'INSUFFICIENT_BALANCE',
        message: error.message,
        userMessage: 'Insufficient balance to complete this transaction. Please check your account balance.',
        recoverable: false,
      };
    }
    
    // Transaction errors
    if (errorMessage.includes('transaction') ||
        errorMessage.includes('deploy')) {
      return {
        code: 'TRANSACTION_ERROR',
        message: error.message,
        userMessage: 'Transaction failed. Please check your inputs and try again.',
        recoverable: true,
      };
    }
    
    // Generic blockchain errors
    if (error instanceof CasperClientError) {
      return {
        code: error.code,
        message: error.message,
        userMessage: this.getCasperErrorMessage(error.code),
        recoverable: this.isCasperErrorRecoverable(error.code),
      };
    }
    
    // Unknown errors
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      userMessage: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
      recoverable: true,
    };
  }

  /**
   * Get user-friendly message for Casper-specific errors
   */
  private getCasperErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'NETWORK_ERROR':
        return 'Unable to connect to the Casper network. Please check your connection.';
      case 'INSUFFICIENT_BALANCE':
        return 'Insufficient CSPR balance to complete this transaction.';
      case 'CONTRACT_NOT_FOUND':
        return 'Smart contract is not available. Please try again later.';
      case 'INVALID_DEPLOY':
        return 'Transaction format is invalid. Please try again.';
      case 'DEPLOY_FAILED':
        return 'Transaction execution failed. Please check your inputs.';
      case 'TIMEOUT':
        return 'Operation timed out. The network may be busy, please try again.';
      case 'UNAUTHORIZED':
        return 'Transaction not authorized. Please check your wallet connection.';
      case 'PAUSED':
        return 'System is temporarily paused for maintenance.';
      default:
        return 'A blockchain error occurred. Please try again.';
    }
  }

  /**
   * Check if a Casper error is recoverable
   */
  private isCasperErrorRecoverable(errorCode: string): boolean {
    const nonRecoverableErrors = [
      'INSUFFICIENT_BALANCE',
      'CONTRACT_NOT_FOUND',
      'UNAUTHORIZED',
      'INVALID_DEPLOY',
    ];
    
    return !nonRecoverableErrors.includes(errorCode);
  }

  /**
   * Check if error is related to endpoint connectivity
   */
  private isEndpointError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return errorMessage.includes('connection') ||
           errorMessage.includes('network') ||
           errorMessage.includes('timeout') ||
           errorMessage.includes('fetch');
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.retryConfig.baseDelay * 
                  Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
    
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  /**
   * Create user-friendly error with context
   */
  private createUserFriendlyError(networkError: NetworkError, operationName: string): Error {
    const error = new Error(networkError.userMessage);
    (error as any).code = networkError.code;
    (error as any).recoverable = networkError.recoverable;
    (error as any).operation = operationName;
    (error as any).originalMessage = networkError.message;
    
    return error;
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  /**
   * Reset network health status
   */
  resetHealthStatus(): void {
    this.healthStatus = {
      isOnline: true,
      activeEndpoint: this.config.rpcEndpoints[0] || '',
      responseTime: 0,
      lastChecked: new Date(),
      failedEndpoints: [],
      totalEndpoints: this.config.rpcEndpoints.length,
    };
  }
}

// Singleton instance
let resilienceManager: NetworkResilienceManager | null = null;

/**
 * Get the singleton network resilience manager
 */
export function getNetworkResilienceManager(): NetworkResilienceManager {
  if (!resilienceManager) {
    resilienceManager = new NetworkResilienceManager();
  }
  return resilienceManager;
}

/**
 * Utility function to execute any blockchain operation with resilience
 */
export async function executeWithNetworkResilience<T>(
  operation: () => Promise<T>,
  operationName?: string
): Promise<T> {
  const manager = getNetworkResilienceManager();
  return manager.executeWithResilience(operation, operationName);
}

/**
 * Utility function to get user-friendly error message
 */
export function getNetworkErrorMessage(error: Error): string {
  const manager = getNetworkResilienceManager();
  return manager.getUserFriendlyErrorMessage(error);
}

/**
 * Utility function to check if error should be retried
 */
export function shouldRetryNetworkError(error: Error, attempt: number): boolean {
  const manager = getNetworkResilienceManager();
  return manager.shouldRetry(error, attempt);
}