// PHASE 3: Yield-Generating Products
// Task 23.1 - Invoice Asset Processing
// MongoDB Model for Invoice Factoring Assets

import mongoose, { Schema, Document } from 'mongoose';

export interface IDebtor {
  name: string;
  businessName: string;
  email: string;
  creditRating: number; // 0-100 score
  paymentHistory: Array<{
    invoiceId: string;
    dueDate: Date;
    paidDate?: Date;
    amount: number;
    status: 'paid' | 'late' | 'pending' | 'defaulted';
    daysLate?: number;
  }>;
  totalInvoices: number;
  onTimePaymentRate: number;
}

export interface IInvoiceAsset extends Document {
  // Invoice Details
  invoiceNumber: string;
  issuerBusinessId: mongoose.Types.ObjectId;
  debtor: IDebtor;
  
  // Financial Details
  invoiceAmount: number;
  dueDate: Date;
  issueDate: Date;
  paymentTerms: number; // Days (e.g., 30, 60, 90)
  
  // Factoring Details
  isFactored: boolean;
  factoringDate?: Date;
  discountRate: number; // Percentage (e.g., 2.5%)
  advanceRate: number; // Percentage of invoice amount advanced (e.g., 80%)
  advanceAmount: number; // Actual amount advanced to business
  factoringFee: number; // Fee charged for factoring
  
  // Tokenization
  isTokenized: boolean;
  fractionalTokenId?: mongoose.Types.ObjectId;
  tokenSupply?: number;
  tokenPrice?: number;
  
  // Payment Tracking
  paymentStatus: 'pending' | 'paid' | 'late' | 'defaulted';
  paidDate?: Date;
  paidAmount?: number;
  daysOverdue: number;
  
  // Escrow
  escrowAddress?: string;
  escrowBalance: number;
  
  // Risk Assessment
  riskScore: number; // 0-100, higher is riskier
  expectedPaymentDate: Date;
  
  // Status
  status: 'draft' | 'submitted' | 'approved' | 'funded' | 'collecting' | 'paid' | 'defaulted';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  calculateDiscountRate(): number;
  calculateAdvanceAmount(): number;
  updatePaymentStatus(): void;
  recordPayment(amount: number, date: Date): void;
  updateDebtorMetrics(): void;
}

const DebtorSchema = new Schema<IDebtor>({
  name: {
    type: String,
    required: true
  },
  businessName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  creditRating: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  paymentHistory: [{
    invoiceId: String,
    dueDate: Date,
    paidDate: Date,
    amount: Number,
    status: {
      type: String,
      enum: ['paid', 'late', 'pending', 'defaulted']
    },
    daysLate: Number
  }],
  totalInvoices: {
    type: Number,
    default: 0
  },
  onTimePaymentRate: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  }
});

const InvoiceAssetSchema = new Schema<IInvoiceAsset>({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  issuerBusinessId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  debtor: {
    type: DebtorSchema,
    required: true
  },
  invoiceAmount: {
    type: Number,
    required: true,
    min: 0
  },
  dueDate: {
    type: Date,
    required: true,
    index: true
  },
  issueDate: {
    type: Date,
    required: true
  },
  paymentTerms: {
    type: Number,
    required: true,
    min: 0
  },
  isFactored: {
    type: Boolean,
    default: false
  },
  factoringDate: Date,
  discountRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  advanceRate: {
    type: Number,
    default: 80,
    min: 0,
    max: 100
  },
  advanceAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  factoringFee: {
    type: Number,
    default: 0,
    min: 0
  },
  isTokenized: {
    type: Boolean,
    default: false
  },
  fractionalTokenId: {
    type: Schema.Types.ObjectId,
    ref: 'FractionalToken'
  },
  tokenSupply: Number,
  tokenPrice: Number,
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'late', 'defaulted'],
    default: 'pending'
  },
  paidDate: Date,
  paidAmount: Number,
  daysOverdue: {
    type: Number,
    default: 0,
    min: 0
  },
  escrowAddress: String,
  escrowBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  expectedPaymentDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'funded', 'collecting', 'paid', 'defaulted'],
    default: 'draft'
  }
}, {
  timestamps: true
});

// Indexes
InvoiceAssetSchema.index({ issuerBusinessId: 1, status: 1 });
InvoiceAssetSchema.index({ 'debtor.creditRating': 1 });
InvoiceAssetSchema.index({ isFactored: 1, paymentStatus: 1 });
InvoiceAssetSchema.index({ dueDate: 1, paymentStatus: 1 });

// Virtual for days until due
InvoiceAssetSchema.virtual('daysUntilDue').get(function() {
  const now = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Method to calculate discount rate based on risk
InvoiceAssetSchema.methods.calculateDiscountRate = function(): number {
  // Base rate
  let rate = 2.0;
  
  // Adjust based on credit rating (lower rating = higher rate)
  if (this.debtor.creditRating < 50) {
    rate += 3.0;
  } else if (this.debtor.creditRating < 70) {
    rate += 1.5;
  }
  
  // Adjust based on payment terms (longer terms = higher rate)
  if (this.paymentTerms > 60) {
    rate += 1.0;
  } else if (this.paymentTerms > 90) {
    rate += 2.0;
  }
  
  // Adjust based on payment history
  if (this.debtor.onTimePaymentRate < 80) {
    rate += 2.0;
  } else if (this.debtor.onTimePaymentRate < 90) {
    rate += 1.0;
  }
  
  this.discountRate = rate;
  return rate;
};

// Method to calculate advance amount
InvoiceAssetSchema.methods.calculateAdvanceAmount = function(): number {
  const discountAmount = (this.invoiceAmount * this.discountRate) / 100;
  const advanceAmount = (this.invoiceAmount * this.advanceRate) / 100;
  
  this.advanceAmount = advanceAmount - discountAmount;
  this.factoringFee = discountAmount;
  
  return this.advanceAmount;
};

// Method to update payment status
InvoiceAssetSchema.methods.updatePaymentStatus = function() {
  const now = new Date();
  const due = new Date(this.dueDate);
  
  if (this.paymentStatus === 'paid') {
    return;
  }
  
  if (now > due) {
    const diffTime = now.getTime() - due.getTime();
    this.daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (this.daysOverdue > 90) {
      this.paymentStatus = 'defaulted';
    } else {
      this.paymentStatus = 'late';
    }
  }
};

// Method to record payment
InvoiceAssetSchema.methods.recordPayment = function(amount: number, date: Date) {
  this.paidAmount = amount;
  this.paidDate = date;
  this.paymentStatus = 'paid';
  this.status = 'paid';
  
  // Update debtor payment history
  this.debtor.paymentHistory.push({
    invoiceId: this.invoiceNumber,
    dueDate: this.dueDate,
    paidDate: date,
    amount,
    status: date > this.dueDate ? 'late' : 'paid',
    daysLate: date > this.dueDate ? Math.ceil((date.getTime() - this.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
  });
  
  // Recalculate debtor metrics
  this.updateDebtorMetrics();
};

// Method to update debtor metrics
InvoiceAssetSchema.methods.updateDebtorMetrics = function() {
  const history = this.debtor.paymentHistory;
  this.debtor.totalInvoices = history.length;
  
  const onTimePayments = history.filter((p: any) => p.status === 'paid' && (!p.daysLate || p.daysLate === 0)).length;
  this.debtor.onTimePaymentRate = history.length > 0 ? (onTimePayments / history.length) * 100 : 100;
  
  // Adjust credit rating based on payment history
  if (this.debtor.onTimePaymentRate >= 95) {
    this.debtor.creditRating = Math.min(100, this.debtor.creditRating + 5);
  } else if (this.debtor.onTimePaymentRate < 70) {
    this.debtor.creditRating = Math.max(0, this.debtor.creditRating - 10);
  }
};

export const InvoiceAsset = mongoose.model<IInvoiceAsset>(
  'InvoiceAsset',
  InvoiceAssetSchema
);
