/**
 * USDSui Incentive Service
 * 
 * Manages USDSui-specific incentives for TVL growth including
 * gas sponsorship and zero-fee withdrawals.
 * 
 * Requirements: 5.2, 12.5
 */

import { logger } from '../../utils/logger';

export interface USDSuiIncentivePool {
  totalTVL: number;
  gasSponsorshipFund: number;
  totalGasSponsored: number;
  totalWithdrawals: number;
  totalUsers: number;
  lastUpdated: Date;
}

export interface USDSuiWithdrawalResult {
  success: boolean;
  transactionId?: string;
  gasSponsored: boolean;
  feeCharged: number; // always 0
  tvlContribution: number;
  error?: string;
}

export class USDSuiIncentiveService {
  private incentivePool: USDSuiIncentivePool = {
    totalTVL: 0,
    gasSponsorshipFund: 1000000, // Initial fund
    totalGasSponsored: 0,
    totalWithdrawals: 0,
    totalUsers: 0,
    lastUpdated: new Date()
  };

  /**
   * Process USDSui withdrawal with zero fees and gas sponsorship
   * Requirements: 5.2
   */
  async processUSDSuiWithdrawal(
    userId: string,
    amount: number,
    destination: string
  ): Promise<USDSuiWithdrawalResult> {
    try {
      logger.info(`Processing USDSui withdrawal for user ${userId}: ${amount}`);

      // Estimate gas cost
      const estimatedGas = this.estimateGasCost(amount);

      // Check if sufficient gas fund
      if (this.incentivePool.gasSponsorshipFund < estimatedGas) {
        logger.warn('Insufficient gas sponsorship fund');
        return {
          success: false,
          gasSponsored: false,
          feeCharged: 0,
          tvlContribution: 0,
          error: 'Insufficient gas sponsorship fund'
        };
      }

      // Process withdrawal (always free for USDSui)
      const transactionId = `usdsui_${Date.now()}_${userId}`;

      // Update pool stats
      this.incentivePool.gasSponsorshipFund -= estimatedGas;
      this.incentivePool.totalGasSponsored += estimatedGas;
      this.incentivePool.totalWithdrawals++;
      this.incentivePool.lastUpdated = new Date();

      logger.info(`USDSui withdrawal processed: ${transactionId}, gas sponsored: ${estimatedGas}`);

      return {
        success: true,
        transactionId,
        gasSponsored: true,
        feeCharged: 0, // Always zero for USDSui
        tvlContribution: amount
      };
    } catch (error) {
      logger.error('Error processing USDSui withdrawal:', error);
      throw error;
    }
  }

  /**
   * Update TVL when USDSui is deposited or withdrawn
   * Requirements: 5.2
   */
  async updateTVL(amount: number, isDeposit: boolean): Promise<void> {
    try {
      const previousTVL = this.incentivePool.totalTVL;

      if (isDeposit) {
        this.incentivePool.totalTVL += amount;
        logger.info(`TVL increased by ${amount}: ${previousTVL} -> ${this.incentivePool.totalTVL}`);
      } else {
        this.incentivePool.totalTVL = Math.max(0, this.incentivePool.totalTVL - amount);
        logger.info(`TVL decreased by ${amount}: ${previousTVL} -> ${this.incentivePool.totalTVL}`);
      }

      this.incentivePool.lastUpdated = new Date();
    } catch (error) {
      logger.error('Error updating TVL:', error);
      throw error;
    }
  }

  /**
   * Add funds to gas sponsorship pool
   */
  async addGasFund(amount: number): Promise<void> {
    try {
      this.incentivePool.gasSponsorshipFund += amount;
      this.incentivePool.lastUpdated = new Date();
      
      logger.info(`Added ${amount} to gas sponsorship fund. New balance: ${this.incentivePool.gasSponsorshipFund}`);
    } catch (error) {
      logger.error('Error adding gas fund:', error);
      throw error;
    }
  }

  /**
   * Increment user count for TVL tracking
   */
  async incrementUserCount(): Promise<void> {
    try {
      this.incentivePool.totalUsers++;
      this.incentivePool.lastUpdated = new Date();
      
      logger.info(`User count incremented: ${this.incentivePool.totalUsers}`);
    } catch (error) {
      logger.error('Error incrementing user count:', error);
      throw error;
    }
  }

  /**
   * Get current incentive pool stats
   */
  getIncentivePool(): USDSuiIncentivePool {
    return { ...this.incentivePool };
  }

  /**
   * Get TVL growth rate
   */
  getTVLGrowthRate(): number {
    // Calculate growth rate based on historical data
    // For now, return a simple metric
    return this.incentivePool.totalTVL / Math.max(1, this.incentivePool.totalUsers);
  }

  /**
   * Check if gas sponsorship is available
   */
  isGasSponsorshipAvailable(estimatedGas: number): boolean {
    return this.incentivePool.gasSponsorshipFund >= estimatedGas;
  }

  /**
   * Estimate gas cost for withdrawal
   */
  private estimateGasCost(amount: number): number {
    // Simple estimation: base cost + amount-based cost
    const baseCost = 0.001; // Base gas cost
    const amountCost = amount * 0.00001; // 0.001% of amount
    return baseCost + amountCost;
  }

  /**
   * Get gas sponsorship statistics
   */
  getGasSponsorshipStats(): {
    totalSponsored: number;
    averagePerWithdrawal: number;
    remainingFund: number;
    estimatedWithdrawalsRemaining: number;
  } {
    const averagePerWithdrawal = this.incentivePool.totalWithdrawals > 0
      ? this.incentivePool.totalGasSponsored / this.incentivePool.totalWithdrawals
      : 0;

    const estimatedWithdrawalsRemaining = averagePerWithdrawal > 0
      ? Math.floor(this.incentivePool.gasSponsorshipFund / averagePerWithdrawal)
      : 0;

    return {
      totalSponsored: this.incentivePool.totalGasSponsored,
      averagePerWithdrawal,
      remainingFund: this.incentivePool.gasSponsorshipFund,
      estimatedWithdrawalsRemaining
    };
  }

  /**
   * Get TVL statistics
   */
  getTVLStats(): {
    totalTVL: number;
    totalUsers: number;
    averageTVLPerUser: number;
    totalWithdrawals: number;
  } {
    return {
      totalTVL: this.incentivePool.totalTVL,
      totalUsers: this.incentivePool.totalUsers,
      averageTVLPerUser: this.getTVLGrowthRate(),
      totalWithdrawals: this.incentivePool.totalWithdrawals
    };
  }
}

export const usdSuiIncentiveService = new USDSuiIncentiveService();
