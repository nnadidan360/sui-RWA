import mongoose, { Schema, Document } from 'mongoose';

export interface IWallet extends Document {
  // Wallet identification
  address: string; // Wallet address (unique identifier)
  walletType: 'casper_wallet' | 'casper_signer' | 'ledger' | 'walletconnect' | 'other';
  
  // User association
  userId: string; // Reference to User document
  isPrimary: boolean; // Whether this is the user's primary wallet
  nickname?: string; // User-defined nickname for the wallet
  
  // Connection details
  connectionHistory: Array<{
    connectedAt: Date;
    disconnectedAt?: Date;
    sessionDuration?: number; // in milliseconds
    ipAddress?: string;
    userAgent?: string;
    connectionMethod: 'direct' | 'walletconnect' | 'qr_code' | 'deep_link';
  }>;
  
  // Wallet status and health
  status: 'active' | 'inactive' | 'blocked' | 'compromised';
  lastActivity: Date;
  lastBalanceCheck?: Date;
  
  // Security and monitoring
  security: {
    riskLevel: 'low' | 'medium' | 'high';
    flaggedTransactions: Array<{
      transactionId: string;
      reason: string;
      flaggedAt: Date;
      resolved: boolean;
    }>;
    suspiciousActivity: Array<{
      activityType: string;
      description: string;
      detectedAt: Date;
      severity: 'low' | 'medium' | 'high';
      resolved: boolean;
    }>;
  };
  
  // Wallet capabilities and features
  capabilities: {
    supportsMultiSig: boolean;
    supportsHardwareWallet: boolean;
    supportsBiometric: boolean;
    maxTransactionAmount?: number;
    dailyTransactionLimit?: number;
  };
  
  // Balance and asset tracking (cached from blockchain)
  balances: Array<{
    currency: string;
    amount: number;
    lastUpdated: Date;
    source: 'blockchain' | 'cache';
  }>;
  
  // Transaction statistics
  statistics: {
    totalTransactions: number;
    totalVolume: number;
    averageTransactionSize: number;
    lastTransactionAt?: Date;
    favoriteTransactionTypes: Array<{
      type: string;
      count: number;
    }>;
  };
  
  // Preferences and settings
  preferences: {
    defaultCurrency: string;
    transactionConfirmations: number;
    notificationSettings: {
      transactionAlerts: boolean;
      securityAlerts: boolean;
      balanceUpdates: boolean;
    };
  };
  
  // Metadata and custom fields
  metadata: {
    deviceInfo?: {
      platform: string;
      browser?: string;
      version?: string;
    };
    tags: string[]; // User-defined tags
    notes?: string; // User notes about this wallet
    customFields?: Record<string, any>;
  };
  
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

const WalletSchema = new Schema<IWallet>({
  address: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    lowercase: true 
  },
  walletType: { 
    type: String, 
    required: true,
    enum: ['casper_wallet', 'casper_signer', 'ledger', 'walletconnect', 'other'],
    index: true
  },
  
  userId: { type: String, required: true, index: true },
  isPrimary: { type: Boolean, default: false, index: true },
  nickname: String,
  
  connectionHistory: [{
    connectedAt: { type: Date, required: true },
    disconnectedAt: Date,
    sessionDuration: Number,
    ipAddress: String,
    userAgent: String,
    connectionMethod: { 
      type: String, 
      enum: ['direct', 'walletconnect', 'qr_code', 'deep_link'],
      required: true
    }
  }],
  
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'blocked', 'compromised'],
    default: 'active',
    index: true
  },
  lastActivity: { type: Date, required: true, default: Date.now },
  lastBalanceCheck: Date,
  
  security: {
    riskLevel: { 
      type: String, 
      enum: ['low', 'medium', 'high'],
      default: 'low',
      index: true
    },
    flaggedTransactions: [{
      transactionId: { type: String, required: true },
      reason: { type: String, required: true },
      flaggedAt: { type: Date, required: true, default: Date.now },
      resolved: { type: Boolean, default: false }
    }],
    suspiciousActivity: [{
      activityType: { type: String, required: true },
      description: { type: String, required: true },
      detectedAt: { type: Date, required: true, default: Date.now },
      severity: { 
        type: String, 
        enum: ['low', 'medium', 'high'],
        required: true
      },
      resolved: { type: Boolean, default: false }
    }]
  },
  
  capabilities: {
    supportsMultiSig: { type: Boolean, default: false },
    supportsHardwareWallet: { type: Boolean, default: false },
    supportsBiometric: { type: Boolean, default: false },
    maxTransactionAmount: Number,
    dailyTransactionLimit: Number
  },
  
  balances: [{
    currency: { type: String, required: true },
    amount: { type: Number, required: true },
    lastUpdated: { type: Date, required: true, default: Date.now },
    source: { 
      type: String, 
      enum: ['blockchain', 'cache'],
      default: 'blockchain'
    }
  }],
  
  statistics: {
    totalTransactions: { type: Number, default: 0 },
    totalVolume: { type: Number, default: 0 },
    averageTransactionSize: { type: Number, default: 0 },
    lastTransactionAt: Date,
    favoriteTransactionTypes: [{
      type: { type: String, required: true },
      count: { type: Number, required: true, default: 0 }
    }]
  },
  
  preferences: {
    defaultCurrency: { type: String, default: 'CSPR' },
    transactionConfirmations: { type: Number, default: 1 },
    notificationSettings: {
      transactionAlerts: { type: Boolean, default: true },
      securityAlerts: { type: Boolean, default: true },
      balanceUpdates: { type: Boolean, default: false }
    }
  },
  
  metadata: {
    deviceInfo: {
      platform: String,
      browser: String,
      version: String
    },
    tags: { type: [String], default: [] },
    notes: String,
    customFields: { type: Schema.Types.Mixed }
  },
  
  auditTrail: [{
    action: { type: String, required: true },
    performedBy: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    details: { type: Schema.Types.Mixed }
  }]
}, {
  timestamps: true,
  collection: 'wallets'
});

// Comprehensive indexes for performance and queries
WalletSchema.index({ userId: 1, isPrimary: -1 });
WalletSchema.index({ address: 1, status: 1 });
WalletSchema.index({ walletType: 1, status: 1 });
WalletSchema.index({ lastActivity: -1 });
WalletSchema.index({ 'security.riskLevel': 1, status: 1 });
WalletSchema.index({ 'statistics.totalVolume': -1 });
WalletSchema.index({ 'metadata.tags': 1 });

// Ensure only one primary wallet per user
WalletSchema.index({ userId: 1, isPrimary: 1 }, { 
  unique: true, 
  partialFilterExpression: { isPrimary: true } 
});

export const Wallet = mongoose.models.Wallet || mongoose.model<IWallet>('Wallet', WalletSchema);