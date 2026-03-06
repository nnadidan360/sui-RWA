// PHASE 3: Yield-Generating Products
// Task 22.1 - Rental Asset Management
// MongoDB Model for Rental Income Assets

import mongoose, { Schema, Document } from 'mongoose';

export interface ITenant {
  name: string;
  email: string;
  phone: string;
  leaseStart: Date;
  leaseEnd: Date;
  monthlyRent: number;
  securityDeposit: number;
  paymentHistory: Array<{
    date: Date;
    amount: number;
    status: 'paid' | 'late' | 'pending' | 'missed';
    lateDays?: number;
  }>;
}

export interface IPropertyExpense {
  category: 'mortgage' | 'tax' | 'insurance' | 'maintenance' | 'utilities' | 'management' | 'other';
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'annual' | 'one-time';
  date: Date;
  description: string;
  recurring: boolean;
}

export interface IRentalIncomeAsset extends Document {
  // Property Information
  propertyAddress: string;
  propertyType: 'single-family' | 'multi-family' | 'apartment' | 'commercial' | 'other';
  propertyValue: number;
  
  // Ownership
  ownerId: mongoose.Types.ObjectId;
  fractionalTokenId?: mongoose.Types.ObjectId;
  
  // Rental Details
  monthlyRent: number;
  occupancyRate: number; // Percentage (0-100)
  currentTenant?: ITenant;
  tenantHistory: ITenant[];
  
  // Financial Tracking
  totalIncome: number;
  totalExpenses: number;
  netYield: number; // Annual net yield percentage
  expenses: IPropertyExpense[];
  
  // Yield Calculation
  projectedAnnualIncome: number;
  projectedAnnualExpenses: number;
  projectedNetYield: number;
  historicalYield: Array<{
    year: number;
    income: number;
    expenses: number;
    netYield: number;
  }>;
  
  // Tokenization
  isTokenized: boolean;
  tokenSupply?: number;
  tokenPrice?: number;
  managementFeePercentage: number; // Default 10%
  
  // Bank Integration
  bankAccountLinked: boolean;
  bankAccountId?: string;
  autoCollectionEnabled: boolean;
  
  // Status
  status: 'active' | 'vacant' | 'maintenance' | 'suspended';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  leaseStart: {
    type: Date,
    required: true
  },
  leaseEnd: {
    type: Date,
    required: true
  },
  monthlyRent: {
    type: Number,
    required: true,
    min: 0
  },
  securityDeposit: {
    type: Number,
    required: true,
    min: 0
  },
  paymentHistory: [{
    date: {
      type: Date,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['paid', 'late', 'pending', 'missed'],
      required: true
    },
    lateDays: Number
  }]
});

const PropertyExpenseSchema = new Schema<IPropertyExpense>({
  category: {
    type: String,
    enum: ['mortgage', 'tax', 'insurance', 'maintenance', 'utilities', 'management', 'other'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  frequency: {
    type: String,
    enum: ['monthly', 'quarterly', 'annual', 'one-time'],
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  recurring: {
    type: Boolean,
    default: false
  }
});

const RentalIncomeAssetSchema = new Schema<IRentalIncomeAsset>({
  propertyAddress: {
    type: String,
    required: true,
    index: true
  },
  propertyType: {
    type: String,
    enum: ['single-family', 'multi-family', 'apartment', 'commercial', 'other'],
    required: true
  },
  propertyValue: {
    type: Number,
    required: true,
    min: 0
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  fractionalTokenId: {
    type: Schema.Types.ObjectId,
    ref: 'FractionalToken'
  },
  monthlyRent: {
    type: Number,
    required: true,
    min: 0
  },
  occupancyRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  currentTenant: TenantSchema,
  tenantHistory: [TenantSchema],
  totalIncome: {
    type: Number,
    default: 0,
    min: 0
  },
  totalExpenses: {
    type: Number,
    default: 0,
    min: 0
  },
  netYield: {
    type: Number,
    default: 0
  },
  expenses: [PropertyExpenseSchema],
  projectedAnnualIncome: {
    type: Number,
    required: true,
    min: 0
  },
  projectedAnnualExpenses: {
    type: Number,
    required: true,
    min: 0
  },
  projectedNetYield: {
    type: Number,
    required: true
  },
  historicalYield: [{
    year: {
      type: Number,
      required: true
    },
    income: {
      type: Number,
      required: true
    },
    expenses: {
      type: Number,
      required: true
    },
    netYield: {
      type: Number,
      required: true
    }
  }],
  isTokenized: {
    type: Boolean,
    default: false
  },
  tokenSupply: Number,
  tokenPrice: Number,
  managementFeePercentage: {
    type: Number,
    default: 10,
    min: 0,
    max: 100
  },
  bankAccountLinked: {
    type: Boolean,
    default: false
  },
  bankAccountId: String,
  autoCollectionEnabled: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'vacant', 'maintenance', 'suspended'],
    default: 'vacant'
  }
}, {
  timestamps: true
});

// Indexes
RentalIncomeAssetSchema.index({ ownerId: 1, status: 1 });
RentalIncomeAssetSchema.index({ isTokenized: 1 });
RentalIncomeAssetSchema.index({ createdAt: -1 });

// Virtual for annual net income
RentalIncomeAssetSchema.virtual('annualNetIncome').get(function() {
  return this.projectedAnnualIncome - this.projectedAnnualExpenses;
});

// Method to calculate current occupancy rate
RentalIncomeAssetSchema.methods.updateOccupancyRate = function() {
  if (this.currentTenant && this.currentTenant.leaseEnd > new Date()) {
    this.occupancyRate = 100;
  } else {
    this.occupancyRate = 0;
  }
  this.status = this.occupancyRate > 0 ? 'active' : 'vacant';
};

// Method to calculate net yield
RentalIncomeAssetSchema.methods.calculateNetYield = function() {
  if (this.projectedAnnualIncome === 0) return 0;
  
  const netIncome = this.projectedAnnualIncome - this.projectedAnnualExpenses;
  this.projectedNetYield = (netIncome / this.propertyValue) * 100;
  
  return this.projectedNetYield;
};

// Method to add expense
RentalIncomeAssetSchema.methods.addExpense = function(expense: IPropertyExpense) {
  this.expenses.push(expense);
  this.totalExpenses += expense.amount;
  
  // Recalculate projected annual expenses if recurring
  if (expense.recurring) {
    const annualAmount = this.getAnnualAmount(expense.amount, expense.frequency);
    this.projectedAnnualExpenses += annualAmount;
  }
  
  this.calculateNetYield();
};

// Helper to convert expense to annual amount
RentalIncomeAssetSchema.methods.getAnnualAmount = function(amount: number, frequency: string): number {
  switch (frequency) {
    case 'monthly':
      return amount * 12;
    case 'quarterly':
      return amount * 4;
    case 'annual':
      return amount;
    case 'one-time':
      return 0;
    default:
      return 0;
  }
};

export const RentalIncomeAsset = mongoose.model<IRentalIncomeAsset>(
  'RentalIncomeAsset',
  RentalIncomeAssetSchema
);
