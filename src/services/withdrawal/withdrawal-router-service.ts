/**
 * Withdrawal Router Service
 * 
 * Manages dynamic withdrawal routing for crypto and card payments with
 * first-time user incentives and fraud prevention.
 * 
 * Requirements: 5.1, 5.3, 5.4
 */

import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import { fraudDetectionService } from '../credit/fraud-detection-service';

export interface WithdrawalRequest {
  userId: string;
  amount: number;
  method: 'crypto' | 'card' | 'usdsui';
  destination: string;
  deviceFingerprint?: {
    deviceId: string;
    ipAddress: string;
    userAgent: string;
  };
}

export interface WithdrawalPolicy {
  userId: string;
  freeCryptoWithdrawalsRemaining: number;
  totalCryptoWithdrawals: number;
  freeCardMaintenanceUntil: Date;
  cardMaintenanceFeePaid: number;
  totalUsdSuiWithdrawals: number;
  dailyWithdrawalLimit: number;
  dailyWithdrawalUsed: number;
  lastWithdrawalDate: Date;
}

export interface WithdrawalResult {
  success: boolean;
  transactionId?: string;
  gasSponsored: boolean;
  feeCharged: number;
  incentiveUsed?: string;
  error?: string;
}

export class WithdrawalRouterService {
  private readonly CRYPTO_FEE_PERCENT = 0.005; // 0.5%
  private readonly CARD_FEE_PERCENT = 0.02; // 2%
  private readonly CARD_MONTHLY_FEE = 10; // $10/month
  private readonly DEFAULT_DAILY_LIMIT = 10000; // $10,000

  /**
   * Route withdrawal request to appropriate method
   * Requirements: 5.1, 5.3
   */
  async routeWithdrawal(request: WithdrawalRequest): Promise<WithdrawalResult> {
    try {
      logger.info(`Routing withdrawal for user ${request.userId}: ${request.method}`);

      // Get or create withdrawal policy
      const policy = await this.getOrCreatePolicy(request.userId);

      // Fraud detection check
      if (request.deviceFingerprint) {
        const fraudCheck = await fraudDetectionService.detectFraud(request.userId, {
          userId: request.userId,
          activityType: 'withdrawal',
          deviceFingerprint: {
            deviceId: request.deviceFingerprint.deviceId,
            browserFingerprint: '',
            ipAddress: request.deviceFingerprint.ipAddress,
            userAgent: request.deviceFingerprint.userAgent
          },
          metadata: {
            amount: request.amount,
            method: request.method,
            destination: request.destination
          },
          timestamp: new Date()
        });

        if (fraudCheck.recommendedAction === 'block' || fraudCheck.recommendedAction === 'freeze') {
          return {
            success: false,
            gasSponsored: false,
            feeCharged: 0,
            error: 'Withdrawal blocked due to fraud detection'
          };
        }
      }

      // Check daily limit
      this.checkAndResetDailyLimit(policy);
      if (policy.dailyWithdrawalUsed + request.amount > policy.dailyWithdrawalLimit) {
        return {
          success: false,
          gasSponsored: false,
          feeCharged: 0,
          error: 'Daily withdrawal limit exceeded'
        };
      }

      // Route to appropriate method
      let result: WithdrawalResult;
      switch (request.method) {
        case 'crypto':
          result = await this.processCryptoWithdrawal(request, policy);
          break;
        case 'card':
          result = await this.processCardWithdrawal(request, policy);
          break;
        case 'usdsui':
          result = await this.processUsdSuiWithdrawal(request, policy);
          break;
        default:
          throw new Error(`Invalid withdrawal method: ${request.method}`);
      }

      // Update policy if successful
      if (result.success) {
        await this.updatePolicy(request.userId, policy, request.amount);
      }

      return result;
    } catch (error) {
      logger.error('Error routing withdrawal:', error);
      throw error;
    }
  }

  /**
   * Process crypto withdrawal with first 3 free
   * Requirements: 5.1
   */
  private async processCryptoWithdrawal(
    request: WithdrawalRequest,
    policy: WithdrawalPolicy
  ): Promise<WithdrawalResult> {
    const gasSponsored = policy.freeCryptoWithdrawalsRemaining > 0;
    const feeCharged = gasSponsored ? 0 : request.amount * this.CRYPTO_FEE_PERCENT;

    // Update incentive tracking
    if (gasSponsored) {
      policy.freeCryptoWithdrawalsRemaining--;
    }
    policy.totalCryptoWithdrawals++;

    // TODO: Integrate with actual crypto withdrawal service
    const transactionId = `crypto_tx_${Date.now()}`;

    logger.info(`Crypto withdrawal processed: ${transactionId}, gas sponsored: ${gasSponsored}`);

    return {
      success: true,
      transactionId,
      gasSponsored,
      feeCharged,
      incentiveUsed: gasSponsored ? 'free_crypto_withdrawal' : undefined
    };
  }

  /**
   * Process card withdrawal with 1 month free maintenance
   * Requirements: 5.3
   */
  private async processCardWithdrawal(
    request: WithdrawalRequest,
    policy: WithdrawalPolicy
  ): Promise<WithdrawalResult> {
    const now = new Date();
    const isFreePeriod = now < policy.freeCardMaintenanceUntil;
    const feeCharged = isFreePeriod ? 0 : request.amount * this.CARD_FEE_PERCENT;

    // Track maintenance fees
    if (!isFreePeriod) {
      policy.cardMaintenanceFeePaid += feeCharged;
    }

    // TODO: Integrate with actual card payment service
    const transactionId = `card_tx_${Date.now()}`;

    logger.info(`Card withdrawal processed: ${transactionId}, free period: ${isFreePeriod}`);

    return {
      success: true,
      transactionId,
      gasSponsored: false,
      feeCharged,
      incentiveUsed: isFreePeriod ? 'free_card_maintenance' : undefined
    };
  }

  /**
   * Process USDSui withdrawal (always free)
   * Requirements: 5.2
   */
  private async processUsdSuiWithdrawal(
    request: WithdrawalRequest,
    policy: WithdrawalPolicy
  ): Promise<WithdrawalResult> {
    // USDSui withdrawals are always free with gas sponsorship
    policy.totalUsdSuiWithdrawals++;

    // TODO: Integrate with actual USDSui withdrawal service
    const transactionId = `usdsui_tx_${Date.now()}`;

    logger.info(`USDSui withdrawal processed: ${transactionId}, always free`);

    return {
      success: true,
      transactionId,
      gasSponsored: true,
      feeCharged: 0,
      incentiveUsed: 'usdsui_free_withdrawal'
    };
  }

  /**
   * Get or create withdrawal policy for user
   */
  private async getOrCreatePolicy(userId: string): Promise<WithdrawalPolicy> {
    const user = await User.findOne({ internalUserId: userId });
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Check if policy exists in activity log
    const policyActivity = user.activityLog.find(
      (log: any) => log.action === 'withdrawal_policy_created'
    );

    if (policyActivity && policyActivity.details.policy) {
      return policyActivity.details.policy;
    }

    // Create new policy with first-time incentives
    const now = new Date();
    const policy: WithdrawalPolicy = {
      userId,
      freeCryptoWithdrawalsRemaining: 3,
      totalCryptoWithdrawals: 0,
      freeCardMaintenanceUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
      cardMaintenanceFeePaid: 0,
      totalUsdSuiWithdrawals: 0,
      dailyWithdrawalLimit: this.DEFAULT_DAILY_LIMIT,
      dailyWithdrawalUsed: 0,
      lastWithdrawalDate: now
    };

    // Store policy in user activity log
    user.logActivity('withdrawal_policy_created', { policy });
    await user.save();

    logger.info(`Created withdrawal policy for user ${userId}`);
    return policy;
  }

  /**
   * Update withdrawal policy after successful withdrawal
   */
  private async updatePolicy(
    userId: string,
    policy: WithdrawalPolicy,
    amount: number
  ): Promise<void> {
    const user = await User.findOne({ internalUserId: userId });
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Update daily usage
    policy.dailyWithdrawalUsed += amount;
    policy.lastWithdrawalDate = new Date();

    // Update policy in activity log
    const policyIndex = user.activityLog.findIndex(
      (log: any) => log.action === 'withdrawal_policy_created'
    );

    if (policyIndex >= 0) {
      user.activityLog[policyIndex].details.policy = policy;
    } else {
      user.logActivity('withdrawal_policy_created', { policy });
    }

    // Log withdrawal
    user.logActivity('withdrawal_processed', {
      amount,
      method: policy,
      timestamp: new Date()
    });

    await user.save();
  }

  /**
   * Check and reset daily limits if new day
   */
  private checkAndResetDailyLimit(policy: WithdrawalPolicy): void {
    const now = new Date();
    const lastWithdrawal = new Date(policy.lastWithdrawalDate);
    
    // Check if it's a new day
    if (now.getDate() !== lastWithdrawal.getDate() ||
        now.getMonth() !== lastWithdrawal.getMonth() ||
        now.getFullYear() !== lastWithdrawal.getFullYear()) {
      policy.dailyWithdrawalUsed = 0;
      policy.lastWithdrawalDate = now;
    }
  }

  /**
   * Get withdrawal policy for user
   */
  async getPolicy(userId: string): Promise<WithdrawalPolicy | null> {
    try {
      const user = await User.findOne({ internalUserId: userId });
      if (!user) {
        return null;
      }

      const policyActivity = user.activityLog.find(
        (log: any) => log.action === 'withdrawal_policy_created'
      );

      return policyActivity?.details.policy || null;
    } catch (error) {
      logger.error('Error getting withdrawal policy:', error);
      return null;
    }
  }

  /**
   * Update daily withdrawal limit
   */
  async updateDailyLimit(userId: string, newLimit: number): Promise<void> {
    try {
      const policy = await this.getOrCreatePolicy(userId);
      policy.dailyWithdrawalLimit = newLimit;
      await this.updatePolicy(userId, policy, 0);
      
      logger.info(`Updated daily limit for user ${userId}: ${newLimit}`);
    } catch (error) {
      logger.error('Error updating daily limit:', error);
      throw error;
    }
  }
}

export const withdrawalRouterService = new WithdrawalRouterService();
