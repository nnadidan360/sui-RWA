/**
 * Sponsored Transaction Service for Credit OS
 * 
 * Handles gas-free transactions for users through sponsored execution
 */

import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger';
import { SessionToken } from '../auth/auth-service';

export interface SponsoredTransaction {
  transactionId: string;
  userId: string;
  sessionId: string;
  transactionType: string;
  targetContract: string;
  functionName: string;
  parameters: any[];
  gasEstimate: number;
  gasSponsored: number;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  suiTransactionDigest?: string;
  submittedAt?: Date;
  confirmedAt?: Date;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export interface TransactionRequest {
  sessionToken: SessionToken;
  transactionType: string;
  targetContract: string;
  functionName: string;
  parameters: any[];
  capabilities?: string[];
  metadata?: Record<string, any>;
}

export interface GasPolicy {
  maxGasPerTransaction: number;
  maxGasPerUser: number;
  maxGasPerDay: number;
  freeTransactionTypes: string[];
  sponsorshipRules: SponsorshipRule[];
}

export interface SponsorshipRule {
  condition: string;
  maxGas: number;
  priority: number;
  description: string;
}

export interface TransactionMetrics {
  totalTransactions: number;
  sponsoredTransactions: number;
  totalGasSponsored: number;
  averageGasPerTransaction: number;
  successRate: number;
  failureReasons: Record<string, number>;
}

export interface SuiClient {
  // Mock Sui client interface - in production would use @mysten/sui.js
  executeTransactionBlock(params: {
    transactionBlock: any;
    signer: any;
    options?: any;
  }): Promise<{
    digest: string;
    effects: any;
    events: any[];
  }>;
  
  getTransactionBlock(digest: string): Promise<{
    digest: string;
    transaction: any;
    effects: any;
    events: any[];
  }>;
  
  dryRunTransactionBlock(params: {
    transactionBlock: any;
  }): Promise<{
    effects: any;
    events: any[];
  }>;
}

export class SponsoredTransactionService {
  private suiClient: SuiClient;
  private gasPolicy: GasPolicy;
  private pendingTransactions: Map<string, SponsoredTransaction> = new Map();
  private userGasUsage: Map<string, { daily: number; total: number; lastReset: Date }> = new Map();
  private sponsorWallet: any; // In production would be Sui keypair

  constructor(suiClient: SuiClient, gasPolicy?: Partial<GasPolicy>) {
    this.suiClient = suiClient;
    this.gasPolicy = {
      maxGasPerTransaction: 10000000, // 0.01 SUI in MIST
      maxGasPerUser: 100000000, // 0.1 SUI per user
      maxGasPerDay: 1000000000, // 1 SUI per day
      freeTransactionTypes: [
        'user_account::create_session',
        'user_account::validate_session',
        'auth_policy::validate_auth_attempt',
        'recovery_policy::initiate_recovery'
      ],
      sponsorshipRules: [
        {
          condition: 'new_user',
          maxGas: 50000000, // 0.05 SUI for new users
          priority: 1,
          description: 'Higher gas limit for new user onboarding'
        },
        {
          condition: 'premium_user',
          maxGas: 200000000, // 0.2 SUI for premium users
          priority: 2,
          description: 'Higher gas limit for premium users'
        }
      ],
      ...gasPolicy
    };

    this.initializeSponsorWallet();
    this.startGasUsageReset();
  }

  /**
   * Submit a sponsored transaction
   */
  async submitSponsoredTransaction(request: TransactionRequest): Promise<SponsoredTransaction> {
    try {
      const transactionId = randomUUID();
      
      // Validate session and capabilities
      await this.validateTransactionRequest(request);

      // Check gas limits
      await this.checkGasLimits(request.sessionToken.userId, request.transactionType);

      // Estimate gas
      const gasEstimate = await this.estimateGas(request);

      // Create sponsored transaction record
      const sponsoredTx: SponsoredTransaction = {
        transactionId,
        userId: request.sessionToken.userId,
        sessionId: request.sessionToken.sessionId,
        transactionType: request.transactionType,
        targetContract: request.targetContract,
        functionName: request.functionName,
        parameters: request.parameters,
        gasEstimate,
        gasSponsored: gasEstimate,
        status: 'pending',
        retryCount: 0,
        maxRetries: 3
      };

      this.pendingTransactions.set(transactionId, sponsoredTx);

      // Execute transaction
      await this.executeTransaction(sponsoredTx);

      logger.info('Sponsored transaction submitted', {
        transactionId,
        userId: request.sessionToken.userId,
        transactionType: request.transactionType,
        gasEstimate
      });

      return sponsoredTx;
    } catch (error: any) {
      logger.error('Failed to submit sponsored transaction', {
        error: error.message,
        userId: request.sessionToken.userId,
        transactionType: request.transactionType
      });
      throw error;
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(transactionId: string): Promise<SponsoredTransaction | null> {
    try {
      const transaction = this.pendingTransactions.get(transactionId);
      if (!transaction) {
        return null;
      }

      // If transaction has a digest, check on-chain status
      if (transaction.suiTransactionDigest && transaction.status === 'submitted') {
        await this.updateTransactionStatus(transaction);
      }

      return transaction;
    } catch (error: any) {
      logger.error('Failed to get transaction status', {
        error: error.message,
        transactionId
      });
      return null;
    }
  }

  /**
   * Retry failed transaction
   */
  async retryTransaction(transactionId: string): Promise<boolean> {
    try {
      const transaction = this.pendingTransactions.get(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== 'failed') {
        throw new Error('Transaction is not in failed state');
      }

      if (transaction.retryCount >= transaction.maxRetries) {
        throw new Error('Maximum retry attempts exceeded');
      }

      transaction.retryCount++;
      transaction.status = 'pending';
      transaction.error = undefined;

      await this.executeTransaction(transaction);

      logger.info('Transaction retry initiated', {
        transactionId,
        retryCount: transaction.retryCount
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to retry transaction', {
        error: error.message,
        transactionId
      });
      return false;
    }
  }

  /**
   * Get user gas usage
   */
  getUserGasUsage(userId: string): { daily: number; total: number; remaining: number } {
    const usage = this.userGasUsage.get(userId) || { daily: 0, total: 0, lastReset: new Date() };
    const remaining = Math.max(0, this.gasPolicy.maxGasPerUser - usage.total);
    
    return {
      daily: usage.daily,
      total: usage.total,
      remaining
    };
  }

  /**
   * Get transaction metrics
   */
  async getTransactionMetrics(): Promise<TransactionMetrics> {
    try {
      const transactions = Array.from(this.pendingTransactions.values());
      const totalTransactions = transactions.length;
      const sponsoredTransactions = transactions.filter(tx => tx.gasSponsored > 0).length;
      const totalGasSponsored = transactions.reduce((sum, tx) => sum + tx.gasSponsored, 0);
      const averageGasPerTransaction = totalTransactions > 0 ? totalGasSponsored / totalTransactions : 0;
      
      const successfulTransactions = transactions.filter(tx => tx.status === 'confirmed').length;
      const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;

      const failureReasons: Record<string, number> = {};
      transactions.filter(tx => tx.status === 'failed').forEach(tx => {
        const reason = tx.error || 'Unknown error';
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      });

      return {
        totalTransactions,
        sponsoredTransactions,
        totalGasSponsored,
        averageGasPerTransaction,
        successRate,
        failureReasons
      };
    } catch (error: any) {
      logger.error('Failed to get transaction metrics', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate transaction request
   */
  private async validateTransactionRequest(request: TransactionRequest): Promise<void> {
    // Validate session token (would integrate with SessionManager)
    if (!request.sessionToken.isActive) {
      throw new Error('Session is not active');
    }

    if (request.sessionToken.expiresAt < new Date()) {
      throw new Error('Session has expired');
    }

    // Validate capabilities if specified
    if (request.capabilities) {
      const hasRequiredCapabilities = request.capabilities.every(cap => 
        request.sessionToken.capabilities.includes(cap) ||
        request.sessionToken.capabilities.includes('*')
      );

      if (!hasRequiredCapabilities) {
        throw new Error('Insufficient capabilities for transaction');
      }
    }

    // Validate transaction type
    const validTransactionTypes = [
      'user_account::create_session',
      'user_account::validate_session',
      'user_account::revoke_session',
      'auth_policy::validate_auth_attempt',
      'recovery_policy::initiate_recovery',
      'credit_capability::mint_capability',
      'rwa_asset::mint_attestation',
      'crypto_vault::create_vault',
      'loan::create_loan'
    ];

    if (!validTransactionTypes.includes(request.transactionType)) {
      throw new Error(`Invalid transaction type: ${request.transactionType}`);
    }
  }

  /**
   * Check gas limits for user
   */
  private async checkGasLimits(userId: string, transactionType: string): Promise<void> {
    const usage = this.userGasUsage.get(userId) || { daily: 0, total: 0, lastReset: new Date() };

    // Check if transaction type is free
    if (this.gasPolicy.freeTransactionTypes.includes(transactionType)) {
      return;
    }

    // Check daily limit
    if (usage.daily >= this.gasPolicy.maxGasPerDay) {
      throw new Error('Daily gas limit exceeded');
    }

    // Check total user limit
    if (usage.total >= this.gasPolicy.maxGasPerUser) {
      throw new Error('User gas limit exceeded');
    }
  }

  /**
   * Estimate gas for transaction
   */
  private async estimateGas(request: TransactionRequest): Promise<number> {
    try {
      // Mock gas estimation - in production would use Sui client dry run
      const baseGas = 1000000; // 0.001 SUI base cost
      const complexityMultiplier = this.getTransactionComplexity(request.transactionType);
      
      return Math.min(baseGas * complexityMultiplier, this.gasPolicy.maxGasPerTransaction);
    } catch (error: any) {
      logger.error('Failed to estimate gas', {
        error: error.message,
        transactionType: request.transactionType
      });
      // Return conservative estimate on error
      return this.gasPolicy.maxGasPerTransaction;
    }
  }

  /**
   * Execute sponsored transaction
   */
  private async executeTransaction(transaction: SponsoredTransaction): Promise<void> {
    try {
      transaction.status = 'submitted';
      transaction.submittedAt = new Date();

      // Mock transaction execution - in production would build and execute Sui transaction
      const mockResult = await this.mockSuiTransactionExecution(transaction);
      
      transaction.suiTransactionDigest = mockResult.digest;
      transaction.status = 'confirmed';
      transaction.confirmedAt = new Date();

      // Update user gas usage
      this.updateUserGasUsage(transaction.userId, transaction.gasSponsored);

      logger.info('Sponsored transaction executed successfully', {
        transactionId: transaction.transactionId,
        digest: transaction.suiTransactionDigest,
        gasUsed: transaction.gasSponsored
      });
    } catch (error: any) {
      transaction.status = 'failed';
      transaction.error = error.message;

      logger.error('Sponsored transaction execution failed', {
        transactionId: transaction.transactionId,
        error: error.message,
        retryCount: transaction.retryCount
      });

      // Retry if possible
      if (transaction.retryCount < transaction.maxRetries) {
        setTimeout(() => {
          this.retryTransaction(transaction.transactionId);
        }, 5000 * (transaction.retryCount + 1)); // Exponential backoff
      }
    }
  }

  /**
   * Update transaction status from blockchain
   */
  private async updateTransactionStatus(transaction: SponsoredTransaction): Promise<void> {
    try {
      if (!transaction.suiTransactionDigest) {
        return;
      }

      // Mock blockchain status check - in production would query Sui network
      const isConfirmed = Math.random() > 0.1; // 90% success rate for mock

      if (isConfirmed) {
        transaction.status = 'confirmed';
        transaction.confirmedAt = new Date();
      } else {
        transaction.status = 'failed';
        transaction.error = 'Transaction failed on blockchain';
      }
    } catch (error: any) {
      logger.error('Failed to update transaction status', {
        error: error.message,
        transactionId: transaction.transactionId
      });
    }
  }

  /**
   * Get transaction complexity multiplier
   */
  private getTransactionComplexity(transactionType: string): number {
    const complexityMap: Record<string, number> = {
      'user_account::create_session': 1,
      'user_account::validate_session': 1,
      'user_account::revoke_session': 1,
      'auth_policy::validate_auth_attempt': 1.5,
      'recovery_policy::initiate_recovery': 2,
      'credit_capability::mint_capability': 3,
      'rwa_asset::mint_attestation': 4,
      'crypto_vault::create_vault': 3,
      'loan::create_loan': 5
    };

    return complexityMap[transactionType] || 2;
  }

  /**
   * Update user gas usage
   */
  private updateUserGasUsage(userId: string, gasUsed: number): void {
    const usage = this.userGasUsage.get(userId) || { daily: 0, total: 0, lastReset: new Date() };
    
    usage.daily += gasUsed;
    usage.total += gasUsed;
    
    this.userGasUsage.set(userId, usage);
  }

  /**
   * Mock Sui transaction execution
   */
  private async mockSuiTransactionExecution(transaction: SponsoredTransaction): Promise<{ digest: string }> {
    // Mock implementation - in production would build and execute real Sui transaction
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    
    return {
      digest: `0x${randomUUID().replace(/-/g, '')}`
    };
  }

  /**
   * Initialize sponsor wallet
   */
  private initializeSponsorWallet(): void {
    // Mock implementation - in production would initialize Sui keypair
    this.sponsorWallet = {
      address: '0x' + randomUUID().replace(/-/g, ''),
      balance: 1000000000000 // 1000 SUI in MIST
    };

    logger.info('Sponsor wallet initialized', {
      address: this.sponsorWallet.address,
      balance: this.sponsorWallet.balance
    });
  }

  /**
   * Start daily gas usage reset timer
   */
  private startGasUsageReset(): void {
    setInterval(() => {
      const now = new Date();
      for (const [userId, usage] of this.userGasUsage.entries()) {
        const daysSinceReset = Math.floor((now.getTime() - usage.lastReset.getTime()) / (24 * 60 * 60 * 1000));
        
        if (daysSinceReset >= 1) {
          usage.daily = 0;
          usage.lastReset = now;
          this.userGasUsage.set(userId, usage);
        }
      }
    }, 60 * 60 * 1000); // Check every hour
  }

  /**
   * Clean up completed transactions
   */
  async cleanup(): Promise<void> {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [transactionId, transaction] of this.pendingTransactions.entries()) {
      const age = now.getTime() - (transaction.submittedAt?.getTime() || now.getTime());
      
      if (age > maxAge && (transaction.status === 'confirmed' || transaction.status === 'failed')) {
        this.pendingTransactions.delete(transactionId);
      }
    }

    logger.debug('Transaction cleanup completed', {
      remainingTransactions: this.pendingTransactions.size
    });
  }

  /**
   * Get sponsor wallet balance
   */
  getSponsorWalletBalance(): number {
    return this.sponsorWallet?.balance || 0;
  }

  /**
   * Get gas policy
   */
  getGasPolicy(): GasPolicy {
    return { ...this.gasPolicy };
  }
}