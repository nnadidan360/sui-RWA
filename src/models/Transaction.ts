import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  // Transaction identification
  transactionId: string; // Internal transaction ID
  txHash?: string; // Sui blockchain transaction hash
  blockHash?: string; // Block hash containing the transaction
  blockNumber?: number; // Block number
  
  // Transaction details
  type: 'asset_tokenization' | 'lending_deposit' | 'lending_withdraw' | 'loan_origination' | 
        'loan_repayment' | 'liquidation' | 'staking' | 'unstaking' | 'reward_claim' | 'other';
  status: 'pending' | 'processing' | 'success' | 'failed' | 'timeout' | 'cancelled';
  
  // Parties involved
  initiator: string; // Internal user ID that initiated the transaction
  recipient?: string; // Recipient internal user ID (if applicable)
  
  // Financial details
  amount?: number; // Transaction amount
  currency: string; // Currency/token type
  fee?: number; // Transaction fee
  
  // On-chain correlation
  onChainData: {
    contractAddress?: string;
    functionName?: string; // Smart contract function called
    gasUsed?: number;
    gasPrice?: number;
    confirmations: number;
    finalityStatus: 'pending' | 'confirmed' | 'finalized';
  };
  
  // Off-chain correlation
  offChainData: {
    relatedAssetId?: string; // Related asset token ID
    relatedLoanId?: string; // Related loan ID
    relatedPoolId?: string; // Related lending pool ID
    userSessionId?: string; // User session that initiated the transaction
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  };
  
  // Timing information
  initiatedAt: Date;
  submittedAt?: Date; // When submitted to blockchain
  confirmedAt?: Date; // When confirmed on blockchain
  finalizedAt?: Date; // When finalized on blockchain
  
  // Error handling
  errorDetails?: {
    errorCode?: string;
    errorMessage?: string;
    retryCount: number;
    lastRetryAt?: Date;
    canRetry: boolean;
  };
  
  // Audit trail
  auditTrail: Array<{
    action: string;
    timestamp: Date;
    details: Record<string, any>;
  }>;
  
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
  transactionId: { type: String, required: true, unique: true, index: true },
  deployHash: { type: String, unique: true, sparse: true, index: true },
  blockHash: { type: String, index: true },
  blockNumber: { type: Number, index: true },
  
  type: { 
    type: String, 
    required: true,
    enum: ['asset_tokenization', 'lending_deposit', 'lending_withdraw', 'loan_origination', 
           'loan_repayment', 'liquidation', 'staking', 'unstaking', 'reward_claim', 'other'],
    index: true
  },
  status: { 
    type: String, 
    required: true,
    enum: ['pending', 'processing', 'success', 'failed', 'timeout', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  initiator: { type: String, required: true, index: true },
  recipient: { type: String, index: true },
  
  amount: Number,
  currency: { type: String, required: true, default: 'SUI' },
  fee: Number,
  
  onChainData: {
    contractAddress: String,
    functionName: String,
    gasUsed: Number,
    gasPrice: Number,
    confirmations: { type: Number, default: 0 },
    finalityStatus: { 
      type: String, 
      enum: ['pending', 'confirmed', 'finalized'],
      default: 'pending'
    }
  },
  
  offChainData: {
    relatedAssetId: { type: String, index: true },
    relatedLoanId: { type: String, index: true },
    relatedPoolId: { type: String, index: true },
    userSessionId: String,
    ipAddress: String,
    userAgent: String,
    metadata: { type: Schema.Types.Mixed }
  },
  
  initiatedAt: { type: Date, required: true, default: Date.now },
  submittedAt: Date,
  confirmedAt: Date,
  finalizedAt: Date,
  
  errorDetails: {
    errorCode: String,
    errorMessage: String,
    retryCount: { type: Number, default: 0 },
    lastRetryAt: Date,
    canRetry: { type: Boolean, default: true }
  },
  
  auditTrail: [{
    action: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    details: { type: Schema.Types.Mixed }
  }]
}, {
  timestamps: true,
  collection: 'transactions'
});

// Comprehensive indexes for performance
TransactionSchema.index({ initiator: 1, createdAt: -1 });
TransactionSchema.index({ type: 1, status: 1 });
TransactionSchema.index({ status: 1, initiatedAt: -1 });
TransactionSchema.index({ deployHash: 1, status: 1 });
TransactionSchema.index({ 'onChainData.finalityStatus': 1, 'onChainData.confirmations': 1 });
TransactionSchema.index({ 'offChainData.relatedAssetId': 1 });
TransactionSchema.index({ 'offChainData.relatedLoanId': 1 });
TransactionSchema.index({ currency: 1, amount: -1 });

export const Transaction = mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', TransactionSchema);