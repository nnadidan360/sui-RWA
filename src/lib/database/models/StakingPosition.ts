import mongoose, { Schema, Document } from 'mongoose';

export interface IStakingPosition extends Document {
  positionId: string;
  staker: string; // wallet address
  stakedAmount: number; // CSPR amount
  derivativeTokens: number; // stCSPR amount
  exchangeRate: number;
  
  // External wallet integration
  externalWalletData: {
    walletId: string;
    delegatedValidators: Array<{
      validatorAddress: string;
      delegatedAmount: number;
      delegationDate: Date;
      isActive: boolean;
    }>;
    totalDelegated: number;
    availableRewards: number;
    lastSyncTime: Date;
  };
  
  // Staking details
  stakingData: {
    initialStakeDate: Date;
    lastRewardClaim?: Date;
    totalRewardsEarned: number;
    currentAPY: number;
    compoundingEnabled: boolean;
  };
  
  // Unbonding requests
  unbondingRequests: Array<{
    requestId: string;
    amount: number;
    requestedAt: Date;
    completesAt: Date;
    status: 'pending' | 'processing' | 'completed' | 'cancelled';
    transactionHash?: string;
  }>;
  
  // Position status
  status: 'active' | 'unbonding' | 'completed' | 'suspended';
  
  // Performance tracking
  performance: {
    totalReturn: number;
    totalReturnPercentage: number;
    averageAPY: number;
    bestAPY: number;
    worstAPY: number;
    performanceHistory: Array<{
      date: Date;
      apy: number;
      totalValue: number;
      rewards: number;
    }>;
  };
  
  // Risk management
  riskMetrics: {
    validatorRisk: 'low' | 'medium' | 'high';
    slashingEvents: Array<{
      date: Date;
      validator: string;
      amount: number;
      reason: string;
    }>;
    diversificationScore: number; // 0-100
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const StakingPositionSchema = new Schema<IStakingPosition>({
  positionId: { type: String, required: true, unique: true, index: true },
  staker: { type: String, required: true, index: true },
  stakedAmount: { type: Number, required: true },
  derivativeTokens: { type: Number, required: true },
  exchangeRate: { type: Number, required: true, default: 1.0 },
  
  externalWalletData: {
    walletId: { type: String, required: true },
    delegatedValidators: [{
      validatorAddress: { type: String, required: true },
      delegatedAmount: { type: Number, required: true },
      delegationDate: { type: Date, required: true },
      isActive: { type: Boolean, default: true }
    }],
    totalDelegated: { type: Number, required: true, default: 0 },
    availableRewards: { type: Number, default: 0 },
    lastSyncTime: { type: Date, default: Date.now }
  },
  
  stakingData: {
    initialStakeDate: { type: Date, required: true, default: Date.now },
    lastRewardClaim: Date,
    totalRewardsEarned: { type: Number, default: 0 },
    currentAPY: { type: Number, default: 0 },
    compoundingEnabled: { type: Boolean, default: true }
  },
  
  unbondingRequests: [{
    requestId: { type: String, required: true },
    amount: { type: Number, required: true },
    requestedAt: { type: Date, required: true },
    completesAt: { type: Date, required: true },
    status: { 
      type: String, 
      enum: ['pending', 'processing', 'completed', 'cancelled'],
      default: 'pending'
    },
    transactionHash: String
  }],
  
  status: { 
    type: String, 
    enum: ['active', 'unbonding', 'completed', 'suspended'],
    default: 'active',
    index: true
  },
  
  performance: {
    totalReturn: { type: Number, default: 0 },
    totalReturnPercentage: { type: Number, default: 0 },
    averageAPY: { type: Number, default: 0 },
    bestAPY: { type: Number, default: 0 },
    worstAPY: { type: Number, default: 0 },
    performanceHistory: [{
      date: { type: Date, required: true },
      apy: { type: Number, required: true },
      totalValue: { type: Number, required: true },
      rewards: { type: Number, required: true }
    }]
  },
  
  riskMetrics: {
    validatorRisk: { 
      type: String, 
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    slashingEvents: [{
      date: { type: Date, required: true },
      validator: { type: String, required: true },
      amount: { type: Number, required: true },
      reason: { type: String, required: true }
    }],
    diversificationScore: { type: Number, default: 0, min: 0, max: 100 }
  }
}, {
  timestamps: true,
  collection: 'staking_positions'
});

// Indexes for performance
StakingPositionSchema.index({ staker: 1, status: 1 });
StakingPositionSchema.index({ status: 1, createdAt: -1 });
StakingPositionSchema.index({ 'externalWalletData.walletId': 1 });
StakingPositionSchema.index({ 'stakingData.initialStakeDate': -1 });

export const StakingPosition = mongoose.models.StakingPosition || mongoose.model<IStakingPosition>('StakingPosition', StakingPositionSchema);