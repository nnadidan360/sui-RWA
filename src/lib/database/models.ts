import { ObjectId } from 'mongodb';

// Type aliases for the interfaces (to maintain compatibility)
export type IUser = User;
export type IAsset = Asset;
export type ITransaction = Transaction;
export type IWallet = any; // Placeholder for now

// Stub Mongoose-like models for services that expect them
// In a real implementation, these would be proper Mongoose models
export const Asset = {
  find: (filter?: any) => Promise.resolve([] as any[]),
  findOne: (filter?: any) => Promise.resolve(null as any),
  updateOne: (filter: any, update: any) => Promise.resolve({ acknowledged: true }),
  countDocuments: (filter?: any) => Promise.resolve(0),
  aggregate: (pipeline?: any[]) => Promise.resolve([]),
  save: () => Promise.resolve(),
};

export const User = {
  find: (filter?: any) => Promise.resolve([] as any[]),
  findOne: (filter?: any) => Promise.resolve(null as any),
  findByIdAndUpdate: (id: any, update: any) => Promise.resolve(null as any),
  updateOne: (filter: any, update: any) => Promise.resolve({ acknowledged: true }),
  countDocuments: (filter?: any) => Promise.resolve(0),
  aggregate: (pipeline?: any[]) => Promise.resolve([]),
};

export const Transaction = {
  find: (filter?: any) => Promise.resolve([] as any[]),
  findOne: (filter?: any) => Promise.resolve(null as any),
  findOneAndUpdate: (filter: any, update: any) => Promise.resolve(null as any),
  updateOne: (filter: any, update: any) => Promise.resolve({ acknowledged: true }),
  countDocuments: (filter?: any) => Promise.resolve(0),
  aggregate: (pipeline?: any[]) => Promise.resolve([]),
};

export const Wallet = {
  find: (filter?: any) => Promise.resolve([] as any[]),
  findOne: (filter?: any) => Promise.resolve(null as any),
  updateOne: (filter: any, update: any) => Promise.resolve({ acknowledged: true }),
  countDocuments: (filter?: any) => Promise.resolve(0),
};

// User model
export interface User {
  _id?: ObjectId;
  walletAddress: string;
  email?: string;
  name?: string;
  kycStatus: 'pending' | 'approved' | 'rejected';
  kycDocuments?: string[];
  createdAt: Date;
  updatedAt: Date;
  preferences: {
    language: string;
    currency: string;
    notifications: boolean;
  };
}

// Asset model
export interface Asset {
  _id?: ObjectId;
  tokenId: string;
  owner: string; // wallet address
  assetType: 'real_estate' | 'vehicle' | 'equipment' | 'commodity' | 'other';
  name: string;
  description: string;
  location: string;
  valuation: number;
  currency: string;
  status: 'pending' | 'verified' | 'rejected' | 'tokenized';
  documents: {
    name: string;
    ipfsHash: string;
    type: string;
    uploadedAt: Date;
  }[];
  verificationData?: {
    verifiedBy: string;
    verifiedAt: Date;
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Staking position model
export interface StakingPosition {
  _id?: ObjectId;
  staker: string; // wallet address
  stakedAmount: number; // CSPR amount
  derivativeTokens: number; // stCSPR amount
  exchangeRate: number;
  validators: string[];
  rewardsEarned: number;
  status: 'active' | 'unbonding' | 'completed';
  unbondingRequests: {
    amount: number;
    requestedAt: Date;
    completesAt: Date;
    status: 'pending' | 'completed';
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// Loan model
export interface Loan {
  _id?: ObjectId;
  loanId: string;
  borrower: string; // wallet address
  collateralAssets: string[]; // asset token IDs
  collateralValue: number;
  loanAmount: number;
  interestRate: number;
  duration: number; // in days
  status: 'active' | 'repaid' | 'liquidated' | 'defaulted';
  healthFactor: number;
  liquidationThreshold: number;
  payments: {
    amount: number;
    type: 'interest' | 'principal' | 'full';
    paidAt: Date;
    transactionHash: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// Transaction model
export interface Transaction {
  _id?: ObjectId;
  hash: string;
  userId: string; // wallet address
  type: 'stake' | 'unstake' | 'borrow' | 'repay' | 'tokenize' | 'transfer';
  amount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: number;
  gasPrice?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Lending pool model
export interface LendingPool {
  _id?: ObjectId;
  poolId: string;
  asset: string; // CSPR, USDC, etc.
  totalDeposits: number;
  totalBorrows: number;
  utilizationRate: number;
  baseInterestRate: number;
  currentAPY: number;
  poolTokenSupply: number;
  lastUpdateTime: Date;
}

// User lending position model
export interface LendingPosition {
  _id?: ObjectId;
  userId: string; // wallet address
  poolId: string;
  type: 'lender' | 'borrower';
  amount: number;
  poolTokens?: number; // for lenders
  interestEarned?: number; // for lenders
  interestOwed?: number; // for borrowers
  createdAt: Date;
  updatedAt: Date;
}