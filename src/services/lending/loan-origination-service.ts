import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiClient } from '@mysten/sui.js/client';
import { CapabilityService } from './capability-service';
import { logger } from '../../utils/logger';

/**
 * Loan status
 */
export enum LoanStatus {
  ACTIVE = 0,
  REPAID = 1,
  DEFAULTED = 2,
  LIQUIDATED = 3,
}

/**
 * Payment record
 */
export interface PaymentRecord {
  amount: number;
  timestamp: number;
  paymentType: 'principal' | 'interest' | 'penalty';
}

/**
 * Loan information
 */
export interface LoanInfo {
  loanId: string;
  borrowerAccountId: string;
  capabilityId: string;
  principalAmount: number;
  interestRateBps: number;
  totalAmountDue: number;
  amountPaid: number;
  amountRemaining: number;
  collateralType: string;
  collateralRefs: string[];
  originatedAt: number;
  dueDate: number;
  lastPaymentAt: number;
  status: LoanStatus;
  paymentHistory: PaymentRecord[];
}

/**
 * Underwriting rules
 */
export interface UnderwritingRules {
  maxLTV: number; // Maximum loan-to-value ratio
  minCreditScore: number;
  maxRiskScore: number;
  minCollateralValue: number;
  maxLoanAmount: number;
  minLoanDuration: number; // in days
  maxLoanDuration: number; // in days
}

/**
 * Loan application
 */
export interface LoanApplication {
  borrowerAccountId: string;
  requestedAmount: number;
  loanDurationDays: number;
  collateralType: string;
  collateralValue: number;
  collateralRefs: string[];
  creditScore: number;
  riskScore: number;
}

/**
 * Service for loan origination and management
 */
export class LoanOriginationService {
  private suiClient: SuiClient;
  private packageId: string;
  private clockObjectId: string;
  private capabilityService: CapabilityService;

  constructor(
    suiClient: SuiClient,
    packageId: string,
    capabilityService: CapabilityService,
    clockObjectId: string = '0x6'
  ) {
    this.suiClient = suiClient;
    this.packageId = packageId;
    this.capabilityService = capabilityService;
    this.clockObjectId = clockObjectId;
  }

  /**
   * Underwrite loan application
   */
  async underwriteLoan(
    application: LoanApplication
  ): Promise<{
    approved: boolean;
    reasons: string[];
    approvedAmount?: number;
    interestRate?: number;
    loanDuration?: number;
  }> {
    const reasons: string[] = [];
    let approved = true;

    // Define underwriting rules
    const rules: UnderwritingRules = {
      maxLTV: 0.7, // 70% max LTV
      minCreditScore: 600,
      maxRiskScore: 70,
      minCollateralValue: 1000,
      maxLoanAmount: 1000000,
      minLoanDuration: 30, // 30 days
      maxLoanDuration: 365, // 1 year
    };

    // Check credit score
    if (application.creditScore < rules.minCreditScore) {
      approved = false;
      reasons.push(`Credit score ${application.creditScore} below minimum ${rules.minCreditScore}`);
    }

    // Check risk score
    if (application.riskScore > rules.maxRiskScore) {
      approved = false;
      reasons.push(`Risk score ${application.riskScore} exceeds maximum ${rules.maxRiskScore}`);
    }

    // Check collateral value
    if (application.collateralValue < rules.minCollateralValue) {
      approved = false;
      reasons.push(`Collateral value $${application.collateralValue} below minimum $${rules.minCollateralValue}`);
    }

    // Check LTV
    const ltv = application.requestedAmount / application.collateralValue;
    if (ltv > rules.maxLTV) {
      approved = false;
      reasons.push(`LTV ${(ltv * 100).toFixed(2)}% exceeds maximum ${rules.maxLTV * 100}%`);
    }

    // Check loan amount
    if (application.requestedAmount > rules.maxLoanAmount) {
      approved = false;
      reasons.push(`Requested amount $${application.requestedAmount} exceeds maximum $${rules.maxLoanAmount}`);
    }

    // Check loan duration
    if (application.loanDurationDays < rules.minLoanDuration || application.loanDurationDays > rules.maxLoanDuration) {
      approved = false;
      reasons.push(`Loan duration ${application.loanDurationDays} days outside allowed range ${rules.minLoanDuration}-${rules.maxLoanDuration}`);
    }

    if (!approved) {
      return { approved, reasons };
    }

    // Calculate approved amount (may be less than requested based on LTV)
    const maxLoanAmount = application.collateralValue * rules.maxLTV;
    const approvedAmount = Math.min(application.requestedAmount, maxLoanAmount);

    // Calculate interest rate based on risk (5% base + risk adjustment)
    const baseRate = 500; // 5% in bps
    const riskAdjustment = Math.floor((application.riskScore / 100) * 500); // Up to 5% additional
    const interestRate = baseRate + riskAdjustment;

    logger.info('Loan underwriting approved', {
      borrower: application.borrowerAccountId,
      approvedAmount,
      interestRate,
      ltv: (approvedAmount / application.collateralValue * 100).toFixed(2),
    });

    return {
      approved: true,
      reasons: ['Loan application approved'],
      approvedAmount,
      interestRate,
      loanDuration: application.loanDurationDays,
    };
  }

  /**
   * Originate a new loan
   */
  async originateLoan(
    borrowerAccountId: string,
    capabilityId: string,
    principalAmount: number,
    interestRateBps: number,
    loanDurationDays: number,
    collateralType: string,
    collateralRefs: string[],
    signerAddress: string
  ): Promise<{
    success: boolean;
    loanId?: string;
    totalAmountDue?: number;
    dueDate?: number;
    error?: string;
  }> {
    try {
      logger.info('Originating loan', {
        borrower: borrowerAccountId,
        principal: principalAmount,
        duration: loanDurationDays,
      });

      // Convert to smallest units
      const principalCents = Math.round(principalAmount * 100);
      const loanDurationMs = loanDurationDays * 24 * 60 * 60 * 1000;

      const tx = new TransactionBlock();

      const [loan] = tx.moveCall({
        target: `${this.packageId}::loan::originate_loan`,
        arguments: [
          tx.pure(borrowerAccountId),
          tx.pure(capabilityId),
          tx.pure(principalCents),
          tx.pure(interestRateBps),
          tx.pure(loanDurationMs),
          tx.pure(collateralType),
          tx.pure(collateralRefs),
          tx.object(this.clockObjectId),
        ],
      });

      // Transfer loan object to borrower
      tx.transferObjects([loan], tx.pure(signerAddress));

      // Calculate total amount due
      const interestAmount = (principalAmount * interestRateBps) / 10000;
      const totalAmountDue = principalAmount + interestAmount;
      const dueDate = Date.now() + loanDurationMs;

      logger.info('Loan origination transaction prepared', {
        borrower: borrowerAccountId,
        totalAmountDue,
        dueDate: new Date(dueDate).toISOString(),
      });

      return {
        success: true,
        loanId: 'pending',
        totalAmountDue,
        dueDate,
      };
    } catch (error) {
      logger.error('Failed to originate loan', {
        error: error instanceof Error ? error.message : 'Unknown error',
        borrower: borrowerAccountId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Make a payment on a loan
   */
  async makePayment(
    loanObjectId: string,
    amount: number,
    paymentType: 'principal' | 'interest' | 'penalty',
    signerAddress: string
  ): Promise<{
    success: boolean;
    amountRemaining?: number;
    fullyRepaid?: boolean;
    error?: string;
  }> {
    try {
      logger.info('Making loan payment', {
        loanId: loanObjectId,
        amount,
        paymentType,
      });

      const amountCents = Math.round(amount * 100);

      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.packageId}::loan::make_payment`,
        arguments: [
          tx.object(loanObjectId),
          tx.pure(amountCents),
          tx.pure(paymentType),
          tx.object(this.clockObjectId),
        ],
      });

      logger.info('Payment transaction prepared', {
        loanId: loanObjectId,
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to make payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        loanId: loanObjectId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Mark loan as defaulted
   */
  async markDefaulted(
    loanObjectId: string,
    signerAddress: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      logger.info('Marking loan as defaulted', {
        loanId: loanObjectId,
      });

      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.packageId}::loan::mark_defaulted`,
        arguments: [
          tx.object(loanObjectId),
          tx.object(this.clockObjectId),
        ],
      });

      logger.info('Mark defaulted transaction prepared', {
        loanId: loanObjectId,
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to mark loan as defaulted', {
        error: error instanceof Error ? error.message : 'Unknown error',
        loanId: loanObjectId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get loan information
   */
  async getLoanInfo(loanObjectId: string): Promise<LoanInfo | null> {
    try {
      const loanObject = await this.suiClient.getObject({
        id: loanObjectId,
        options: {
          showContent: true,
        },
      });

      if (!loanObject.data || !loanObject.data.content) {
        return null;
      }

      // Parse loan data from on-chain object
      // In production, properly parse the Move object structure
      return null;
    } catch (error) {
      logger.error('Failed to get loan info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        loanId: loanObjectId,
      });
      return null;
    }
  }

  /**
   * Calculate payment schedule
   */
  calculatePaymentSchedule(
    principalAmount: number,
    interestRateBps: number,
    loanDurationDays: number,
    paymentFrequencyDays: number = 30
  ): Array<{
    paymentNumber: number;
    dueDate: Date;
    principalAmount: number;
    interestAmount: number;
    totalAmount: number;
  }> {
    const schedule: Array<any> = [];
    const totalInterest = (principalAmount * interestRateBps) / 10000;
    const numberOfPayments = Math.ceil(loanDurationDays / paymentFrequencyDays);
    const principalPerPayment = principalAmount / numberOfPayments;
    const interestPerPayment = totalInterest / numberOfPayments;

    for (let i = 1; i <= numberOfPayments; i++) {
      const dueDate = new Date(Date.now() + i * paymentFrequencyDays * 24 * 60 * 60 * 1000);

      schedule.push({
        paymentNumber: i,
        dueDate,
        principalAmount: principalPerPayment,
        interestAmount: interestPerPayment,
        totalAmount: principalPerPayment + interestPerPayment,
      });
    }

    return schedule;
  }

  /**
   * Check if loan is overdue
   */
  isOverdue(loan: LoanInfo): boolean {
    return Date.now() > loan.dueDate && loan.status === LoanStatus.ACTIVE;
  }

  /**
   * Calculate days overdue
   */
  daysOverdue(loan: LoanInfo): number {
    if (Date.now() <= loan.dueDate) return 0;
    const overdueMs = Date.now() - loan.dueDate;
    return Math.floor(overdueMs / (24 * 60 * 60 * 1000));
  }
}
