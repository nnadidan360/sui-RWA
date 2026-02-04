/**
 * Credit OS Sponsored Transaction Relayer
 * Implements gas-free transactions for account abstraction
 * Requirements: 1.3
 */

import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getSuiService } from '../blockchain/sui-service';
import { getCreditOSConfig } from '../../config/credit-os';
import { getSessionManager } from './session-manager';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface SponsoredTransactionRequest {
  userAccountId: string;
  sessionToken: string;
  transaction: Transaction;
  gasLimit?: number;
  priority?: 'low' | 'normal' | 'high';
}

export interface SponsoredTransactionResult {
  success: boolean;
  transactionDigest?: string;
  sponsoredTransactionId?: string;
  gasUsed?: number;
  error?: string;
}

export interface TransactionSponsorship {
  id: string;
  userAccountId: string;
  sessionId: string;
  transactionHash: string;
  gasLimit: number;
  gasUsed?: number;
  sponsoredBy: string;
  status: 'pending' | 'executed' | 'failed' | 'expired';
  createdAt: Date;
  executedAt?: Date;
  expiresAt: Date;
}

export interface GasSponsorshipLimits {
  dailyGasLimit: number;
  monthlyGasLimit: number;
  perTransactionLimit: number;
  currentDailyUsage: number;
  currentMonthlyUsage: number;
  lastResetDay: number;
  lastResetMonth: number;
}

// ============================================================================
// SPONSORED TRANSACTION RELAYER CLASS
// ============================================================================

export class SponsoredTransactionRelayer {
  private config = getCreditOSConfig();
  private suiService = getSuiService();
  private sessionManager = getSessionManager();
  private sponsorKeypair: Ed25519Keypair;
  private pendingTransactions = new Map<string, TransactionSponsorship>();
  private userGasLimits = new Map<string, GasSponsorshipLimits>();

  constructor(sponsorPrivateKey?: string) {
    // Initialize sponsor keypair
    if (sponsorPrivateKey) {
      this.sponsorKeypair = Ed25519Keypair.fromSecretKey(
        Buffer.from(sponsorPrivateKey, 'hex')
      );
    } else {
      // Generate a new keypair for testing
      this.sponsorKeypair = new Ed25519Keypair();
    }
  }

  // ============================================================================
  // TRANSACTION SPONSORSHIP
  // ============================================================================

  /**
   * Submit a transaction for gas sponsorship
   * Requirements: 1.3
   */
  async submitSponsoredTransaction(
    request: SponsoredTransactionRequest
  ): Promise<SponsoredTransactionResult> {
    try {
      // Validate session
      const sessionValidation = this.sessionManager.validateSession(
        this.extractSessionId(request.sessionToken)
      );

      if (!sessionValidation.valid) {
        return {
          success: false,
          error: 'Invalid session',
        };
      }

      // Check gas limits
      const gasLimitCheck = await this.checkGasLimits(
        request.userAccountId,
        request.gasLimit || 1000000
      );

      if (!gasLimitCheck.allowed) {
        return {
          success: false,
          error: gasLimitCheck.reason,
        };
      }

      // Create sponsored transaction
      const sponsorship = await this.createSponsorship(request);

      // Execute transaction with gas sponsorship
      const result = await this.executeSponsoredTransaction(sponsorship);

      return result;

    } catch (error) {
      console.error('Sponsored transaction failed:', error);
      return {
        success: false,
        error: 'Transaction sponsorship failed',
      };
    }
  }

  /**
   * Create transaction sponsorship record
   */
  private async createSponsorship(
    request: SponsoredTransactionRequest
  ): Promise<TransactionSponsorship> {
    const sponsorshipId = this.generateSponsorshipId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 300000); // 5 minutes

    const sponsorship: TransactionSponsorship = {
      id: sponsorshipId,
      userAccountId: request.userAccountId,
      sessionId: this.extractSessionId(request.sessionToken),
      transactionHash: await this.hashTransaction(request.transaction),
      gasLimit: request.gasLimit || 1000000,
      sponsoredBy: this.sponsorKeypair.getPublicKey().toSuiAddress(),
      status: 'pending',
      createdAt: now,
      expiresAt,
    };

    this.pendingTransactions.set(sponsorshipId, sponsorship);
    return sponsorship;
  }

  /**
   * Execute sponsored transaction
   */
  private async executeSponsoredTransaction(
    sponsorship: TransactionSponsorship
  ): Promise<SponsoredTransactionResult> {
    try {
      // Set gas payment to be sponsored
      const transaction = await this.prepareTransactionForSponsorship(sponsorship);

      // Execute transaction
      const result = await this.suiService.sponsorTransaction(transaction);

      // Update sponsorship record
      sponsorship.status = 'executed';
      sponsorship.executedAt = new Date();
      sponsorship.transactionHash = result;

      // Update gas usage
      await this.updateGasUsage(sponsorship.userAccountId, sponsorship.gasUsed || 0);

      return {
        success: true,
        transactionDigest: result,
        sponsoredTransactionId: sponsorship.id,
        gasUsed: sponsorship.gasUsed,
      };

    } catch (error) {
      console.error('Transaction execution failed:', error);
      
      sponsorship.status = 'failed';
      
      return {
        success: false,
        error: 'Transaction execution failed',
      };
    }
  }

  /**
   * Prepare transaction for sponsorship
   */
  private async prepareTransactionForSponsorship(
    sponsorship: TransactionSponsorship
  ): Promise<Transaction> {
    // Create a new transaction with sponsor as gas payer
    const transaction = new Transaction();
    
    // Set gas budget
    transaction.setGasBudget(sponsorship.gasLimit);
    
    // Set sponsor as sender (gas payer)
    transaction.setSender(this.sponsorKeypair.getPublicKey().toSuiAddress());
    
    return transaction;
  }

  // ============================================================================
  // GAS LIMIT MANAGEMENT
  // ============================================================================

  /**
   * Check if user is within gas sponsorship limits
   */
  private async checkGasLimits(
    userAccountId: string,
    requestedGas: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const limits = this.getUserGasLimits(userAccountId);
    const now = Date.now();
    const currentDay = Math.floor(now / (1000 * 60 * 60 * 24));
    const currentMonth = Math.floor(now / (1000 * 60 * 60 * 24 * 30));

    // Reset daily usage if new day
    if (currentDay > limits.lastResetDay) {
      limits.currentDailyUsage = 0;
      limits.lastResetDay = currentDay;
    }

    // Reset monthly usage if new month
    if (currentMonth > limits.lastResetMonth) {
      limits.currentMonthlyUsage = 0;
      limits.lastResetMonth = currentMonth;
    }

    // Check per-transaction limit
    if (requestedGas > limits.perTransactionLimit) {
      return {
        allowed: false,
        reason: 'Transaction gas limit exceeded',
      };
    }

    // Check daily limit
    if (limits.currentDailyUsage + requestedGas > limits.dailyGasLimit) {
      return {
        allowed: false,
        reason: 'Daily gas limit exceeded',
      };
    }

    // Check monthly limit
    if (limits.currentMonthlyUsage + requestedGas > limits.monthlyGasLimit) {
      return {
        allowed: false,
        reason: 'Monthly gas limit exceeded',
      };
    }

    return { allowed: true };
  }

  /**
   * Get or create gas limits for user
   */
  private getUserGasLimits(userAccountId: string): GasSponsorshipLimits {
    let limits = this.userGasLimits.get(userAccountId);
    
    if (!limits) {
      const now = Date.now();
      limits = {
        dailyGasLimit: 10000000, // 10M gas units per day
        monthlyGasLimit: 100000000, // 100M gas units per month
        perTransactionLimit: 1000000, // 1M gas units per transaction
        currentDailyUsage: 0,
        currentMonthlyUsage: 0,
        lastResetDay: Math.floor(now / (1000 * 60 * 60 * 24)),
        lastResetMonth: Math.floor(now / (1000 * 60 * 60 * 24 * 30)),
      };
      
      this.userGasLimits.set(userAccountId, limits);
    }
    
    return limits;
  }

  /**
   * Update gas usage for user
   */
  private async updateGasUsage(userAccountId: string, gasUsed: number): Promise<void> {
    const limits = this.getUserGasLimits(userAccountId);
    limits.currentDailyUsage += gasUsed;
    limits.currentMonthlyUsage += gasUsed;
  }

  // ============================================================================
  // BATCH TRANSACTION SUPPORT
  // ============================================================================

  /**
   * Submit multiple transactions as a batch with shared gas sponsorship
   */
  async submitBatchSponsoredTransactions(
    requests: SponsoredTransactionRequest[]
  ): Promise<SponsoredTransactionResult[]> {
    const results: SponsoredTransactionResult[] = [];
    
    // Validate all requests first
    for (const request of requests) {
      const sessionValidation = this.sessionManager.validateSession(
        this.extractSessionId(request.sessionToken)
      );
      
      if (!sessionValidation.valid) {
        results.push({
          success: false,
          error: 'Invalid session',
        });
        continue;
      }
      
      // Check total gas limit for batch
      const totalGas = requests.reduce((sum, req) => sum + (req.gasLimit || 1000000), 0);
      const gasLimitCheck = await this.checkGasLimits(request.userAccountId, totalGas);
      
      if (!gasLimitCheck.allowed) {
        results.push({
          success: false,
          error: gasLimitCheck.reason,
        });
        continue;
      }
    }
    
    // Execute valid transactions
    for (let i = 0; i < requests.length; i++) {
      if (results[i]?.success === false) {
        continue; // Skip failed validations
      }
      
      try {
        const result = await this.submitSponsoredTransaction(requests[i]);
        results[i] = result;
      } catch (error) {
        results[i] = {
          success: false,
          error: 'Batch transaction failed',
        };
      }
    }
    
    return results;
  }

  // ============================================================================
  // TRANSACTION MONITORING
  // ============================================================================

  /**
   * Get sponsorship status
   */
  getSponsorshipStatus(sponsorshipId: string): TransactionSponsorship | undefined {
    return this.pendingTransactions.get(sponsorshipId);
  }

  /**
   * Get user's gas usage statistics
   */
  getUserGasUsage(userAccountId: string): {
    dailyUsage: number;
    monthlyUsage: number;
    dailyLimit: number;
    monthlyLimit: number;
    dailyRemaining: number;
    monthlyRemaining: number;
  } {
    const limits = this.getUserGasLimits(userAccountId);
    
    return {
      dailyUsage: limits.currentDailyUsage,
      monthlyUsage: limits.currentMonthlyUsage,
      dailyLimit: limits.dailyGasLimit,
      monthlyLimit: limits.monthlyGasLimit,
      dailyRemaining: Math.max(0, limits.dailyGasLimit - limits.currentDailyUsage),
      monthlyRemaining: Math.max(0, limits.monthlyGasLimit - limits.currentMonthlyUsage),
    };
  }

  /**
   * Clean up expired sponsorships
   */
  cleanupExpiredSponsorships(): void {
    const now = new Date();
    const expiredIds: string[] = [];
    
    for (const [id, sponsorship] of this.pendingTransactions) {
      if (now > sponsorship.expiresAt && sponsorship.status === 'pending') {
        sponsorship.status = 'expired';
        expiredIds.push(id);
      }
    }
    
    // Remove expired sponsorships
    for (const id of expiredIds) {
      this.pendingTransactions.delete(id);
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private generateSponsorshipId(): string {
    return `sponsor_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private extractSessionId(sessionToken: string): string {
    // Extract session ID from JWT token
    try {
      const payload = JSON.parse(Buffer.from(sessionToken.split('.')[1], 'base64').toString());
      return payload.sessionId;
    } catch {
      return '';
    }
  }

  private async hashTransaction(transaction: Transaction): Promise<string> {
    // Create a hash of the transaction for tracking
    const transactionBytes = await transaction.build();
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(transactionBytes).digest('hex');
  }

  /**
   * Update gas limits for a user (admin function)
   */
  updateUserGasLimits(
    userAccountId: string,
    limits: Partial<GasSponsorshipLimits>
  ): void {
    const currentLimits = this.getUserGasLimits(userAccountId);
    Object.assign(currentLimits, limits);
  }

  /**
   * Get sponsor address
   */
  getSponsorAddress(): string {
    return this.sponsorKeypair.getPublicKey().toSuiAddress();
  }

  /**
   * Get total gas sponsored (for monitoring)
   */
  getTotalGasSponsored(): number {
    let total = 0;
    for (const limits of this.userGasLimits.values()) {
      total += limits.currentMonthlyUsage;
    }
    return total;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let sponsoredTransactionRelayerInstance: SponsoredTransactionRelayer | null = null;

export function getSponsoredTransactionRelayer(): SponsoredTransactionRelayer {
  if (!sponsoredTransactionRelayerInstance) {
    const config = getCreditOSConfig();
    sponsoredTransactionRelayerInstance = new SponsoredTransactionRelayer(
      config.sui.adminPrivateKey
    );
  }
  return sponsoredTransactionRelayerInstance;
}