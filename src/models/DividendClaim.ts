// PHASE 2: Asset Tokenization and Fractionalization
// Task 16.3 - Dividend Claim Model
// Tracks dividend claim history for tax reporting and analytics

import mongoose, { Schema, Document } from 'mongoose';

export interface IDividendClaim extends Document {
  claimId: string;
  distributionId: string;
  poolId: string;
  tokenId: string;
  
  // Holder information
  holder: string;
  tokenBalance: string;
  
  // Claim details
  claimableAmount: string;
  claimedAmount: string;
  isClaimed: boolean;
  claimedAt?: Date;
  
  // Transaction details
  transactionHash?: string;
  blockNumber?: number;
  
  // Tax reporting
  taxYear: number;
  reportingCurrency: string;
  exchangeRate?: number;
  fiatValue?: string;
  
  // Reinvestment
  wasReinvested: boolean;
  reinvestedAmount?: string;
  reinvestedTokens?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const DividendClaimSchema: Schema = new Schema(
  {
    claimId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    distributionId: {
      type: String,
      required: true,
      index: true,
    },
    poolId: {
      type: String,
      required: true,
      index: true,
    },
    tokenId: {
      type: String,
      required: true,
      index: true,
    },
    holder: {
      type: String,
      required: true,
      index: true,
    },
    tokenBalance: {
      type: String,
      required: true,
    },
    claimableAmount: {
      type: String,
      required: true,
    },
    claimedAmount: {
      type: String,
      default: '0',
    },
    isClaimed: {
      type: Boolean,
      default: false,
      index: true,
    },
    claimedAt: {
      type: Date,
    },
    transactionHash: {
      type: String,
    },
    blockNumber: {
      type: Number,
    },
    taxYear: {
      type: Number,
      required: true,
      index: true,
    },
    reportingCurrency: {
      type: String,
      default: 'USD',
    },
    exchangeRate: {
      type: Number,
    },
    fiatValue: {
      type: String,
    },
    wasReinvested: {
      type: Boolean,
      default: false,
    },
    reinvestedAmount: {
      type: String,
    },
    reinvestedTokens: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
DividendClaimSchema.index({ holder: 1, taxYear: 1 });
DividendClaimSchema.index({ holder: 1, tokenId: 1 });
DividendClaimSchema.index({ distributionId: 1, holder: 1 }, { unique: true });

export default mongoose.model<IDividendClaim>('DividendClaim', DividendClaimSchema);
