// PHASE 2: Asset Tokenization and Fractionalization
// MongoDB Model for Fractional Asset Tokens

import mongoose, { Schema, Document } from 'mongoose';

export interface ITokenHolder {
  userId: mongoose.Types.ObjectId;
  balance: number;
  percentage: number;
  acquiredAt: Date;
  totalDividendsReceived: number;
}

export interface IFractionalToken extends Document {
  // Asset linkage
  originalAssetId: mongoose.Types.ObjectId;
  assetName: string;
  assetDescription: string;
  assetType: 'property' | 'equipment' | 'vehicle' | 'invoice' | 'other';
  
  // Token economics
  totalSupply: number;
  circulatingSupply: number;
  pricePerToken: number; // In cents
  
  // Trading
  tradingEnabled: boolean;
  status: 'pending' | 'active' | 'suspended' | 'closed';
  
  // Ownership
  createdBy: mongoose.Types.ObjectId;
  holders: ITokenHolder[];
  
  // Valuation
  assetValue: number; // Total asset value in cents
  lastValuationUpdate: Date;
  
  // Dividends
  dividendPoolId?: string; // Sui blockchain ID
  totalDividendsDistributed: number;
  
  // Blockchain
  suiTokenId?: string; // On-chain token ID
  suiDividendPoolId?: string; // On-chain dividend pool ID
  
  // Metadata
  metadataUri?: string;
  verificationHash?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const TokenHolderSchema = new Schema<ITokenHolder>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  balance: {
    type: Number,
    required: true,
    min: 0
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  acquiredAt: {
    type: Date,
    default: Date.now
  },
  totalDividendsReceived: {
    type: Number,
    default: 0,
    min: 0
  }
});

const FractionalTokenSchema = new Schema<IFractionalToken>({
  originalAssetId: {
    type: Schema.Types.ObjectId,
    ref: 'Asset',
    required: true,
    index: true
  },
  assetName: {
    type: String,
    required: true,
    trim: true
  },
  assetDescription: {
    type: String,
    required: true
  },
  assetType: {
    type: String,
    enum: ['property', 'equipment', 'vehicle', 'invoice', 'other'],
    required: true
  },
  totalSupply: {
    type: Number,
    required: true,
    min: 100,
    max: 10000000
  },
  circulatingSupply: {
    type: Number,
    required: true,
    min: 0
  },
  pricePerToken: {
    type: Number,
    required: true,
    min: 0
  },
  tradingEnabled: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'closed'],
    default: 'pending'
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  holders: [TokenHolderSchema],
  assetValue: {
    type: Number,
    required: true,
    min: 0
  },
  lastValuationUpdate: {
    type: Date,
    default: Date.now
  },
  dividendPoolId: {
    type: String,
    sparse: true
  },
  totalDividendsDistributed: {
    type: Number,
    default: 0,
    min: 0
  },
  suiTokenId: {
    type: String,
    sparse: true,
    index: true
  },
  suiDividendPoolId: {
    type: String,
    sparse: true
  },
  metadataUri: {
    type: String
  },
  verificationHash: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
FractionalTokenSchema.index({ 'holders.userId': 1 });
FractionalTokenSchema.index({ status: 1, tradingEnabled: 1 });
FractionalTokenSchema.index({ createdAt: -1 });

// Virtual for calculating market cap
FractionalTokenSchema.virtual('marketCap').get(function() {
  return this.totalSupply * this.pricePerToken;
});

// Method to get holder by userId
FractionalTokenSchema.methods.getHolder = function(userId: string) {
  return this.holders.find(h => h.userId.toString() === userId);
};

// Method to update holder balance
FractionalTokenSchema.methods.updateHolderBalance = function(
  userId: string,
  newBalance: number
) {
  const holder = this.holders.find(h => h.userId.toString() === userId);
  if (holder) {
    holder.balance = newBalance;
    holder.percentage = (newBalance / this.totalSupply) * 100;
  }
};

export const FractionalToken = mongoose.model<IFractionalToken>(
  'FractionalToken',
  FractionalTokenSchema
);
