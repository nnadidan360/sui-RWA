export type LoanStatus = 'active' | 'repaid' | 'liquidated' | 'overdue' | 'pending';

export type CollateralType = 'asset_token' | 'staked_token';

export interface CollateralAsset {
  id: string;
  type: CollateralType;
  tokenId: string;
  title: string;
  currentValue: number;
  currency: string;
  utilizationRatio: number; // Percentage of value being used as collateral
}

export interface LoanPosition {
  id: string;
  loanId: string;
  borrower: string;
  collateralAssets: CollateralAsset[];
  principalAmount: number;
  currentDebt: number;
  interestRate: number; // Annual percentage rate
  liquidationThreshold: number; // LTV ratio at which liquidation occurs
  currentLTV: number; // Current loan-to-value ratio
  healthFactor: number; // Health factor (>1 is safe, <1 is at risk)
  status: LoanStatus;
  createdAt: Date;
  dueDate: Date;
  lastPaymentDate?: Date;
  nextPaymentDue?: Date;
  totalInterestPaid: number;
  penaltyFees: number;
}

export interface LendingPool {
  id: string;
  name: string;
  asset: string; // Token symbol (e.g., 'CSPR', 'USDC')
  totalDeposits: number;
  totalBorrows: number;
  availableLiquidity: number;
  utilizationRate: number; // Percentage of deposits that are borrowed
  supplyAPY: number; // Annual percentage yield for lenders
  borrowAPY: number; // Annual percentage rate for borrowers
  totalReserves: number;
  reserveFactor: number;
  collateralFactor: number; // Maximum LTV ratio for this asset
  liquidationThreshold: number;
  liquidationPenalty: number;
}

export interface UserLendingPosition {
  poolId: string;
  poolName: string;
  asset: string;
  suppliedAmount: number;
  poolTokens: number; // LP tokens representing share of pool
  currentValue: number; // Current value including accrued interest
  earnedInterest: number;
  apy: number;
  shareOfPool: number; // Percentage of total pool
}

export interface BorrowRequest {
  collateralAssets: string[]; // Asset IDs to use as collateral
  borrowAmount: number;
  borrowAsset: string;
  loanTerm?: number; // Optional loan term in days
}

export interface LoanApplication {
  id: string;
  borrower: string;
  collateralAssets: CollateralAsset[];
  requestedAmount: number;
  requestedAsset: string;
  maxLoanAmount: number; // Maximum amount that can be borrowed
  proposedLTV: number;
  proposedInterestRate: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  reviewedAt?: Date;
  reviewNotes?: string;
}

export interface LiquidationEvent {
  id: string;
  loanId: string;
  borrower: string;
  liquidator: string;
  collateralLiquidated: CollateralAsset[];
  debtRepaid: number;
  liquidationPenalty: number;
  timestamp: Date;
  transactionHash?: string;
}

export interface InterestRateModel {
  baseRate: number; // Base interest rate when utilization is 0
  multiplier: number; // Rate of increase in interest rate with utilization
  jumpMultiplier: number; // Additional rate increase after optimal utilization
  optimalUtilization: number; // Optimal utilization rate (e.g., 80%)
}

export interface RiskParameters {
  collateralFactor: number; // Maximum LTV ratio
  liquidationThreshold: number; // LTV at which liquidation occurs
  liquidationPenalty: number; // Penalty fee for liquidation
  reserveFactor: number; // Percentage of interest that goes to reserves
  borrowCap?: number; // Maximum amount that can be borrowed
  supplyCap?: number; // Maximum amount that can be supplied
}

export interface LendingFilters {
  status?: LoanStatus;
  collateralType?: CollateralType;
  minAmount?: number;
  maxAmount?: number;
  minHealthFactor?: number;
  maxHealthFactor?: number;
  sortBy?: 'createdAt' | 'dueDate' | 'principalAmount' | 'healthFactor' | 'interestRate';
  sortOrder?: 'asc' | 'desc';
}

export interface LendingPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface LendingResponse {
  success: boolean;
  data: {
    loans?: LoanPosition[];
    pools?: LendingPool[];
    userPositions?: UserLendingPosition[];
    pagination?: LendingPagination;
  };
  error?: string;
}

export interface LoanRepayment {
  loanId: string;
  amount: number;
  repaymentType: 'partial' | 'full';
  paymentMethod: 'wallet' | 'collateral_sale';
}

export interface PoolDeposit {
  poolId: string;
  amount: number;
  asset: string;
}

export interface PoolWithdrawal {
  poolId: string;
  amount: number;
  withdrawalType: 'amount' | 'percentage';
}