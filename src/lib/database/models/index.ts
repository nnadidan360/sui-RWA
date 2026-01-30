/**
 * Enhanced Database Models for Astake
 * 
 * This module exports all database models with enhanced features for:
 * - IPFS backup and search indexing for Assets
 * - Multi-wallet associations for Users
 * - On-chain/off-chain correlation for Transactions
 * - Multi-wallet support tracking for Wallets
 */

export { Asset, type IAsset } from './Asset';
export { User, type IUser } from './User';
export { Transaction, type ITransaction } from './Transaction';
export { Wallet, type IWallet } from './Wallet';
export { LendingPool, type ILendingPool } from './LendingPool';
export { Loan, type ILoan } from './Loan';
export { StakingPosition, type IStakingPosition } from './StakingPosition';