/**
 * Rate Limiter for Authentication Attempts
 * 
 * Implements sliding window rate limiting to prevent brute force attacks
 */

export interface RateLimiterConfig {
  windowMs: number; // Time window in milliseconds
  maxAttempts: number; // Maximum attempts per window
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

export interface RateLimitInfo {
  totalHits: number;
  totalHitsInWindow: number;
  remainingPoints: number;
  msBeforeNext: number;
  isBlocked: boolean;
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private attempts: Map<string, number[]> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimiterConfig) {
    this.config = {
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config
    };

    // Clean up old entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  /**
   * Check if a request is allowed for the given key
   */
  isAllowed(key: string, isSuccessful?: boolean): boolean {
    // Skip counting based on configuration
    if (isSuccessful && this.config.skipSuccessfulRequests) {
      return true;
    }
    
    if (isSuccessful === false && this.config.skipFailedRequests) {
      return true;
    }

    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Get existing attempts for this key
    let keyAttempts = this.attempts.get(key) || [];
    
    // Remove attempts outside the current window
    keyAttempts = keyAttempts.filter(timestamp => timestamp > windowStart);
    
    // Check if we're within the limit
    if (keyAttempts.length >= this.config.maxAttempts) {
      // Update the attempts array (without adding new attempt)
      this.attempts.set(key, keyAttempts);
      return false;
    }
    
    // Add current attempt
    keyAttempts.push(now);
    this.attempts.set(key, keyAttempts);
    
    return true;
  }

  /**
   * Get rate limit information for a key
   */
  getRateLimitInfo(key: string): RateLimitInfo {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    let keyAttempts = this.attempts.get(key) || [];
    keyAttempts = keyAttempts.filter(timestamp => timestamp > windowStart);
    
    const totalHitsInWindow = keyAttempts.length;
    const remainingPoints = Math.max(0, this.config.maxAttempts - totalHitsInWindow);
    const isBlocked = totalHitsInWindow >= this.config.maxAttempts;
    
    let msBeforeNext = 0;
    if (isBlocked && keyAttempts.length > 0) {
      // Time until the oldest attempt in the window expires
      const oldestAttempt = Math.min(...keyAttempts);
      msBeforeNext = Math.max(0, (oldestAttempt + this.config.windowMs) - now);
    }

    return {
      totalHits: keyAttempts.length,
      totalHitsInWindow,
      remainingPoints,
      msBeforeNext,
      isBlocked
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.attempts.clear();
  }

  /**
   * Get all active keys (for monitoring)
   */
  getActiveKeys(): string[] {
    return Array.from(this.attempts.keys());
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): {
    totalKeys: number;
    totalAttempts: number;
    blockedKeys: number;
  } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    let totalAttempts = 0;
    let blockedKeys = 0;
    
    for (const [key, attempts] of this.attempts.entries()) {
      const validAttempts = attempts.filter(timestamp => timestamp > windowStart);
      totalAttempts += validAttempts.length;
      
      if (validAttempts.length >= this.config.maxAttempts) {
        blockedKeys++;
      }
    }

    return {
      totalKeys: this.attempts.size,
      totalAttempts,
      blockedKeys
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    for (const [key, attempts] of this.attempts.entries()) {
      const validAttempts = attempts.filter(timestamp => timestamp > windowStart);
      
      if (validAttempts.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, validAttempts);
      }
    }
  }

  /**
   * Destroy the rate limiter and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.attempts.clear();
  }
}

/**
 * Create a rate limiter with common presets
 */
export class RateLimiterPresets {
  /**
   * Strict rate limiter for login attempts
   */
  static createLoginLimiter(): RateLimiter {
    return new RateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxAttempts: 5,
      skipSuccessfulRequests: true
    });
  }

  /**
   * Moderate rate limiter for API requests
   */
  static createApiLimiter(): RateLimiter {
    return new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxAttempts: 100,
      skipSuccessfulRequests: false
    });
  }

  /**
   * Lenient rate limiter for general requests
   */
  static createGeneralLimiter(): RateLimiter {
    return new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxAttempts: 1000,
      skipSuccessfulRequests: true
    });
  }

  /**
   * Very strict rate limiter for password reset attempts
   */
  static createPasswordResetLimiter(): RateLimiter {
    return new RateLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      maxAttempts: 3,
      skipSuccessfulRequests: false
    });
  }
}