import mongoose, { Schema, Document } from 'mongoose';

/**
 * Credit Profile Model for Internal Credit Bureau
 * Stores private credit history without affecting external credit scores
 */
export interface ICreditProfile extends Document {
  userId: string; // Internal user ID
  
  // Internal credit scoring (private, not reported externally)
  creditScore: {
    score: number; // 300-850 range
    lastUpdated: Date;
    factors: {
      paymentHistory: number; // 0-100
      creditUtilization: number; // 0-100
      accountAge: number; // 0-100
      accountMix: number; // 0-100
      recentActivity: number; // 0-100
    };
  };
  
  // Borrowing history
  borrowingHistory: {
    totalLoans: number;
    activeLoans: number;
    completedLoans: number;
    defaultedLoans: number;
    totalBorrowed: number;
    totalRepaid: number;
    averageLoanSize: number;
    largestLoan: number;
  };
  
  // Payment behavior
  paymentBehavior: {
    onTimePayments: number;
    latePayments: number;
    missedPayments: number;
    averagePaymentDelay: number; // in days
    longestPaymentDelay: number;
    earlyPayments: number;
    paymentReliabilityScore: number; // 0-100
  };
  
  // Credit utilization
  creditUtilization: {
    totalCreditLimit: number;
    currentUtilization: number;
    utilizationPercentage: number;
    peakUtilization: number;
    averageUtilization: number;
  };
  
  // Risk assessment
  riskProfile: {
    riskLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
    riskScore: number; // 0-100
    defaultProbability: number; // 0-1
    recommendedMaxLoan: number;
    recommendedLTV: number;
    lastAssessment: Date;
  };
  
  // Account information
  accountInfo: {
    accountAge: number; // in days
    firstLoanDate?: Date;
    lastLoanDate?: Date;
    lastPaymentDate?: Date;
    accountStatus: 'active' | 'inactive' | 'suspended' | 'closed';
  };
  
  // Collateral history
  collateralHistory: {
    totalCollateralProvided: number;
    currentCollateralValue: number;
    collateralTypes: string[];
    liquidationEvents: number;
    collateralReliabilityScore: number; // 0-100
  };
  
  // Credit events
  creditEvents: Array<{
    eventType: 'loan_originated' | 'payment_made' | 'payment_late' | 'payment_missed' | 
               'loan_repaid' | 'loan_defaulted' | 'liquidation' | 'credit_increase' | 'credit_decrease';
    eventDate: Date;
    impact: number; // -100 to +100
    description: string;
    metadata?: Record<string, any>;
  }>;
  
  // Credit limits
  creditLimits: {
    currentLimit: number;
    availableCredit: number;
    pendingCredit: number;
    limitHistory: Array<{
      limit: number;
      effectiveDate: Date;
      reason: string;
    }>;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const CreditProfileSchema = new Schema<ICreditProfile>({
  userId: { type: String, required: true, unique: true, index: true },
  
  creditScore: {
    score: { type: Number, required: true, default: 500, min: 300, max: 850 },
    lastUpdated: { type: Date, required: true, default: Date.now },
    factors: {
      paymentHistory: { type: Number, default: 50, min: 0, max: 100 },
      creditUtilization: { type: Number, default: 50, min: 0, max: 100 },
      accountAge: { type: Number, default: 50, min: 0, max: 100 },
      accountMix: { type: Number, default: 50, min: 0, max: 100 },
      recentActivity: { type: Number, default: 50, min: 0, max: 100 }
    }
  },
  
  borrowingHistory: {
    totalLoans: { type: Number, default: 0 },
    activeLoans: { type: Number, default: 0 },
    completedLoans: { type: Number, default: 0 },
    defaultedLoans: { type: Number, default: 0 },
    totalBorrowed: { type: Number, default: 0 },
    totalRepaid: { type: Number, default: 0 },
    averageLoanSize: { type: Number, default: 0 },
    largestLoan: { type: Number, default: 0 }
  },
  
  paymentBehavior: {
    onTimePayments: { type: Number, default: 0 },
    latePayments: { type: Number, default: 0 },
    missedPayments: { type: Number, default: 0 },
    averagePaymentDelay: { type: Number, default: 0 },
    longestPaymentDelay: { type: Number, default: 0 },
    earlyPayments: { type: Number, default: 0 },
    paymentReliabilityScore: { type: Number, default: 100, min: 0, max: 100 }
  },
  
  creditUtilization: {
    totalCreditLimit: { type: Number, default: 0 },
    currentUtilization: { type: Number, default: 0 },
    utilizationPercentage: { type: Number, default: 0, min: 0, max: 100 },
    peakUtilization: { type: Number, default: 0 },
    averageUtilization: { type: Number, default: 0 }
  },
  
  riskProfile: {
    riskLevel: { 
      type: String, 
      enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
      default: 'medium'
    },
    riskScore: { type: Number, default: 50, min: 0, max: 100 },
    defaultProbability: { type: Number, default: 0.1, min: 0, max: 1 },
    recommendedMaxLoan: { type: Number, default: 0 },
    recommendedLTV: { type: Number, default: 0.5, min: 0, max: 1 },
    lastAssessment: { type: Date, default: Date.now }
  },
  
  accountInfo: {
    accountAge: { type: Number, default: 0 },
    firstLoanDate: Date,
    lastLoanDate: Date,
    lastPaymentDate: Date,
    accountStatus: { 
      type: String, 
      enum: ['active', 'inactive', 'suspended', 'closed'],
      default: 'active'
    }
  },
  
  collateralHistory: {
    totalCollateralProvided: { type: Number, default: 0 },
    currentCollateralValue: { type: Number, default: 0 },
    collateralTypes: [{ type: String }],
    liquidationEvents: { type: Number, default: 0 },
    collateralReliabilityScore: { type: Number, default: 100, min: 0, max: 100 }
  },
  
  creditEvents: [{
    eventType: { 
      type: String, 
      enum: ['loan_originated', 'payment_made', 'payment_late', 'payment_missed', 
             'loan_repaid', 'loan_defaulted', 'liquidation', 'credit_increase', 'credit_decrease'],
      required: true 
    },
    eventDate: { type: Date, required: true, default: Date.now },
    impact: { type: Number, required: true, min: -100, max: 100 },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed }
  }],
  
  creditLimits: {
    currentLimit: { type: Number, default: 0 },
    availableCredit: { type: Number, default: 0 },
    pendingCredit: { type: Number, default: 0 },
    limitHistory: [{
      limit: { type: Number, required: true },
      effectiveDate: { type: Date, required: true, default: Date.now },
      reason: { type: String, required: true }
    }]
  }
}, {
  timestamps: true,
  collection: 'credit_profiles'
});

// Indexes for performance
CreditProfileSchema.index({ 'creditScore.score': 1 });
CreditProfileSchema.index({ 'riskProfile.riskLevel': 1 });
CreditProfileSchema.index({ 'accountInfo.accountStatus': 1 });

export const CreditProfile = mongoose.models.CreditProfile || mongoose.model<ICreditProfile>('CreditProfile', CreditProfileSchema)