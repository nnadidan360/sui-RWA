// PHASE 2: Asset Tokenization and Fractionalization
// Task 16.3 - Dividend Preference Model
// Tracks holder preferences for dividend reinvestment and tax reporting

import mongoose, { Schema, Document } from 'mongoose';

export interface IDividendPreference extends Document {
  holder: string;
  tokenId: string;
  
  // Reinvestment settings
  reinvestmentEnabled: boolean;
  reinvestmentPercentage: number; // 0-100
  
  // Tax reporting
  taxCountry: string;
  taxId?: string;
  reportingCurrency: string;
  
  // Notification preferences
  notifyOnDistribution: boolean;
  notifyOnClaim: boolean;
  emailNotifications: boolean;
  
  // History
  totalDividendsReceived: string;
  totalDividendsReinvested: string;
  claimCount: number;
  lastClaimDate?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const DividendPreferenceSchema: Schema = new Schema(
  {
    holder: {
      type: String,
      required: true,
      index: true,
    },
    tokenId: {
      type: String,
      required: true,
      index: true,
    },
    reinvestmentEnabled: {
      type: Boolean,
      default: false,
    },
    reinvestmentPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    taxCountry: {
      type: String,
      required: true,
      default: 'US',
    },
    taxId: {
      type: String,
    },
    reportingCurrency: {
      type: String,
      default: 'USD',
    },
    notifyOnDistribution: {
      type: Boolean,
      default: true,
    },
    notifyOnClaim: {
      type: Boolean,
      default: true,
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    totalDividendsReceived: {
      type: String,
      default: '0',
    },
    totalDividendsReinvested: {
      type: String,
      default: '0',
    },
    claimCount: {
      type: Number,
      default: 0,
    },
    lastClaimDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
DividendPreferenceSchema.index({ holder: 1, tokenId: 1 }, { unique: true });

export default mongoose.model<IDividendPreference>('DividendPreference', DividendPreferenceSchema);
