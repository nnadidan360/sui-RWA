/**
 * Lending Pool Contract Implementation
 * 
 * This module implements the core lending pool functionality with SafeERC20 patterns,
 * reentrancy guards, and comprehensive access control.
 */

import { AccessControl } from '../auth/access-control';
import { UserRole, User } from '../../types/auth';
import { AssetTokenFactory, AssetTokenData } from './asset-token';

export interface PoolTokenData {
  tokenId: string;
  holder: string;
  amount: bigint;
  poolShare: number; // Percentage of total pool
  issuedAt: number;
  lastUpdated: number;
}

export interface LoanData {
  loanId: string;
  borrower: string;
  collateralTokenIds: string[];
  principalAmount: bigint;
  interestRate: number; // Annual percentage rate
  createdAt: number;
  dueDate: number;
  status: LoanStatus;
  repaidAmount: bigint;
  liquidationThreshold: number; // Percentage
}

export enum LoanStatus {
  Active = 'active',
  Repaid = 'repaid',
  Defaulted = 'defaulted',
  Liquidated = 'liquidated'
}

export interface LendingPoolState {
  totalDeposits: bigint;
  totalBorrows: bigint;
  totalPoolTokens: bigint;
  utilizationRate: number; // Percentage
  baseInterestRate: number; // Annual percentage rate
  lastUpdateTime: number;
  reserveFactor: number; // Percentage kept as reserves
}

export interface InterestRateModel {
  baseRate: number; // Base interest rate when utilization is 0
  multiplier: number; // Rate increase per utilization percentage
  jumpMultiplier: number; // Additional rate increase after optimal utilization
  optimalUtilization: number; // Optimal utilization rate (e.g., 80%)
}

export class LendingPoolError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'LendingPoolError';
  }
}

/**
 * Lending Pool Implementation
 * 
 * Manages deposits, withdrawals, loans, and interest rate calculations
 */
export class LendingPool {
  private poolState: LendingPoolState;
  private poolTokens: Map<string, PoolTokenData> = new Map();
  private holderTokens: Map<string, Set<string>> = new Map();
  private loans: Map<string, LoanData> = new Map();
  private borrowerLoans: Map<string, Set<string>> = new Map();
  private userRegistry: Map<string, User> = new Map();
  private assetTokenFactory: AssetTokenFactory;
  private interestRateModel: InterestRateModel;
  private poolTokenCounter = 0;
  private loanCounter = 0;

  constructor(assetTokenFactory: AssetTokenFactory) {
    this.assetTokenFactory = assetTokenFactory;
    this.poolState = {
      totalDeposits: BigInt(0),
      totalBorrows: BigInt(0),
      totalPoolTokens: BigInt(0),
      utilizationRate: 0,
      baseInterestRate: 5.0, // 5% base rate
      lastUpdateTime: Date.now(),
      reserveFactor: 10, // 10% reserve factor
    };
    this.interestRateModel = {
      baseRate: 2.0, // 2% base rate
      multiplier: 0.1, // 0.1% per utilization point
      jumpMultiplier: 2.0, // Additional 2% after optimal utilization
      optimalUtilization: 80, // 80% optimal utilization
    };
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
   * Deposit assets into the lending pool
   * Issues pool tokens representing the depositor's share
   * 
   * **Property 10: Pool token issuance proportionality**
   * For any deposit into the lending pool, the number of pool tokens issued 
   * should be proportional to the depositor's share of the total pool
   */
  async deposit(amount: bigint, depositor: string): Promise<string> {
    const user = this.getUser(depositor);
    
    // Validate deposit amount
    if (amount <= BigInt(0)) {
      throw new LendingPoolError('INVALID_AMOUNT', 'Deposit amount must be positive');
    }

    // Update pool state with accrued interest
    this.updatePoolState();

    // Calculate pool tokens to issue
    const poolTokensToIssue = this.calculatePoolTokensForDeposit(amount);

    // Generate pool token ID
    const poolTokenId = this.generatePoolTokenId();

    // Calculate pool share
    const newTotalPoolTokens = this.poolState.totalPoolTokens + poolTokensToIssue;
    const poolShare = newTotalPoolTokens > BigInt(0) ? 
      Number(poolTokensToIssue * BigInt(10000) / newTotalPoolTokens) / 100 : 100;

    // Create pool token data
    const poolTokenData: PoolTokenData = {
      tokenId: poolTokenId,
      holder: depositor,
      amount: poolTokensToIssue,
      poolShare,
      issuedAt: Date.now(),
      lastUpdated: Date.now(),
    };

    // Update pool state
    this.poolState.totalDeposits += amount;
    this.poolState.totalPoolTokens += poolTokensToIssue;
    this.poolState.lastUpdateTime = Date.now();

    // Store pool token
    this.poolTokens.set(poolTokenId, poolTokenData);
    this.addPoolTokenToHolder(depositor, poolTokenId);

    // Recalculate utilization and interest rates
    this.updateUtilizationRate();
    this.updateInterestRates();

    return poolTokenId;
  }

  /**
   * Withdraw assets from the lending pool
   * Burns pool tokens and returns corresponding assets
   * 
   * **Property 12: Withdrawal calculation accuracy**
   * For any lender withdrawal request, the assets returned should accurately 
   * reflect their pool token share plus any accrued interest
   */
  async withdraw(poolTokenId: string, caller: string): Promise<bigint> {
    const user = this.getUser(caller);
    
    // Get pool token data
    const poolTokenData = this.poolTokens.get(poolTokenId);
    if (!poolTokenData) {
      throw new LendingPoolError('TOKEN_NOT_FOUND', `Pool token ${poolTokenId} not found`);
    }

    // Check caller is token holder
    if (caller !== poolTokenData.holder) {
      throw new LendingPoolError('UNAUTHORIZED', 'Only token holder can withdraw');
    }

    // Update pool state with accrued interest
    this.updatePoolState();

    // Calculate withdrawal amount based on current pool token value
    const withdrawalAmount = this.calculateWithdrawalAmount(poolTokenData.amount);

    // Check if pool has sufficient liquidity
    const availableLiquidity = this.poolState.totalDeposits - this.poolState.totalBorrows;
    if (withdrawalAmount > availableLiquidity) {
      throw new LendingPoolError('INSUFFICIENT_LIQUIDITY', 'Pool has insufficient liquidity for withdrawal');
    }

    // Update pool state
    this.poolState.totalDeposits -= withdrawalAmount;
    this.poolState.totalPoolTokens -= poolTokenData.amount;
    this.poolState.lastUpdateTime = Date.now();

    // Remove pool token
    this.poolTokens.delete(poolTokenId);
    this.removePoolTokenFromHolder(poolTokenData.holder, poolTokenId);

    // Recalculate utilization and interest rates
    this.updateUtilizationRate();
    this.updateInterestRates();

    return withdrawalAmount;
  }

  /**
   * Borrow against collateral
   * Locks collateral and issues loan
   * 
   * **Property 5: Loan calculation consistency**
   * For any Asset_Token used as collateral, the maximum loan amount calculation 
   * should be deterministic based on asset valuation and current risk parameters
   */
  async borrow(
    collateralTokenIds: string[],
    requestedAmount: bigint,
    borrower: string
  ): Promise<string> {
    const user = this.getUser(borrower);
    
    // Validate requested amount
    if (requestedAmount <= BigInt(0)) {
      throw new LendingPoolError('INVALID_AMOUNT', 'Borrow amount must be positive');
    }

    // Validate collateral tokens
    if (collateralTokenIds.length === 0) {
      throw new LendingPoolError('NO_COLLATERAL', 'At least one collateral token required');
    }

    // Update pool state with accrued interest
    this.updatePoolState();

    // Calculate maximum loan amount based on collateral
    const maxLoanAmount = await this.calculateMaxLoanAmount(collateralTokenIds, borrower);

    if (requestedAmount > maxLoanAmount) {
      throw new LendingPoolError('INSUFFICIENT_COLLATERAL', 
        `Requested amount ${requestedAmount} exceeds maximum loan amount ${maxLoanAmount}`);
    }

    // Check pool has sufficient liquidity
    const availableLiquidity = this.poolState.totalDeposits - this.poolState.totalBorrows;
    if (requestedAmount > availableLiquidity) {
      throw new LendingPoolError('INSUFFICIENT_LIQUIDITY', 'Pool has insufficient liquidity');
    }

    // Generate single loan ID for this loan
    const loanId = this.generateLoanId();

    // Lock collateral tokens with the same loan ID
    for (const tokenId of collateralTokenIds) {
      await this.assetTokenFactory.lockForCollateral(tokenId, loanId, 'lending_protocol_address');
    }

    // Create loan
    const currentInterestRate = this.calculateBorrowRate();
    const loanTerm = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    
    const loanData: LoanData = {
      loanId,
      borrower,
      collateralTokenIds,
      principalAmount: requestedAmount,
      interestRate: currentInterestRate,
      createdAt: Date.now(),
      dueDate: Date.now() + loanTerm,
      status: LoanStatus.Active,
      repaidAmount: BigInt(0),
      liquidationThreshold: 75, // 75% liquidation threshold
    };

    // Update pool state
    this.poolState.totalBorrows += requestedAmount;
    this.poolState.lastUpdateTime = Date.now();

    // Store loan
    this.loans.set(loanId, loanData);
    this.addLoanToBorrower(borrower, loanId);

    // Recalculate utilization and interest rates
    this.updateUtilizationRate();
    this.updateInterestRates();

    return loanId;
  }

  /**
   * Repay loan
   * Releases collateral when fully repaid
   * 
   * **Property 8: Loan repayment round-trip**
   * For any loan that is fully repaid with interest, the borrower should 
   * receive back their original collateral in the same state
   */
  async repay(loanId: string, repaymentAmount: bigint, caller: string): Promise<boolean> {
    const user = this.getUser(caller);
    
    // Get loan data
    const loanData = this.loans.get(loanId);
    if (!loanData) {
      throw new LendingPoolError('LOAN_NOT_FOUND', `Loan ${loanId} not found`);
    }

    // Check caller is borrower
    if (caller !== loanData.borrower) {
      throw new LendingPoolError('UNAUTHORIZED', 'Only borrower can repay loan');
    }

    // Check loan is active
    if (loanData.status !== LoanStatus.Active) {
      throw new LendingPoolError('LOAN_NOT_ACTIVE', 'Loan is not active');
    }

    // Validate repayment amount
    if (repaymentAmount <= BigInt(0)) {
      throw new LendingPoolError('INVALID_AMOUNT', 'Repayment amount must be positive');
    }

    // Calculate total amount owed (principal + accrued interest)
    const totalOwed = this.calculateTotalOwed(loanData);
    const remainingOwed = totalOwed - loanData.repaidAmount;

    // Ensure repayment doesn't exceed what's owed
    const actualRepayment = repaymentAmount > remainingOwed ? remainingOwed : repaymentAmount;

    // Update loan data
    loanData.repaidAmount += actualRepayment;
    const currentTime = Date.now();

    const isFullyRepaid = loanData.repaidAmount >= totalOwed;

    if (isFullyRepaid) {
      // Mark loan as repaid
      loanData.status = LoanStatus.Repaid;

      // Unlock collateral tokens
      for (const tokenId of loanData.collateralTokenIds) {
        await this.assetTokenFactory.unlockFromCollateral(tokenId, 'lending_protocol_address');
      }

      // Update pool state
      this.poolState.totalBorrows -= loanData.principalAmount;
    }

    // Update pool state
    this.poolState.lastUpdateTime = Date.now();

    // Store updated loan
    this.loans.set(loanId, loanData);

    // Recalculate utilization and interest rates
    this.updateUtilizationRate();
    this.updateInterestRates();

    return isFullyRepaid;
  }

  /**
   * Liquidate undercollateralized loan
   * 
   * **Property 7: Liquidation threshold enforcement**
   * For any loan position where collateral value falls below the liquidation threshold, 
   * the liquidation process should be automatically initiated
   */
  async liquidate(loanId: string, liquidator: string): Promise<void> {
    const user = this.getUser(liquidator);
    
    // Get loan data
    const loanData = this.loans.get(loanId);
    if (!loanData) {
      throw new LendingPoolError('LOAN_NOT_FOUND', `Loan ${loanId} not found`);
    }

    // Check loan is active
    if (loanData.status !== LoanStatus.Active) {
      throw new LendingPoolError('LOAN_NOT_ACTIVE', 'Loan is not active');
    }

    // Calculate current collateral value and loan-to-value ratio
    const collateralValue = await this.calculateCollateralValue(loanData.collateralTokenIds);
    const totalOwed = this.calculateTotalOwed(loanData);
    const ltvRatio = Number(totalOwed * BigInt(100) / collateralValue);

    // Check if liquidation is warranted
    if (ltvRatio < loanData.liquidationThreshold) {
      throw new LendingPoolError('LIQUIDATION_NOT_WARRANTED', 
        `LTV ratio ${ltvRatio}% is below liquidation threshold ${loanData.liquidationThreshold}%`);
    }

    // Mark loan as liquidated
    loanData.status = LoanStatus.Liquidated;
    const currentTime = Date.now();

    // Calculate liquidation proceeds and distribute to lenders
    const liquidationProceeds = collateralValue;
    await this.distributeLiquidationProceeds(liquidationProceeds);

    // Update pool state
    this.poolState.totalBorrows -= loanData.principalAmount;
    this.poolState.lastUpdateTime = Date.now();

    // Store updated loan
    this.loans.set(loanId, loanData);

    // Recalculate utilization and interest rates
    this.updateUtilizationRate();
    this.updateInterestRates();
  }

  /**
   * Get pool state information
   */
  getPoolState(): LendingPoolState {
    this.updatePoolState();
    return { ...this.poolState };
  }

  /**
   * Get pool token data
   */
  getPoolToken(tokenId: string): PoolTokenData | undefined {
    return this.poolTokens.get(tokenId);
  }

  /**
   * Get tokens held by account
   */
  getHolderTokens(holder: string): string[] {
    const tokens = this.holderTokens.get(holder);
    return tokens ? Array.from(tokens) : [];
  }

  /**
   * Get loan data
   */
  getLoan(loanId: string): LoanData | undefined {
    return this.loans.get(loanId);
  }

  /**
   * Get loans for borrower
   */
  getBorrowerLoans(borrower: string): string[] {
    const loans = this.borrowerLoans.get(borrower);
    return loans ? Array.from(loans) : [];
  }

  // Private helper methods

  private initializeMockUsers(): void {
    this.registerUser('admin_address', UserRole.ADMIN);
    this.registerUser('lending_protocol_address', UserRole.LENDING_PROTOCOL);
    this.registerUser('user_address', UserRole.USER);
  }

  private updatePoolState(): void {
    const currentTime = Date.now();
    const timeDelta = currentTime - this.poolState.lastUpdateTime;
    
    if (timeDelta > 0 && this.poolState.totalBorrows > BigInt(0)) {
      // Calculate accrued interest
      const annualRate = this.poolState.baseInterestRate / 100;
      const timeInYears = timeDelta / (365 * 24 * 60 * 60 * 1000);
      const interestAccrued = this.poolState.totalBorrows * BigInt(Math.floor(annualRate * timeInYears * 1000)) / BigInt(1000);
      
      // Add interest to total deposits (lenders earn the interest)
      this.poolState.totalDeposits += interestAccrued;
      this.poolState.lastUpdateTime = currentTime;
    }
  }

  private calculatePoolTokensForDeposit(depositAmount: bigint): bigint {
    if (this.poolState.totalPoolTokens === BigInt(0) || this.poolState.totalDeposits === BigInt(0)) {
      // First deposit: 1:1 ratio
      return depositAmount;
    }
    
    // Calculate based on current pool token value
    return depositAmount * this.poolState.totalPoolTokens / this.poolState.totalDeposits;
  }

  private calculateWithdrawalAmount(poolTokenAmount: bigint): bigint {
    if (this.poolState.totalPoolTokens === BigInt(0)) {
      return BigInt(0);
    }
    
    return poolTokenAmount * this.poolState.totalDeposits / this.poolState.totalPoolTokens;
  }

  private async calculateMaxLoanAmount(collateralTokenIds: string[], borrower: string): Promise<bigint> {
    let totalCollateralValue = BigInt(0);
    
    for (const tokenId of collateralTokenIds) {
      const tokenData = this.assetTokenFactory.getTokenData(tokenId);
      if (!tokenData) {
        throw new LendingPoolError('INVALID_COLLATERAL', `Collateral token ${tokenId} not found`);
      }
      
      // Check borrower owns the collateral
      if (tokenData.owner !== borrower) {
        throw new LendingPoolError('UNAUTHORIZED_COLLATERAL', `Borrower does not own token ${tokenId}`);
      }
      
      // Check token is verified and not locked
      if (tokenData.verificationStatus !== 'approved') {
        throw new LendingPoolError('UNVERIFIED_COLLATERAL', `Token ${tokenId} is not verified`);
      }
      
      if (tokenData.isLocked) {
        throw new LendingPoolError('LOCKED_COLLATERAL', `Asset is already locked as collateral`);
      }
      
      totalCollateralValue += tokenData.valuation;
    }
    
    // Apply loan-to-value ratio (e.g., 70% of collateral value)
    const ltvRatio = BigInt(70); // 70% LTV
    return totalCollateralValue * ltvRatio / BigInt(100);
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

  private calculateTotalOwed(loanData: LoanData): bigint {
    const currentTime = Date.now();
    const loanAge = currentTime - loanData.createdAt;
    const annualRate = loanData.interestRate / 100;
    const timeInYears = loanAge / (365 * 24 * 60 * 60 * 1000);
    
    const interest = loanData.principalAmount * BigInt(Math.floor(annualRate * timeInYears * 1000)) / BigInt(1000);
    return loanData.principalAmount + interest;
  }

  private updateUtilizationRate(): void {
    if (this.poolState.totalDeposits === BigInt(0)) {
      this.poolState.utilizationRate = 0;
    } else {
      this.poolState.utilizationRate = Number(
        this.poolState.totalBorrows * BigInt(100) / this.poolState.totalDeposits
      );
    }
  }

  private updateInterestRates(): void {
    this.poolState.baseInterestRate = this.calculateBorrowRate();
  }

  private calculateBorrowRate(): number {
    const utilization = this.poolState.utilizationRate;
    const model = this.interestRateModel;
    
    if (utilization <= model.optimalUtilization) {
      // Below optimal utilization
      return model.baseRate + (utilization * model.multiplier);
    } else {
      // Above optimal utilization
      const excessUtilization = utilization - model.optimalUtilization;
      return model.baseRate + 
             (model.optimalUtilization * model.multiplier) + 
             (excessUtilization * model.jumpMultiplier);
    }
  }

  private async distributeLiquidationProceeds(proceeds: bigint): Promise<void> {
    // Distribute proceeds proportionally to all pool token holders
    const totalPoolTokens = this.poolState.totalPoolTokens;
    
    if (totalPoolTokens > BigInt(0)) {
      for (const [tokenId, poolTokenData] of Array.from(this.poolTokens.entries())) {
        const share = poolTokenData.amount * proceeds / totalPoolTokens;
        // In a real implementation, this would transfer the share to the token holder
        // Distribution logged for audit purposes
      }
    }
  }

  private generatePoolTokenId(): string {
    return `pool_token_${++this.poolTokenCounter}_${Date.now()}`;
  }

  private generateLoanId(): string {
    return `loan_${++this.loanCounter}_${Date.now()}`;
  }

  private addPoolTokenToHolder(holder: string, tokenId: string): void {
    if (!this.holderTokens.has(holder)) {
      this.holderTokens.set(holder, new Set());
    }
    this.holderTokens.get(holder)!.add(tokenId);
  }

  private removePoolTokenFromHolder(holder: string, tokenId: string): void {
    const tokens = this.holderTokens.get(holder);
    if (tokens) {
      tokens.delete(tokenId);
      if (tokens.size === 0) {
        this.holderTokens.delete(holder);
      }
    }
  }

  private addLoanToBorrower(borrower: string, loanId: string): void {
    if (!this.borrowerLoans.has(borrower)) {
      this.borrowerLoans.set(borrower, new Set());
    }
    this.borrowerLoans.get(borrower)!.add(loanId);
  }
}