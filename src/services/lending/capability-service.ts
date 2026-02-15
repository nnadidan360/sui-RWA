import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiClient } from '@mysten/sui.js/client';
import { logger } from '../../utils/logger';

/**
 * Capability status
 */
export enum CapabilityStatus {
  ACTIVE = 0,
  SUSPENDED = 1,
  REVOKED = 2,
  EXPIRED = 3,
}

/**
 * Collateral type
 */
export enum CollateralType {
  RWA = 'rwa',
  CRYPTO = 'crypto',
  MIXED = 'mixed',
}

/**
 * Borrowing capability information
 */
export interface BorrowingCapabilityInfo {
  capabilityId: string;
  ownerAccountId: string;
  creditLimitUsd: number;
  usedCreditUsd: number;
  availableCreditUsd: number;
  interestRateBps: number;
  collateralType: CollateralType;
  collateralRefs: string[];
  issuedAt: number;
  expiresAt: number;
  lastUpdated: number;
  status: CapabilityStatus;
  riskScore: number;
}

/**
 * Eligibility criteria for capability issuance
 */
export interface EligibilityCriteria {
  minCreditScore: number;
  maxRiskScore: number;
  minCollateralValue: number;
  requiredVerifications: string[];
}

/**
 * Capability issuance parameters
 */
export interface IssueCapabilityParams {
  ownerAccountId: string;
  creditLimitUsd: number;
  interestRateBps: number;
  collateralType: CollateralType;
  collateralRefs: string[];
  validityDurationMs: number;
  riskScore: number;
}

/**
 * Service for managing borrowing capabilities
 */
export class CapabilityService {
  private suiClient: SuiClient;
  private packageId: string;
  private clockObjectId: string;

  constructor(
    suiClient: SuiClient,
    packageId: string,
    clockObjectId: string = '0x6'
  ) {
    this.suiClient = suiClient;
    this.packageId = packageId;
    this.clockObjectId = clockObjectId;
  }

  /**
   * Check eligibility for borrowing capability
   */
  async checkEligibility(
    userId: string,
    collateralValue: number,
    creditScore: number,
    riskScore: number,
    verifications: string[]
  ): Promise<{
    eligible: boolean;
    reasons: string[];
    maxCreditLimit?: number;
    suggestedInterestRate?: number;
  }> {
    const reasons: string[] = [];
    let eligible = true;

    // Define eligibility criteria
    const criteria: EligibilityCriteria = {
      minCreditScore: 600,
      maxRiskScore: 70,
      minCollateralValue: 1000, // $1,000 minimum
      requiredVerifications: ['identity', 'address'],
    };

    // Check credit score
    if (creditScore < criteria.minCreditScore) {
      eligible = false;
      reasons.push(`Credit score ${creditScore} below minimum ${criteria.minCreditScore}`);
    }

    // Check risk score
    if (riskScore > criteria.maxRiskScore) {
      eligible = false;
      reasons.push(`Risk score ${riskScore} exceeds maximum ${criteria.maxRiskScore}`);
    }

    // Check collateral value
    if (collateralValue < criteria.minCollateralValue) {
      eligible = false;
      reasons.push(`Collateral value $${collateralValue} below minimum $${criteria.minCollateralValue}`);
    }

    // Check verifications
    for (const required of criteria.requiredVerifications) {
      if (!verifications.includes(required)) {
        eligible = false;
        reasons.push(`Missing required verification: ${required}`);
      }
    }

    if (!eligible) {
      return { eligible, reasons };
    }

    // Calculate max credit limit based on collateral (50% LTV for conservative approach)
    const maxCreditLimit = collateralValue * 0.5;

    // Calculate interest rate based on risk score (5% base + risk adjustment)
    const baseRate = 500; // 5% in bps
    const riskAdjustment = Math.floor((riskScore / 100) * 500); // Up to 5% additional
    const suggestedInterestRate = baseRate + riskAdjustment;

    logger.info('Eligibility check passed', {
      userId,
      maxCreditLimit,
      suggestedInterestRate,
    });

    return {
      eligible: true,
      reasons: ['All eligibility criteria met'],
      maxCreditLimit,
      suggestedInterestRate,
    };
  }

  /**
   * Issue a new borrowing capability
   */
  async issueCapability(
    params: IssueCapabilityParams,
    signerAddress: string
  ): Promise<{
    success: boolean;
    capabilityId?: string;
    error?: string;
  }> {
    try {
      logger.info('Issuing borrowing capability', {
        ownerAccountId: params.ownerAccountId,
        creditLimit: params.creditLimitUsd,
        collateralType: params.collateralType,
      });

      const tx = new TransactionBlock();

      // Convert values to smallest units
      const creditLimitCents = Math.round(params.creditLimitUsd * 100);

      const [capability] = tx.moveCall({
        target: `${this.packageId}::credit_capability::issue_capability`,
        arguments: [
          tx.pure(params.ownerAccountId),
          tx.pure(creditLimitCents),
          tx.pure(params.interestRateBps),
          tx.pure(params.collateralType),
          tx.pure(params.collateralRefs),
          tx.pure(params.validityDurationMs),
          tx.pure(params.riskScore),
          tx.object(this.clockObjectId),
        ],
      });

      // Transfer capability to owner
      tx.transferObjects([capability], tx.pure(signerAddress));

      logger.info('Capability issuance transaction prepared', {
        ownerAccountId: params.ownerAccountId,
      });

      return {
        success: true,
        capabilityId: 'pending',
      };
    } catch (error) {
      logger.error('Failed to issue capability', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ownerAccountId: params.ownerAccountId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Use capability to borrow
   */
  async useCapability(
    capabilityObjectId: string,
    amount: number,
    loanId: string,
    signerAddress: string
  ): Promise<{
    success: boolean;
    usedCredit?: number;
    availableCredit?: number;
    error?: string;
  }> {
    try {
      logger.info('Using borrowing capability', {
        capabilityId: capabilityObjectId,
        amount,
        loanId,
      });

      const amountCents = Math.round(amount * 100);

      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.packageId}::credit_capability::use_capability`,
        arguments: [
          tx.object(capabilityObjectId),
          tx.pure(amountCents),
          tx.pure(loanId),
          tx.object(this.clockObjectId),
        ],
      });

      logger.info('Use capability transaction prepared', {
        capabilityId: capabilityObjectId,
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to use capability', {
        error: error instanceof Error ? error.message : 'Unknown error',
        capabilityId: capabilityObjectId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Restore credit after repayment
   */
  async restoreCredit(
    capabilityObjectId: string,
    amount: number,
    signerAddress: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      logger.info('Restoring credit to capability', {
        capabilityId: capabilityObjectId,
        amount,
      });

      const amountCents = Math.round(amount * 100);

      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.packageId}::credit_capability::restore_credit`,
        arguments: [
          tx.object(capabilityObjectId),
          tx.pure(amountCents),
          tx.object(this.clockObjectId),
        ],
      });

      logger.info('Restore credit transaction prepared', {
        capabilityId: capabilityObjectId,
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to restore credit', {
        error: error instanceof Error ? error.message : 'Unknown error',
        capabilityId: capabilityObjectId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Revoke capability (for fraud cases)
   */
  async revokeCapability(
    capabilityObjectId: string,
    reason: string,
    signerAddress: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      logger.info('Revoking capability', {
        capabilityId: capabilityObjectId,
        reason,
      });

      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.packageId}::credit_capability::revoke_capability`,
        arguments: [
          tx.object(capabilityObjectId),
          tx.pure(reason),
          tx.object(this.clockObjectId),
        ],
      });

      logger.info('Revoke capability transaction prepared', {
        capabilityId: capabilityObjectId,
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to revoke capability', {
        error: error instanceof Error ? error.message : 'Unknown error',
        capabilityId: capabilityObjectId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check capability expiration
   */
  async checkExpiration(
    capabilityObjectId: string,
    signerAddress: string
  ): Promise<{
    success: boolean;
    expired?: boolean;
    error?: string;
  }> {
    try {
      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.packageId}::credit_capability::check_expiration`,
        arguments: [
          tx.object(capabilityObjectId),
          tx.object(this.clockObjectId),
        ],
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to check expiration', {
        error: error instanceof Error ? error.message : 'Unknown error',
        capabilityId: capabilityObjectId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get capability information
   */
  async getCapabilityInfo(capabilityObjectId: string): Promise<BorrowingCapabilityInfo | null> {
    try {
      const capabilityObject = await this.suiClient.getObject({
        id: capabilityObjectId,
        options: {
          showContent: true,
        },
      });

      if (!capabilityObject.data || !capabilityObject.data.content) {
        return null;
      }

      // Parse capability data from on-chain object
      // In production, properly parse the Move object structure
      return null;
    } catch (error) {
      logger.error('Failed to get capability info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        capabilityId: capabilityObjectId,
      });
      return null;
    }
  }

  /**
   * Calculate utilization rate
   */
  calculateUtilization(usedCredit: number, creditLimit: number): number {
    if (creditLimit === 0) return 0;
    return (usedCredit / creditLimit) * 100;
  }

  /**
   * Validate capability for loan
   */
  async validateForLoan(
    capabilityObjectId: string,
    requestedAmount: number
  ): Promise<{
    valid: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];

    try {
      const info = await this.getCapabilityInfo(capabilityObjectId);

      if (!info) {
        return {
          valid: false,
          reasons: ['Capability not found'],
        };
      }

      // Check status
      if (info.status !== CapabilityStatus.ACTIVE) {
        reasons.push('Capability is not active');
      }

      // Check expiration
      if (Date.now() >= info.expiresAt) {
        reasons.push('Capability has expired');
      }

      // Check available credit
      if (requestedAmount > info.availableCreditUsd) {
        reasons.push(`Requested amount $${requestedAmount} exceeds available credit $${info.availableCreditUsd}`);
      }

      return {
        valid: reasons.length === 0,
        reasons: reasons.length > 0 ? reasons : ['Capability is valid for loan'],
      };
    } catch (error) {
      return {
        valid: false,
        reasons: ['Error validating capability'],
      };
    }
  }
}
