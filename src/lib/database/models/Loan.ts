import mongoose, { Schema, Document } from 'mongoose';

export interface ILoan extends Document {
  loanId: string;
  borrower: string; // wallet address
  
  // Collateral information
  collateral: {
    assets: Array<{
      assetId: string;
      tokenId: string;
      valuationAtLoan: number;
      currentValuation: number;
      ltv: number; // Loan-to-value ratio for this asset
    }>;
    totalValue: number;
    totalLTV: number;
  };
  
  // Loan terms
  loanTerms: {
    principalAmount: number;
    currency: string;
    interestRate: number; // Annual percentage rate
    duration: number; // Duration in days
    startDate: Date;
    maturityDate: Date;
    gracePeriod: number; // Grace period in days
  };
  
  // Current loan status
  currentStatus: {
    outstandingPrincipal: number;
    accruedInterest: number;
    totalOwed: number;
    healthFactor: number; // Collateral value / total owed
    liquidationThreshold: number;
    nextPaymentDue: Date;
    nextPaymentAmount: number;
  };
  
  // Payment history
  payments: Array<{
    paymentId: string;
    amount: number;
    type: 'interest' | 'principal' | 'penalty' | 'full_repayment';
    paidAt: Date;
    transactionHash: string;
    remainingBalance: number;
  }>;
  
  // Risk management
  riskMetrics: {
    initialRiskScore: number;
    currentRiskScore: number;
    riskCategory: 'low' | 'medium' | 'high' | 'critical';
    liquidationRisk: number; // Percentage chance of liquidation
    priceVolatility: number; // Collateral price volatility
  };
  
  // Liquidation information
  liquidation?: {
    triggeredAt: Date;
    triggeredBy: string;
    liquidationPrice: number;
    recoveredAmount: number;
    liquidationFee: number;
    remainingDebt: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
  };
  
  // Loan status
  status: 'active' | 'repaid' | 'liquidated' | 'defaulted' | 'cancelled';
  
  // Audit trail
  auditTrail: Array<{
    action: string;
    performedBy: string;
    timestamp: Date;
    details: Record<string, any>;
  }>;
  
  createdAt: Date;
  updatedAt: Date;
}

const LoanSchema = new Schema<ILoan>({
  loanId: { type: String, required: true, unique: true, index: true },
  borrower: { type: String, required: true, index: true },
  
  collateral: {
    assets: [{
      assetId: { type: String, required: true },
      tokenId: { type: String, required: true },
      valuationAtLoan: { type: Number, required: true },
      currentValuation: { type: Number, required: true },
      ltv: { type: Number, required: true }
    }],
    totalValue: { type: Number, required: true },
    totalLTV: { type: Number, required: true }
  },
  
  loanTerms: {
    principalAmount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'CSPR' },
    interestRate: { type: Number, required: true },
    duration: { type: Number, required: true },
    startDate: { type: Date, required: true },
    maturityDate: { type: Date, required: true },
    gracePeriod: { type: Number, default: 7 }
  },
  
  currentStatus: {
    outstandingPrincipal: { type: Number, required: true },
    accruedInterest: { type: Number, default: 0 },
    totalOwed: { type: Number, required: true },
    healthFactor: { type: Number, required: true },
    liquidationThreshold: { type: Number, required: true, default: 0.8 },
    nextPaymentDue: { type: Date, required: true },
    nextPaymentAmount: { type: Number, required: true }
  },
  
  payments: [{
    paymentId: { type: String, required: true },
    amount: { type: Number, required: true },
    type: { 
      type: String, 
      enum: ['interest', 'principal', 'penalty', 'full_repayment'],
      required: true 
    },
    paidAt: { type: Date, required: true },
    transactionHash: { type: String, required: true },
    remainingBalance: { type: Number, required: true }
  }],
  
  riskMetrics: {
    initialRiskScore: { type: Number, required: true },
    currentRiskScore: { type: Number, required: true },
    riskCategory: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'critical'],
      required: true 
    },
    liquidationRisk: { type: Number, default: 0 },
    priceVolatility: { type: Number, default: 0 }
  },
  
  liquidation: {
    triggeredAt: Date,
    triggeredBy: String,
    liquidationPrice: Number,
    recoveredAmount: Number,
    liquidationFee: Number,
    remainingDebt: Number,
    status: { 
      type: String, 
      enum: ['pending', 'in_progress', 'completed', 'failed']
    }
  },
  
  status: { 
    type: String, 
    enum: ['active', 'repaid', 'liquidated', 'defaulted', 'cancelled'],
    default: 'active',
    index: true
  },
  
  auditTrail: [{
    action: { type: String, required: true },
    performedBy: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    details: { type: Schema.Types.Mixed }
  }]
}, {
  timestamps: true,
  collection: 'loans'
});

// Indexes for performance
LoanSchema.index({ borrower: 1, status: 1 });
LoanSchema.index({ status: 1, 'currentStatus.healthFactor': 1 });
LoanSchema.index({ 'loanTerms.maturityDate': 1, status: 1 });
LoanSchema.index({ 'currentStatus.nextPaymentDue': 1, status: 1 });
LoanSchema.index({ 'riskMetrics.riskCategory': 1, status: 1 });

export const Loan = mongoose.models.Loan || mongoose.model<ILoan>('Loan', LoanSchema);