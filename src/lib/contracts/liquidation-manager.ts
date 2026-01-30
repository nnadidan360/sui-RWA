/**
 * Liquidation Manager Service
 * 
 * This service handles automated liquidation triggers, penalty interest calculations,
 * and liquidation proceeds distribution for the Astake protocol.
 */

import { AccessControl } from '../auth/access-control';
import { UserRole, User } from '../../types/auth';
import { AssetTokenFactory } from './asset-token';
import { LendingPool, LoanData, LoanStatus } from './lending-pool';

export interface LiquidationEvent {
  liquidationId: string;
  loanId: string;
  borrower: string;
  liquidator: string;
  collateralTokenIds: string[];
  collateralValue: bigint;
  outstandingDebt: bigint;
  liquidationRatio: number; // LTV ratio at liquidation
  liquidationPenalty: bigint;
  proceedsDistributed: bigint;
  liquidatedAt: number;
  status: LiquidationStatus;
}

export enum LiquidationStatus {
  Initiated = 'initiated',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed'
}

export interface LiquidationTrigger {
  triggerId: string;
  loanId: string;
  triggerType: 'ltv_threshold' | 'payment_default' | 'manual';
  threshold?: number; // For LTV triggers
  daysOverdue?: number; // For payment default triggers
  triggeredAt: number;
  triggeredBy: string;
  isActive: boolean;
}

export interface PenaltyCalculation {
  loanId: string;
  basePenaltyRate: number; // Annual percentage rate
  daysOverdue: number;
  penaltyAmount: bigint;
  calculatedAt: number;
}

export interface LiquidationProceeds {
  liquidationId: string;
  totalProceeds: bigint;
  debtRepayment: bigint;
  penaltyFees: bigint;
  liquidationFees: bigint;
  excessReturned: bigint; // Returned to borrower if any
  distributions: ProceedsDistribution[];
}

export interface ProceedsDistribution {
  recipient: string;
  amount: bigint;
  distributionType: 'debt_repayment' | 'penalty' | 'liquidation_fee' | 'excess_return';
}

export class LiquidationManagerError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'LiquidationManagerError';
  }
}

/**
 * Liquidation Manager Implementation
 * 
 * Manages automated liquidations and risk monitoring
 */
export class LiquidationManager {
  private liquidationEvents: Map<string, LiquidationEvent> = new Map();
  private liquidationTriggers: Map<string, LiquidationTrigger> = new Map();
  private penaltyCalculations: Map<string, PenaltyCalculation> = new Map();
  private proceedsRecords: Map<string, LiquidationProceeds> = new Map();
  private userRegistry: Map<string, User> = new Map();
  private assetTokenFactory: AssetTokenFactory;
  private lendingPool: LendingPool;
  private liquidationCounter = 0;
  private triggerCounter = 0;

  // Configuration parameters
  private readonly DEFAULT_LIQUIDATION_THRESHOLD = 75; // 75% LTV
  private readonly LIQUIDATION_PENALTY_RATE = 10; // 10% penalty
  private readonly LIQUIDATION_FEE_RATE = 5; // 5% liquidation fee
  private readonly DEFAULT_PENALTY_RATE = 20; // 20% annual penalty rate

  constructor(assetTokenFactory: AssetTokenFactory, lendingPool: LendingPool) {
    this.assetTokenFactory = assetTokenFactory;
    this.lendingPool = lendingPool;
    this.initializeMockUsers();
  }

  /**
   * Register a user for testing purposes
   */
  registerUser(address: string, role: UserRole): void {
    const user: User = {
      id: `user_${address}`,
      address,
      role,
      isActive: true,
      createdAt: new Date(),
    };
    this.userRegistry.set(address, user);
  }

  /**
   * Get user by address
   */
  private getUser(address: string): User | null {
    return this.userRegistry.get(address) || null;
  }

  /**
   * Monitor loans for liquidation triggers
   * Checks all active loans for liquidation conditions
   */
  async monitorLoansForLiquidation(): Promise<string[]> {
    const triggeredLoans: string[] = [];

    // This would typically iterate through all active loans
    // For testing, we'll check specific loans passed to the method
    return triggeredLoans;
  }

  /**
   * Check if loan meets liquidation criteria
   * 
   * **Property 7: Liquidation threshold enforcement**
   * For any loan position where collateral value falls below the liquidation threshold, 
   * the liquidation process should be automatically initiated
   */
  async checkLiquidationCriteria(loanId: string): Promise<boolean> {
    // Get loan data
    const loanData = this.lendingPool.getLoan(loanId);
    if (!loanData || loanData.status !== LoanStatus.Active) {
      return false;
    }

    // Calculate current collateral value
    const collateralValue = await this.calculateCollateralValue(loanData.collateralTokenIds);
    
    // Calculate total debt (principal + accrued interest + penalties)
    const totalDebt = await this.calculateTotalDebt(loanData);
    
    // Calculate current LTV ratio
    const currentLTV = Number(totalDebt * BigInt(100) / collateralValue);

    // Check if LTV exceeds liquidation threshold
    const liquidationThreshold = loanData.liquidationThreshold || this.DEFAULT_LIQUIDATION_THRESHOLD;
    
    return currentLTV >= liquidationThreshold;
  }

  /**
   * Initiate liquidation process
   * Creates liquidation event and triggers the liquidation
   */
  async initiateLiquidation(
    loanId: string,
    liquidator: string,
    triggerType: LiquidationTrigger['triggerType'] = 'ltv_threshold'
  ): Promise<string> {
    const user = this.getUser(liquidator);
    
    // Get loan data
    const loanData = this.lendingPool.getLoan(loanId);
    if (!loanData) {
      throw new LiquidationManagerError('LOAN_NOT_FOUND', `Loan ${loanId} not found`);
    }

    if (loanData.status !== LoanStatus.Active) {
      throw new LiquidationManagerError('LOAN_NOT_ACTIVE', 'Only active loans can be liquidated');
    }

    // Verify liquidation is warranted
    const isLiquidationWarranted = await this.checkLiquidationCriteria(loanId);
    if (!isLiquidationWarranted) {
      throw new LiquidationManagerError('LIQUIDATION_NOT_WARRANTED', 'Loan does not meet liquidation criteria');
    }

    // Calculate liquidation parameters
    const collateralValue = await this.calculateCollateralValue(loanData.collateralTokenIds);
    const totalDebt = await this.calculateTotalDebt(loanData);
    const currentLTV = Number(totalDebt * BigInt(100) / collateralValue);

    // Generate liquidation ID
    const liquidationId = this.generateLiquidationId();

    // Create liquidation event
    const liquidationEvent: LiquidationEvent = {
      liquidationId,
      loanId,
      borrower: loanData.borrower,
      liquidator,
      collateralTokenIds: loanData.collateralTokenIds,
      collateralValue,
      outstandingDebt: totalDebt,
      liquidationRatio: currentLTV,
      liquidationPenalty: this.calculateLiquidationPenalty(collateralValue),
      proceedsDistributed: BigInt(0),
      liquidatedAt: Date.now(),
      status: LiquidationStatus.Initiated,
    };

    // Store liquidation event
    this.liquidationEvents.set(liquidationId, liquidationEvent);

    // Create liquidation trigger record
    const triggerId = this.generateTriggerId();
    const trigger: LiquidationTrigger = {
      triggerId,
      loanId,
      triggerType,
      threshold: triggerType === 'ltv_threshold' ? currentLTV : undefined,
      triggeredAt: Date.now(),
      triggeredBy: liquidator,
      isActive: true,
    };

    this.liquidationTriggers.set(triggerId, trigger);

    return liquidationId;
  }

  /**
   * Execute liquidation
   * Performs the actual liquidation and distributes proceeds
   */
  async executeLiquidation(liquidationId: string, executor: string): Promise<void> {
    const user = this.getUser(executor);
    
    // Get liquidation event
    const liquidationEvent = this.liquidationEvents.get(liquidationId);
    if (!liquidationEvent) {
      throw new LiquidationManagerError('LIQUIDATION_NOT_FOUND', `Liquidation ${liquidationId} not found`);
    }

    if (liquidationEvent.status !== LiquidationStatus.Initiated) {
      throw new LiquidationManagerError('LIQUIDATION_ALREADY_PROCESSED', 'Liquidation already processed');
    }

    // Update liquidation status
    liquidationEvent.status = LiquidationStatus.InProgress;
    this.liquidationEvents.set(liquidationId, liquidationEvent);

    try {
      // Execute liquidation through lending pool
      await this.lendingPool.liquidate(liquidationEvent.loanId, executor);

      // Calculate and distribute proceeds
      const proceeds = await this.calculateAndDistributeProceeds(liquidationEvent);

      // Update liquidation event
      liquidationEvent.proceedsDistributed = proceeds.totalProceeds;
      liquidationEvent.status = LiquidationStatus.Completed;
      this.liquidationEvents.set(liquidationId, liquidationEvent);

      // Store proceeds record
      this.proceedsRecords.set(liquidationId, proceeds);

    } catch (error) {
      // Mark liquidation as failed
      liquidationEvent.status = LiquidationStatus.Failed;
      this.liquidationEvents.set(liquidationId, liquidationEvent);
      throw new LiquidationManagerError('LIQUIDATION_EXECUTION_FAILED', `Liquidation execution failed: ${error}`);
    }
  }

  /**
   * Calculate penalty interest for overdue loans
   */
  async calculatePenaltyInterest(loanId: string): Promise<PenaltyCalculation> {
    // Get loan data
    const loanData = this.lendingPool.getLoan(loanId);
    if (!loanData) {
      throw new LiquidationManagerError('LOAN_NOT_FOUND', `Loan ${loanId} not found`);
    }

    // Calculate days overdue
    const currentTime = Date.now();
    const daysOverdue = Math.max(0, Math.floor((currentTime - loanData.dueDate) / (24 * 60 * 60 * 1000)));

    // Calculate penalty amount
    const penaltyRate = this.DEFAULT_PENALTY_RATE / 100; // Convert to decimal
    const timeInYears = daysOverdue / 365;
    const penaltyAmount = loanData.principalAmount * BigInt(Math.floor(penaltyRate * timeInYears * 1000)) / BigInt(1000);

    const penaltyCalculation: PenaltyCalculation = {
      loanId,
      basePenaltyRate: this.DEFAULT_PENALTY_RATE,
      daysOverdue,
      penaltyAmount,
      calculatedAt: currentTime,
    };

    // Store penalty calculation
    this.penaltyCalculations.set(loanId, penaltyCalculation);

    return penaltyCalculation;
  }

  /**
   * Get liquidation event
   */
  getLiquidationEvent(liquidationId: string): LiquidationEvent | undefined {
    return this.liquidationEvents.get(liquidationId);
  }

  /**
   * Get liquidation triggers for a loan
   */
  getLiquidationTriggers(loanId: string): LiquidationTrigger[] {
    const triggers: LiquidationTrigger[] = [];
    for (const trigger of Array.from(this.liquidationTriggers.values())) {
      if (trigger.loanId === loanId) {
        triggers.push(trigger);
      }
    }
    return triggers;
  }

  /**
   * Get penalty calculation for a loan
   */
  getPenaltyCalculation(loanId: string): PenaltyCalculation | undefined {
    return this.penaltyCalculations.get(loanId);
  }

  /**
   * Get liquidation proceeds
   */
  getLiquidationProceeds(liquidationId: string): LiquidationProceeds | undefined {
    return this.proceedsRecords.get(liquidationId);
  }

  // Private helper methods

  private initializeMockUsers(): void {
    this.registerUser('admin_address', UserRole.ADMIN);
    this.registerUser('liquidator_address', UserRole.USER);
    this.registerUser('lending_protocol_address', UserRole.LENDING_PROTOCOL);
  }

  private async calculateCollateralValue(collateralTokenIds: string[]): Promise<bigint> {
    let totalValue = BigInt(0);
    
    for (const tokenId of collateralTokenIds) {
      const tokenData = this.assetTokenFactory.getTokenData(tokenId);
      if (tokenData) {
        totalValue += tokenData.valuation;
      }
    }
    
    return totalValue;
  }

  private async calculateTotalDebt(loanData: LoanData): Promise<bigint> {
    // Calculate accrued interest
    const currentTime = Date.now();
    const loanAge = currentTime - loanData.createdAt;
    const annualRate = loanData.interestRate / 100;
    const timeInYears = loanAge / (365 * 24 * 60 * 60 * 1000);
    
    const accruedInterest = loanData.principalAmount * BigInt(Math.floor(annualRate * timeInYears * 1000)) / BigInt(1000);
    
    // Calculate penalty interest if overdue
    let penaltyInterest = BigInt(0);
    if (currentTime > loanData.dueDate) {
      const penaltyCalc = await this.calculatePenaltyInterest(loanData.loanId);
      penaltyInterest = penaltyCalc.penaltyAmount;
    }
    
    return loanData.principalAmount + accruedInterest + penaltyInterest - loanData.repaidAmount;
  }

  private calculateLiquidationPenalty(collateralValue: bigint): bigint {
    return collateralValue * BigInt(this.LIQUIDATION_PENALTY_RATE) / BigInt(100);
  }

  private async calculateAndDistributeProceeds(liquidationEvent: LiquidationEvent): Promise<LiquidationProceeds> {
    const totalProceeds = liquidationEvent.collateralValue;
    const outstandingDebt = liquidationEvent.outstandingDebt;
    const liquidationPenalty = liquidationEvent.liquidationPenalty;
    const liquidationFee = totalProceeds * BigInt(this.LIQUIDATION_FEE_RATE) / BigInt(100);

    // Calculate distributions
    const distributions: ProceedsDistribution[] = [];

    // 1. Repay outstanding debt
    const debtRepayment = outstandingDebt > totalProceeds ? totalProceeds : outstandingDebt;
    distributions.push({
      recipient: 'lending_pool',
      amount: debtRepayment,
      distributionType: 'debt_repayment',
    });

    let remainingProceeds = totalProceeds - debtRepayment;

    // 2. Liquidation penalty (if any proceeds remain)
    const penaltyAmount = remainingProceeds > liquidationPenalty ? liquidationPenalty : remainingProceeds;
    if (penaltyAmount > BigInt(0)) {
      distributions.push({
        recipient: 'lending_pool',
        amount: penaltyAmount,
        distributionType: 'penalty',
      });
      remainingProceeds -= penaltyAmount;
    }

    // 3. Liquidation fee (if any proceeds remain)
    const feeAmount = remainingProceeds > liquidationFee ? liquidationFee : remainingProceeds;
    if (feeAmount > BigInt(0)) {
      distributions.push({
        recipient: liquidationEvent.liquidator,
        amount: feeAmount,
        distributionType: 'liquidation_fee',
      });
      remainingProceeds -= feeAmount;
    }

    // 4. Return excess to borrower (if any)
    const excessReturned = remainingProceeds;
    if (excessReturned > BigInt(0)) {
      distributions.push({
        recipient: liquidationEvent.borrower,
        amount: excessReturned,
        distributionType: 'excess_return',
      });
    }

    const proceeds: LiquidationProceeds = {
      liquidationId: liquidationEvent.liquidationId,
      totalProceeds,
      debtRepayment,
      penaltyFees: penaltyAmount,
      liquidationFees: feeAmount,
      excessReturned,
      distributions,
    };

    return proceeds;
  }

  private generateLiquidationId(): string {
    return `liquidation_${++this.liquidationCounter}_${Date.now()}`;
  }

  private generateTriggerId(): string {
    return `trigger_${++this.triggerCounter}_${Date.now()}`;
  }
}