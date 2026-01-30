/**
 * Loan Manager Service
 * 
 * This service handles loan origination, management, and lifecycle operations
 * with comprehensive risk assessment and atomic execution patterns.
 */

import { AccessControl } from '../auth/access-control';
import { UserRole, User } from '../../types/auth';
import { AssetTokenFactory, AssetTokenData } from './asset-token';
import { LendingPool, LoanData, LoanStatus } from './lending-pool';

export interface LoanApplication {
  applicationId: string;
  borrower: string;
  requestedAmount: bigint;
  collateralTokenIds: string[];
  purpose: string;
  term: number; // Loan term in days
  status: ApplicationStatus;
  createdAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
  reviewNotes?: string;
}

export enum ApplicationStatus {
  Pending = 'pending',
  UnderReview = 'under_review',
  Approved = 'approved',
  Rejected = 'rejected',
  Withdrawn = 'withdrawn'
}

export interface RiskAssessment {
  loanId: string;
  borrower: string;
  collateralValue: bigint;
  loanToValueRatio: number;
  riskScore: number; // 0-100, higher is riskier
  riskFactors: RiskFactor[];
  recommendedAction: 'approve' | 'reject' | 'request_more_collateral';
  assessedBy: string;
  assessedAt: number;
}

export interface RiskFactor {
  factor: string;
  impact: 'low' | 'medium' | 'high';
  description: string;
  score: number; // Contribution to overall risk score
}

export interface LoanPayment {
  paymentId: string;
  loanId: string;
  amount: bigint;
  paymentDate: number;
  paymentType: 'principal' | 'interest' | 'penalty' | 'full_repayment';
  paidBy: string;
}

export interface CollateralEvaluation {
  tokenId: string;
  currentValue: bigint;
  lastEvaluated: number;
  evaluatedBy: string;
  marketFactors: string[];
  volatilityScore: number; // 0-100, higher is more volatile
}

export class LoanManagerError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'LoanManagerError';
  }
}

/**
 * Loan Manager Implementation
 * 
 * Manages the complete loan lifecycle from application to repayment
 */
export class LoanManager {
  private applications: Map<string, LoanApplication> = new Map();
  private riskAssessments: Map<string, RiskAssessment> = new Map();
  private payments: Map<string, LoanPayment[]> = new Map(); // loanId -> payments
  private collateralEvaluations: Map<string, CollateralEvaluation> = new Map();
  private userRegistry: Map<string, User> = new Map();
  private assetTokenFactory: AssetTokenFactory;
  private lendingPool: LendingPool;
  private applicationCounter = 0;
  private paymentCounter = 0;

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
   * Submit loan application
   * Creates application for review and risk assessment
   */
  async submitLoanApplication(
    borrower: string,
    requestedAmount: bigint,
    collateralTokenIds: string[],
    purpose: string,
    term: number
  ): Promise<string> {
    // Validate inputs
    if (requestedAmount <= BigInt(0)) {
      throw new LoanManagerError('INVALID_AMOUNT', 'Requested amount must be positive');
    }

    if (collateralTokenIds.length === 0) {
      throw new LoanManagerError('NO_COLLATERAL', 'At least one collateral token required');
    }

    if (term <= 0 || term > 1825) { // Max 5 years
      throw new LoanManagerError('INVALID_TERM', 'Loan term must be between 1 and 1825 days');
    }

    // Validate collateral ownership and status
    await this.validateCollateral(collateralTokenIds, borrower);

    // Generate application ID
    const applicationId = this.generateApplicationId();

    // Create loan application
    const application: LoanApplication = {
      applicationId,
      borrower,
      requestedAmount,
      collateralTokenIds,
      purpose,
      term,
      status: ApplicationStatus.Pending,
      createdAt: Date.now(),
    };

    // Store application
    this.applications.set(applicationId, application);

    return applicationId;
  }

  /**
   * Conduct risk assessment for loan application
   * Evaluates collateral and borrower risk factors
   */
  async conductRiskAssessment(
    applicationId: string,
    assessor: string
  ): Promise<RiskAssessment> {
    const user = this.getUser(assessor);
    
    // Check assessor permissions
    if (!AccessControl.hasRole(user, UserRole.VERIFIER) && 
        !AccessControl.hasRole(user, UserRole.ADMIN)) {
      throw new LoanManagerError('UNAUTHORIZED', 'Only verifiers can conduct risk assessments');
    }

    // Get application
    const application = this.applications.get(applicationId);
    if (!application) {
      throw new LoanManagerError('APPLICATION_NOT_FOUND', `Application ${applicationId} not found`);
    }

    // Update application status
    application.status = ApplicationStatus.UnderReview;
    application.reviewedBy = assessor;
    application.reviewedAt = Date.now();

    // Evaluate collateral
    const collateralValue = await this.evaluateCollateral(application.collateralTokenIds, assessor);

    // Calculate loan-to-value ratio
    const ltvRatio = Number(application.requestedAmount * BigInt(100) / collateralValue);

    // Assess risk factors
    const riskFactors = await this.assessRiskFactors(application, collateralValue);

    // Calculate overall risk score
    const riskScore = this.calculateRiskScore(riskFactors, ltvRatio);

    // Determine recommendation
    const recommendedAction = this.determineRecommendation(riskScore, ltvRatio);

    // Create risk assessment
    const riskAssessment: RiskAssessment = {
      loanId: applicationId,
      borrower: application.borrower,
      collateralValue,
      loanToValueRatio: ltvRatio,
      riskScore,
      riskFactors,
      recommendedAction,
      assessedBy: assessor,
      assessedAt: Date.now(),
    };

    // Store risk assessment
    this.riskAssessments.set(applicationId, riskAssessment);

    return riskAssessment;
  }

  /**
   * Approve loan application and originate loan
   * 
   * **Property 6: Atomic loan execution**
   * For any approved loan, the borrower should receive the requested amount 
   * and the collateral should be locked in a single atomic transaction
   */
  async approveLoanApplication(
    applicationId: string,
    approver: string
  ): Promise<string> {
    const user = this.getUser(approver);
    
    // Check approver permissions
    if (!AccessControl.hasRole(user, UserRole.ADMIN) && 
        !AccessControl.hasRole(user, UserRole.LENDING_PROTOCOL)) {
      throw new LoanManagerError('UNAUTHORIZED', 'Only admins can approve loans');
    }

    // Get application and risk assessment
    const application = this.applications.get(applicationId);
    if (!application) {
      throw new LoanManagerError('APPLICATION_NOT_FOUND', `Application ${applicationId} not found`);
    }

    const riskAssessment = this.riskAssessments.get(applicationId);
    if (!riskAssessment) {
      throw new LoanManagerError('RISK_ASSESSMENT_REQUIRED', 'Risk assessment required before approval');
    }

    // Check risk assessment recommendation
    if (riskAssessment.recommendedAction === 'reject') {
      throw new LoanManagerError('HIGH_RISK_LOAN', 'Risk assessment recommends rejection');
    }

    // Atomic loan execution
    try {
      // 1. Create loan in lending pool (this locks collateral)
      const loanId = await this.lendingPool.borrow(
        application.collateralTokenIds,
        application.requestedAmount,
        application.borrower
      );

      // 2. Update application status
      application.status = ApplicationStatus.Approved;
      application.reviewNotes = `Approved by ${approver}. Loan ID: ${loanId}`;
      this.applications.set(applicationId, application);

      // 3. Initialize payment tracking
      this.payments.set(loanId, []);

      return loanId;

    } catch (error) {
      // If any step fails, the entire transaction should fail
      throw new LoanManagerError('LOAN_ORIGINATION_FAILED', `Failed to originate loan: ${error}`);
    }
  }

  /**
   * Reject loan application
   */
  async rejectLoanApplication(
    applicationId: string,
    rejector: string,
    reason: string
  ): Promise<void> {
    const user = this.getUser(rejector);
    
    // Check rejector permissions
    if (!AccessControl.hasRole(user, UserRole.ADMIN) && 
        !AccessControl.hasRole(user, UserRole.VERIFIER)) {
      throw new LoanManagerError('UNAUTHORIZED', 'Only admins or verifiers can reject loans');
    }

    // Get application
    const application = this.applications.get(applicationId);
    if (!application) {
      throw new LoanManagerError('APPLICATION_NOT_FOUND', `Application ${applicationId} not found`);
    }

    // Update application status
    application.status = ApplicationStatus.Rejected;
    application.reviewedBy = rejector;
    application.reviewedAt = Date.now();
    application.reviewNotes = reason;

    this.applications.set(applicationId, application);
  }

  /**
   * Make loan payment
   * Handles partial and full repayments
   */
  async makeLoanPayment(
    loanId: string,
    paymentAmount: bigint,
    paymentType: LoanPayment['paymentType'],
    payer: string
  ): Promise<string> {
    // Validate payment amount
    if (paymentAmount <= BigInt(0)) {
      throw new LoanManagerError('INVALID_PAYMENT', 'Payment amount must be positive');
    }

    // Get loan data
    const loanData = this.lendingPool.getLoan(loanId);
    if (!loanData) {
      throw new LoanManagerError('LOAN_NOT_FOUND', `Loan ${loanId} not found`);
    }

    // Check payer authorization (borrower or admin)
    const user = this.getUser(payer);
    if (payer !== loanData.borrower && !AccessControl.hasRole(user, UserRole.ADMIN)) {
      throw new LoanManagerError('UNAUTHORIZED', 'Only borrower or admin can make payments');
    }

    // Process payment through lending pool
    const isFullyRepaid = await this.lendingPool.repay(loanId, paymentAmount, payer);

    // Record payment
    const paymentId = this.generatePaymentId();
    const payment: LoanPayment = {
      paymentId,
      loanId,
      amount: paymentAmount,
      paymentDate: Date.now(),
      paymentType: isFullyRepaid ? 'full_repayment' : paymentType,
      paidBy: payer,
    };

    // Store payment record
    const loanPayments = this.payments.get(loanId) || [];
    loanPayments.push(payment);
    this.payments.set(loanId, loanPayments);

    return paymentId;
  }

  /**
   * Get loan application
   */
  getLoanApplication(applicationId: string): LoanApplication | undefined {
    return this.applications.get(applicationId);
  }

  /**
   * Get risk assessment
   */
  getRiskAssessment(applicationId: string): RiskAssessment | undefined {
    return this.riskAssessments.get(applicationId);
  }

  /**
   * Get loan payments
   */
  getLoanPayments(loanId: string): LoanPayment[] {
    return this.payments.get(loanId) || [];
  }

  /**
   * Get collateral evaluation
   */
  getCollateralEvaluation(tokenId: string): CollateralEvaluation | undefined {
    return this.collateralEvaluations.get(tokenId);
  }

  // Private helper methods

  private initializeMockUsers(): void {
    this.registerUser('admin_address', UserRole.ADMIN);
    this.registerUser('verifier_address', UserRole.VERIFIER);
    this.registerUser('lending_protocol_address', UserRole.LENDING_PROTOCOL);
    this.registerUser('borrower_address', UserRole.USER);
  }

  private async validateCollateral(collateralTokenIds: string[], borrower: string): Promise<void> {
    for (const tokenId of collateralTokenIds) {
      const tokenData = this.assetTokenFactory.getTokenData(tokenId);
      
      if (!tokenData) {
        throw new LoanManagerError('INVALID_COLLATERAL', `Token ${tokenId} not found`);
      }

      if (tokenData.owner !== borrower) {
        throw new LoanManagerError('UNAUTHORIZED_COLLATERAL', `Borrower does not own token ${tokenId}`);
      }

      if (tokenData.verificationStatus !== 'approved') {
        throw new LoanManagerError('UNVERIFIED_COLLATERAL', `Token ${tokenId} is not verified`);
      }

      if (tokenData.isLocked) {
        throw new LoanManagerError('LOCKED_COLLATERAL', `Token ${tokenId} is already locked`);
      }
    }
  }

  private async evaluateCollateral(collateralTokenIds: string[], evaluator: string): Promise<bigint> {
    let totalValue = BigInt(0);

    for (const tokenId of collateralTokenIds) {
      const tokenData = this.assetTokenFactory.getTokenData(tokenId);
      if (!tokenData) {
        continue;
      }

      // Create collateral evaluation record
      const evaluation: CollateralEvaluation = {
        tokenId,
        currentValue: tokenData.valuation,
        lastEvaluated: Date.now(),
        evaluatedBy: evaluator,
        marketFactors: ['market_stability', 'asset_liquidity', 'location_premium'],
        volatilityScore: this.calculateVolatilityScore(tokenData.assetType),
      };

      this.collateralEvaluations.set(tokenId, evaluation);
      totalValue += tokenData.valuation;
    }

    return totalValue;
  }

  private async assessRiskFactors(
    application: LoanApplication,
    collateralValue: bigint
  ): Promise<RiskFactor[]> {
    const riskFactors: RiskFactor[] = [];

    // LTV ratio risk
    const ltvRatio = Number(application.requestedAmount * BigInt(100) / collateralValue);
    if (ltvRatio > 80) {
      riskFactors.push({
        factor: 'high_ltv_ratio',
        impact: 'high',
        description: `LTV ratio of ${ltvRatio}% exceeds recommended threshold`,
        score: 25,
      });
    } else if (ltvRatio > 60) {
      riskFactors.push({
        factor: 'moderate_ltv_ratio',
        impact: 'medium',
        description: `LTV ratio of ${ltvRatio}% is moderately high`,
        score: 15,
      });
    }

    // Loan term risk
    if (application.term > 365) {
      riskFactors.push({
        factor: 'long_term_loan',
        impact: 'medium',
        description: `Loan term of ${application.term} days increases risk`,
        score: 10,
      });
    }

    // Collateral diversification
    if (application.collateralTokenIds.length === 1) {
      riskFactors.push({
        factor: 'single_collateral',
        impact: 'medium',
        description: 'Single collateral asset increases concentration risk',
        score: 12,
      });
    }

    return riskFactors;
  }

  private calculateRiskScore(riskFactors: RiskFactor[], ltvRatio: number): number {
    let totalScore = 0;

    // Sum risk factor scores
    for (const factor of riskFactors) {
      totalScore += factor.score;
    }

    // Add base score based on LTV
    totalScore += Math.max(0, ltvRatio - 50); // Add 1 point for each % above 50%

    // Cap at 100
    return Math.min(100, totalScore);
  }

  private determineRecommendation(
    riskScore: number,
    ltvRatio: number
  ): RiskAssessment['recommendedAction'] {
    if (riskScore > 70 || ltvRatio > 85) {
      return 'reject';
    } else if (riskScore > 50 || ltvRatio > 75) {
      return 'request_more_collateral';
    } else {
      return 'approve';
    }
  }

  private calculateVolatilityScore(assetType: string): number {
    // Mock volatility scores based on asset type
    const volatilityMap: Record<string, number> = {
      'real_estate': 20,
      'commodity': 60,
      'equipment': 40,
      'invoice': 10,
      'other': 50,
    };

    return volatilityMap[assetType] || 50;
  }

  private generateApplicationId(): string {
    return `app_${++this.applicationCounter}_${Date.now()}`;
  }

  private generatePaymentId(): string {
    return `payment_${++this.paymentCounter}_${Date.now()}`;
  }
}