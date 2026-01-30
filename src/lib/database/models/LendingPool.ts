import mongoose, { Schema, Document } from 'mongoose';

export interface ILendingPool extends Document {
  poolId: string;
  asset: string; // CSPR, USDC, etc.
  
  // Pool metrics
  poolMetrics: {
    totalDeposits: number;
    totalBorrows: number;
    availableLiquidity: number;
    utilizationRate: number; // totalBorrows / totalDeposits
  };
  
  // Interest rates
  interestRates: {
    baseRate: number;
    multiplier: number;
    jumpMultiplier: number;
    optimalUtilization: number;
  };
  
  // Pool configuration
  configuration: {
    collateralFactor: number;
    liquidationThreshold: number;
    liquidationPenalty: number;
    reserveFactor: number;
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const LendingPoolSchema = new Schema<ILendingPool>({
  poolId: { type: String, required: true, unique: true },
  asset: { type: String, required: true },
  poolMetrics: {
    totalDeposits: { type: Number, default: 0 },
    totalBorrows: { type: Number, default: 0 },
    availableLiquidity: { type: Number, default: 0 },
    utilizationRate: { type: Number, default: 0 }
  },
  interestRates: {
    baseRate: { type: Number, required: true },
    multiplier: { type: Number, required: true },
    jumpMultiplier: { type: Number, required: true },
    optimalUtilization: { type: Number, required: true }
  },
  configuration: {
    collateralFactor: { type: Number, required: true },
    liquidationThreshold: { type: Number, required: true },
    liquidationPenalty: { type: Number, required: true },
    reserveFactor: { type: Number, required: true }
  }
}, {
  timestamps: true
});

export const LendingPool = mongoose.model<ILendingPool>('LendingPool', LendingPoolSchema);