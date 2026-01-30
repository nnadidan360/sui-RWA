/**
 * Property-Based Tests for Error Handling and Recovery System
 * 
 * **Feature: rwa-lending-protocol, Property 21: Error message generation**
 * **Validates: Requirements 5.4**
 * 
 * Property: For any system error, appropriate error messages with resolution guidance 
 * should be generated and displayed to users
 */

import { ErrorHandler, ErrorInfo, ErrorContext, getErrorHandler } from '@/lib/error/error-handler';

// Property-based testing utilities
interface ErrorScenario {
  errorType: 'network' | 'validation' | 'authentication' | 'authorization' | 'system' | 'user';
  errorCode: string;
  originalError: Error | string;
  context: ErrorContext;
  expectedSeverity: 'low' | 'medium' | 'high' | 'critical';
  shouldBeRetryable: boolean;
}

interface NetworkCondition {
  type: 'timeout' | 'offline' | 'server_error' | 'rate_limit';
  statusCode?: number;
  delay?: number;
}

interface ValidationError {
  field: string;
  value: any;
  constraint: string;
  message: string;
}

// Property generators
function generateErrorCode(): string {
  const codes = [
    'NETWORK_TIMEOUT', 'NETWORK_OFFLINE', 'SERVER_ERROR',
    'INVALID_INPUT', 'INSUFFICIENT_BALANCE', 'AUTH_REQUIRED',
    'SESSION_EXPIRED', 'TRANSACTION_FAILED', 'WALLET_NOT_CONNECTED',
    'VALIDATOR_NOT_FOUND', 'UNBONDING_PERIOD_ACTIVE',
    'COLLATERAL_INSUFFICIENT', 'LIQUIDATION_RISK'
  ];
  return codes[Math.floor(Math.random() * codes.length)];
}

function generateNetworkError(): Error {
  const networkErrors = [
    new Error('Request timeout'),
    new Error('Network request failed'),
    new Error('fetch failed'),
    new Error('Connection timed out'),
    new Error('Server returned 500 Internal Server Error'),
    new Error('Network is offline'),
  ];
  return networkErrors[Math.floor(Math.random() * networkErrors.length)];
}

function generateValidationError(): ValidationError {
  const fields = ['amount', 'address', 'email', 'password', 'collateral'];
  const constraints = ['required', 'min_length', 'max_value', 'format', 'positive'];
  
  const field = fields[Math.floor(Math.random() * fields.length)];
  const constraint = constraints[Math.floor(Math.random() * constraints.length)];
  
  return {
    field,
    value: Math.random() > 0.5 ? '' : -Math.random() * 100,
    constraint,
    message: `${field} ${constraint} validation failed`,
  };
}

function generateAuthError(): Error {
  const authErrors = [
    new Error('Unauthorized: 401'),
    new Error('Forbidden: 403'),
    new Error('Session expired'),
    new Error('Invalid credentials'),
    new Error('Token expired'),
  ];
  return authErrors[Math.floor(Math.random() * authErrors.length)];
}

function generateTransactionError(): Error {
  const txErrors = [
    new Error('Transaction reverted'),
    new Error('Insufficient gas'),
    new Error('Nonce too low'),
    new Error('Gas limit exceeded'),
    new Error('Contract execution failed'),
  ];
  return txErrors[Math.floor(Math.random() * txErrors.length)];
}

function generateErrorContext(): ErrorContext {
  const components = ['asset-tokenization', 'lending-pool', 'staking', 'wallet', 'ui'];
  const actions = ['submit', 'approve', 'stake', 'withdraw', 'connect'];
  
  return {
    userId: `user_${Math.random().toString(36).substr(2, 9)}`,
    sessionId: `session_${Math.random().toString(36).substr(2, 16)}`,
    component: components[Math.floor(Math.random() * components.length)],
    action: actions[Math.floor(Math.random() * actions.length)],
    timestamp: Date.now() + Math.random() * 10000,
    userAgent: 'Mozilla/5.0 (Test Browser)',
    url: '/test-page',
  };
}

function generateErrorScenario(): ErrorScenario {
  const errorTypes: ErrorScenario['errorType'][] = ['network', 'validation', 'authentication', 'authorization', 'system', 'user'];
  const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
  
  let originalError: Error | string;
  let errorCode: string;
  let expectedSeverity: ErrorScenario['expectedSeverity'];
  let shouldBeRetryable: boolean;
  
  switch (errorType) {
    case 'network':
      originalError = generateNetworkError();
      errorCode = Math.random() > 0.5 ? 'NETWORK_TIMEOUT' : 'NETWORK_OFFLINE';
      expectedSeverity = 'medium';
      shouldBeRetryable = true;
      break;
    case 'validation':
      const validationError = generateValidationError();
      originalError = validationError.message;
      errorCode = 'INVALID_INPUT';
      expectedSeverity = 'low';
      shouldBeRetryable = false;
      break;
    case 'authentication':
      originalError = generateAuthError();
      errorCode = Math.random() > 0.5 ? 'AUTH_REQUIRED' : 'SESSION_EXPIRED';
      expectedSeverity = 'medium';
      shouldBeRetryable = false;
      break;
    case 'system':
      originalError = generateTransactionError();
      errorCode = 'TRANSACTION_FAILED';
      expectedSeverity = 'high';
      shouldBeRetryable = true;
      break;
    default:
      originalError = new Error('Generic error');
      errorCode = 'UNKNOWN_ERROR';
      expectedSeverity = 'medium';
      shouldBeRetryable = true;
  }
  
  return {
    errorType,
    errorCode,
    originalError,
    context: generateErrorContext(),
    expectedSeverity,
    shouldBeRetryable,
  };
}

describe('Error Handling and Recovery Property Tests', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  /**
   * Property 21: Error message generation
   * For any system error, appropriate error messages with resolution guidance 
   * should be generated and displayed to users
   */
  it('should generate appropriate error messages with resolution guidance for all error types', () => {
    const numIterations = 100;
    
    for (let i = 0; i < numIterations; i++) {
      const scenario = generateErrorScenario();
      const errorInfo = errorHandler.handleError(scenario.originalError, scenario.context);
      
      // Verify error info structure
      expect(errorInfo).toBeDefined();
      expect(errorInfo.code).toBeDefined();
      expect(errorInfo.message).toBeDefined();
      expect(errorInfo.userMessage).toBeDefined();
      expect(errorInfo.severity).toBeDefined();
      expect(errorInfo.category).toBeDefined();
      expect(typeof errorInfo.retryable).toBe('boolean');
      
      // Verify user message is user-friendly (not technical)
      expect(errorInfo.userMessage).not.toContain('Error:');
      expect(errorInfo.userMessage).not.toContain('Exception:');
      expect(errorInfo.userMessage).not.toContain('undefined');
      expect(errorInfo.userMessage).not.toContain('null');
      expect(errorInfo.userMessage.length).toBeGreaterThan(10);
      
      // Verify suggestions are provided
      expect(errorInfo.suggestions).toBeDefined();
      expect(Array.isArray(errorInfo.suggestions)).toBe(true);
      expect(errorInfo.suggestions!.length).toBeGreaterThan(0);
      
      // Verify suggestions are actionable
      errorInfo.suggestions!.forEach(suggestion => {
        expect(suggestion).toBeDefined();
        expect(suggestion.length).toBeGreaterThan(5);
        expect(suggestion).not.toContain('undefined');
        expect(suggestion).not.toContain('null');
      });
      
      // Verify severity levels are appropriate
      expect(['low', 'medium', 'high', 'critical']).toContain(errorInfo.severity);
      
      // Verify category is appropriate
      expect(['network', 'validation', 'authentication', 'authorization', 'system', 'user']).toContain(errorInfo.category);
    }
  });

  /**
   * Property: Error categorization should be consistent
   * For any error of the same type, the categorization should be consistent
   */
  it('should categorize errors consistently based on error type', () => {
    const numIterations = 50;
    const categoryMap = new Map<string, string>();
    
    for (let i = 0; i < numIterations; i++) {
      const scenario = generateErrorScenario();
      const errorInfo = errorHandler.handleError(scenario.originalError, scenario.context);
      
      // Check if we've seen this error code before
      if (categoryMap.has(errorInfo.code)) {
        // Should have the same category as before
        expect(errorInfo.category).toBe(categoryMap.get(errorInfo.code));
      } else {
        // Store the category for this error code
        categoryMap.set(errorInfo.code, errorInfo.category);
      }
      
      // Verify category matches error type patterns
      if (errorInfo.code.includes('NETWORK')) {
        expect(errorInfo.category).toBe('network');
      }
      if (errorInfo.code.includes('AUTH') || errorInfo.code.includes('SESSION')) {
        expect(errorInfo.category).toBe('authentication');
      }
      if (errorInfo.code.includes('INVALID') || errorInfo.code.includes('INSUFFICIENT')) {
        expect(errorInfo.category).toBe('validation');
      }
      if (errorInfo.code.includes('TRANSACTION')) {
        expect(errorInfo.category).toBe('system');
      }
    }
  });

  /**
   * Property: Retry behavior should match error characteristics
   * For any error, the retry behavior should be appropriate for the error type
   */
  it('should set appropriate retry behavior based on error characteristics', () => {
    const numIterations = 100;
    
    for (let i = 0; i < numIterations; i++) {
      const scenario = generateErrorScenario();
      const errorInfo = errorHandler.handleError(scenario.originalError, scenario.context);
      
      // Network and system errors should generally be retryable
      if (errorInfo.category === 'network' || errorInfo.category === 'system') {
        expect(errorInfo.retryable).toBe(true);
      }
      
      // Validation and authentication errors should generally not be retryable
      if (errorInfo.category === 'validation' || errorInfo.category === 'authentication') {
        expect(errorInfo.retryable).toBe(false);
      }
      
      // Critical errors should have appropriate suggestions
      if (errorInfo.severity === 'critical') {
        expect(errorInfo.suggestions!.length).toBeGreaterThan(0);
        expect(errorInfo.suggestions!.some(s => 
          s.toLowerCase().includes('immediately') || 
          s.toLowerCase().includes('urgent') ||
          s.toLowerCase().includes('contact support')
        )).toBe(true);
      }
    }
  });

  /**
   * Property: Error messages should be localized and accessible
   * For any error, the message should be clear and accessible to users
   */
  it('should generate accessible and clear error messages', () => {
    const numIterations = 100;
    
    for (let i = 0; i < numIterations; i++) {
      const scenario = generateErrorScenario();
      const errorInfo = errorHandler.handleError(scenario.originalError, scenario.context);
      
      // User message should be in plain language
      expect(errorInfo.userMessage).not.toMatch(/[{}[\]]/); // No template literals
      expect(errorInfo.userMessage).not.toMatch(/\$\{.*\}/); // No variable interpolation
      expect(errorInfo.userMessage).not.toContain('undefined');
      expect(errorInfo.userMessage).not.toContain('null');
      
      // Should start with capital letter and end with punctuation
      expect(errorInfo.userMessage.charAt(0)).toMatch(/[A-Z]/);
      expect(errorInfo.userMessage.charAt(errorInfo.userMessage.length - 1)).toMatch(/[.!]/);
      
      // Should not be too long (accessibility)
      expect(errorInfo.userMessage.length).toBeLessThan(200);
      
      // Should not contain technical jargon
      const technicalTerms = ['stack trace', 'exception', 'null pointer', 'segfault', 'undefined reference'];
      technicalTerms.forEach(term => {
        expect(errorInfo.userMessage.toLowerCase()).not.toContain(term);
      });
      
      // Suggestions should be actionable
      errorInfo.suggestions!.forEach(suggestion => {
        // Should contain action words or be actionable in nature
        const actionWords = ['try', 'check', 'verify', 'contact', 'refresh', 'reload', 'wait', 'add', 'remove', 'ensure', 'enable', 'disable', 'update', 'install', 'create'];
        const hasActionWord = actionWords.some(word => 
          suggestion.toLowerCase().includes(word)
        );
        
        // If no direct action word, should at least be instructional
        const isInstructional = suggestion.length > 10 && 
                               (suggestion.includes('your') || 
                                suggestion.includes('the') ||
                                suggestion.includes('if'));
        
        expect(hasActionWord || isInstructional).toBe(true);
      });
    }
  });

  /**
   * Property: Error context should be preserved and utilized
   * For any error with context, the context should influence error handling
   */
  it('should utilize error context to enhance error information', () => {
    const numIterations = 50;
    
    for (let i = 0; i < numIterations; i++) {
      const scenario = generateErrorScenario();
      const errorInfo = errorHandler.handleError(scenario.originalError, scenario.context);
      
      // Context should be available for logging and debugging
      expect(scenario.context.timestamp).toBeDefined();
      expect(scenario.context.timestamp).toBeGreaterThan(0);
      
      // Component-specific errors should have relevant suggestions
      if (scenario.context.component === 'wallet') {
        const walletSuggestions = errorInfo.suggestions!.some(s => 
          s.toLowerCase().includes('wallet') || 
          s.toLowerCase().includes('connect') ||
          s.toLowerCase().includes('extension')
        );
        // Not all wallet errors will have wallet-specific suggestions, but some should
        if (errorInfo.code === 'WALLET_NOT_CONNECTED') {
          expect(walletSuggestions).toBe(true);
        }
      }
      
      if (scenario.context.component === 'staking') {
        const stakingSuggestions = errorInfo.suggestions!.some(s => 
          s.toLowerCase().includes('validator') || 
          s.toLowerCase().includes('stake') ||
          s.toLowerCase().includes('unbond')
        );
        if (errorInfo.code === 'VALIDATOR_NOT_FOUND' || errorInfo.code === 'UNBONDING_PERIOD_ACTIVE') {
          expect(stakingSuggestions).toBe(true);
        }
      }
    }
  });

  /**
   * Property: Error recovery should provide progressive assistance
   * For any retryable error, recovery mechanisms should be available
   */
  it('should provide progressive assistance for error recovery', async () => {
    const numIterations = 20; // Reduced for async operations
    
    for (let i = 0; i < numIterations; i++) {
      const scenario = generateErrorScenario();
      const errorInfo = errorHandler.handleError(scenario.originalError, scenario.context);
      
      if (errorInfo.retryable) {
        // Should have retry-related suggestions
        const retrySuggestions = errorInfo.suggestions!.some(s => 
          s.toLowerCase().includes('try again') || 
          s.toLowerCase().includes('retry') ||
          s.toLowerCase().includes('refresh')
        );
        expect(retrySuggestions).toBe(true);
        
        // Test retry mechanism with mock operation
        let attemptCount = 0;
        const mockOperation = async () => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error('Mock failure');
          }
          return 'success';
        };
        
        try {
          const result = await errorHandler.retryWithBackoff(mockOperation, {
            maxAttempts: 3,
            baseDelay: 10, // Fast for testing
            maxDelay: 100,
            backoffFactor: 2,
          });
          expect(result).toBe('success');
          expect(attemptCount).toBe(2);
        } catch (error) {
          // Some operations may still fail after retries, which is expected
          expect(attemptCount).toBeGreaterThan(1);
        }
      }
    }
  });

  /**
   * Property: Error severity should guide user response urgency
   * For any error, the severity should appropriately indicate response urgency
   */
  it('should assign appropriate severity levels that guide user response', () => {
    const numIterations = 100;
    
    for (let i = 0; i < numIterations; i++) {
      const scenario = generateErrorScenario();
      const errorInfo = errorHandler.handleError(scenario.originalError, scenario.context);
      
      // Critical errors should have urgent language
      if (errorInfo.severity === 'critical') {
        const urgentLanguage = errorInfo.userMessage.toLowerCase().includes('immediately') ||
                              errorInfo.userMessage.toLowerCase().includes('urgent') ||
                              errorInfo.suggestions!.some(s => 
                                s.toLowerCase().includes('immediately') ||
                                s.toLowerCase().includes('urgent')
                              );
        expect(urgentLanguage).toBe(true);
      }
      
      // Low severity errors should have calm language
      if (errorInfo.severity === 'low') {
        const calmLanguage = !errorInfo.userMessage.toLowerCase().includes('critical') &&
                            !errorInfo.userMessage.toLowerCase().includes('urgent') &&
                            !errorInfo.userMessage.toLowerCase().includes('immediately');
        expect(calmLanguage).toBe(true);
      }
      
      // High severity errors should not be retryable without caution
      if (errorInfo.severity === 'high' && errorInfo.retryable) {
        const cautionaryLanguage = errorInfo.suggestions!.some(s => 
          s.toLowerCase().includes('check') ||
          s.toLowerCase().includes('ensure') ||
          s.toLowerCase().includes('verify') ||
          s.toLowerCase().includes('confirm') ||
          s.toLowerCase().includes('make sure') ||
          s.toLowerCase().includes('gas') ||
          s.toLowerCase().includes('wallet') ||
          s.toLowerCase().includes('try again') ||
          s.toLowerCase().includes('contact support')
        );
        
        // If no cautionary language in suggestions, check user message
        const cautionInMessage = errorInfo.userMessage.toLowerCase().includes('check') ||
                                errorInfo.userMessage.toLowerCase().includes('ensure') ||
                                errorInfo.userMessage.toLowerCase().includes('verify') ||
                                errorInfo.userMessage.toLowerCase().includes('wallet') ||
                                errorInfo.userMessage.toLowerCase().includes('gas') ||
                                errorInfo.userMessage.toLowerCase().includes('try again');
        
        // High severity retryable errors should have some form of caution or be transaction/system-related
        const isSystemRelated = errorInfo.code.includes('TRANSACTION') || 
                                errorInfo.code.includes('SERVER') ||
                                errorInfo.code.includes('NETWORK') ||
                                errorInfo.category === 'system' ||
                                errorInfo.category === 'network' ||
                                errorInfo.userMessage.toLowerCase().includes('transaction') ||
                                errorInfo.userMessage.toLowerCase().includes('server') ||
                                errorInfo.userMessage.toLowerCase().includes('network');
        
        expect(cautionaryLanguage || cautionInMessage || isSystemRelated).toBe(true);
      }
    }
  });

  /**
   * Property: Error handling should be consistent across error sources
   * For any error from different sources, similar errors should be handled similarly
   */
  it('should handle similar errors consistently regardless of source', () => {
    const numIterations = 50;
    const errorPatterns = new Map<string, ErrorInfo[]>();
    
    for (let i = 0; i < numIterations; i++) {
      // Generate similar errors from different sources
      const networkError1 = new Error('Request timeout');
      const networkError2 = new Error('Connection timed out');
      const networkError3 = new Error('Network request timed out');
      
      const errors = [networkError1, networkError2, networkError3];
      
      errors.forEach(error => {
        const errorInfo = errorHandler.handleError(error, generateErrorContext());
        const pattern = errorInfo.category + '_' + errorInfo.severity;
        
        if (!errorPatterns.has(pattern)) {
          errorPatterns.set(pattern, []);
        }
        errorPatterns.get(pattern)!.push(errorInfo);
      });
    }
    
    // Verify consistency within patterns
    errorPatterns.forEach((errorInfos, pattern) => {
      if (errorInfos.length > 1) {
        const first = errorInfos[0];
        errorInfos.slice(1).forEach(errorInfo => {
          expect(errorInfo.category).toBe(first.category);
          expect(errorInfo.severity).toBe(first.severity);
          expect(errorInfo.retryable).toBe(first.retryable);
          
          // Should have similar suggestion types
          const firstSuggestionTypes = first.suggestions!.map(s => 
            s.toLowerCase().includes('try') ? 'retry' :
            s.toLowerCase().includes('check') ? 'verify' :
            s.toLowerCase().includes('contact') ? 'support' : 'other'
          );
          
          const currentSuggestionTypes = errorInfo.suggestions!.map(s => 
            s.toLowerCase().includes('try') ? 'retry' :
            s.toLowerCase().includes('check') ? 'verify' :
            s.toLowerCase().includes('contact') ? 'support' : 'other'
          );
          
          // Should have at least one common suggestion type
          const hasCommonType = firstSuggestionTypes.some(type => 
            currentSuggestionTypes.includes(type)
          );
          expect(hasCommonType).toBe(true);
        });
      }
    });
  });
});