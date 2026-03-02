// PHASE 2: Trading Fraud Signal Model
// Extends fraud detection for trading-specific patterns

import mongoose, { Schema, Document } from 'mongoose';

export interface ITradingFraudSignal extends Document {
  userId: mongoose.Types.ObjectId;
  tokenId: mongoose.Types.ObjectId;
  
  // Signal type
  signalType: 'wash_trading' | 'velocity' | 'price_manipulation' | 'collusion' | 'layering';
  
  // Detection details
  confidence: number; // 0-1
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  // Evidence
  tradeCount: number;
  suspiciousTradeIds: string[];
  pattern: string;
  
  // Status
  status: 'detected' | 'under_review' | 'confirmed' | 'false_positive';
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  
  // Actions taken
  actionTaken?: 'warning' | 'suspension' | 'ban' | 'none';
  notes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const TradingFraudSignalSchema = new Schema<ITradingFraudSignal>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tokenId: {
    type: Schema.Types.ObjectId,
    ref: 'FractionalToken',
    required: true,
    index: true
  },
  signalType: {
    type: String,
    enum: ['wash_trading', 'velocity', 'price_manipulation', 'collusion', 'layering'],
    required: true
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  }
}, {
  timestamps: true
});

  tradeCount: {
    type: Number,
    required: true,
    min: 0
  },
  suspiciousTradeIds: [{
    type: String
  }],
  pattern: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['detected', 'under_review', 'confirmed', 'false_positive'],
    default: 'detected'
  },
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  actionTaken: {
    type: String,
    enum: ['warning', 'suspension', 'ban', 'none']
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes
TradingFraudSignalSchema.index({ userId: 1, tokenId: 1 });
TradingFraudSignalSchema.index({ status: 1, severity: 1 });
TradingFraudSignalSchema.index({ createdAt: -1 });

export const TradingFraudSignal = mongoose.model<ITradingFraudSignal>(
  'TradingFraudSignal',
  TradingFraudSignalSchema
);
