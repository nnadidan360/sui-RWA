export type UnbondingStatus = 'pending' | 'ready' | 'completed' | 'cancelled';

export type ValidatorStatus = 'active' | 'inactive' | 'jailed' | 'unbonding';

export interface ValidatorInfo {
  address: string;
  name: string;
  commission: number; // Percentage (e.g., 5.5 for 5.5%)
  delegatedAmount: number;
  totalStaked: number;
  performance: number; // Performance score (0-100)
  uptime: number; // Uptime percentage
  isActive: boolean;
  status: ValidatorStatus;
  apr: number; // Annual percentage rate
  logo?: string;
  website?: string;
  description?: string;
}

export interface StakingPosition {
  id: string;
  staker: string; // wallet address
  stakedAmount: number; // Original CSPR amount staked
  derivativeTokens: number; // Amount of staked derivative tokens received
  externalWalletId: string;
  delegatedValidators: ValidatorDelegation[];
  rewardsEarned: number;
  currentValue: number; // Current value including rewards
  exchangeRate: number; // Current exchange rate (derivative tokens to CSPR)
  unbondingRequests: UnbondingRequest[];
  createdAt: Date;
  lastRewardClaim: Date;
}

export interface ValidatorDelegation {
  validatorAddress: string;
  validatorName: string;
  amount: number;
  delegatedAt: Date;
  rewards: number;
  apr: number;
}

export interface UnbondingRequest {
  id: string;
  amount: number; // Amount of derivative tokens being unbonded
  csperAmount: number; // Equivalent CSPR amount at time of request
  initiatedAt: Date;
  completesAt: Date;
  status: UnbondingStatus;
  estimatedValue: number; // Current estimated value
}

export interface StakingReward {
  id: string;
  staker: string;
  validatorAddress: string;
  amount: number;
  timestamp: Date;
  epoch: number;
  claimed: boolean;
}

export interface ExternalWalletBalance {
  walletId: string;
  totalStaked: number;
  availableRewards: number;
  pendingUnbonding: number;
  lastSyncTime: Date;
  validators: ValidatorBalance[];
}

export interface ValidatorBalance {
  validatorAddress: string;
  stakedAmount: number;
  rewards: number;
  unbondingAmount: number;
}

export interface StakingMetrics {
  totalValueLocked: number;
  totalStakers: number;
  averageAPR: number;
  exchangeRate: number;
  totalRewardsDistributed: number;
  activeValidators: number;
  networkStakingRatio: number; // Percentage of total CSPR staked
}

export interface StakeRequest {
  amount: number;
  validators: string[]; // Validator addresses to delegate to
  distributionStrategy: 'equal' | 'performance' | 'custom';
  customDistribution?: { [validatorAddress: string]: number }; // Percentage distribution
}

export interface UnstakeRequest {
  amount: number; // Amount of derivative tokens to unstake
  immediate: boolean; // Whether to use instant unstaking (if available)
}

export interface ValidatorFilters {
  status?: ValidatorStatus;
  minCommission?: number;
  maxCommission?: number;
  minAPR?: number;
  maxAPR?: number;
  minUptime?: number;
  sortBy?: 'commission' | 'apr' | 'totalStaked' | 'performance' | 'uptime';
  sortOrder?: 'asc' | 'desc';
}

export interface StakingFilters {
  minAmount?: number;
  maxAmount?: number;
  hasUnbonding?: boolean;
  sortBy?: 'createdAt' | 'stakedAmount' | 'rewardsEarned' | 'currentValue';
  sortOrder?: 'asc' | 'desc';
}

export interface StakingPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface StakingResponse {
  success: boolean;
  data: {
    positions?: StakingPosition[];
    validators?: ValidatorInfo[];
    metrics?: StakingMetrics;
    rewards?: StakingReward[];
    pagination?: StakingPagination;
  };
  error?: string;
}

export interface RewardClaimRequest {
  positionIds: string[];
  claimAll: boolean;
}

export interface ValidatorDelegationRequest {
  positionId: string;
  validatorAddress: string;
  amount: number;
}

export interface RedelegationRequest {
  positionId: string;
  fromValidator: string;
  toValidator: string;
  amount: number;
}

// External wallet integration types
export interface ExternalWalletTransaction {
  id: string;
  type: 'stake' | 'unstake' | 'delegate' | 'undelegate' | 'claim_rewards' | 'redelegate';
  amount: number;
  from?: string;
  to?: string;
  validatorAddress?: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  blockHash?: string;
  gasUsed?: number;
  fee?: number;
}

export interface WalletSecurity {
  encryptionEnabled: boolean;
  backupStatus: 'none' | 'partial' | 'complete';
  lastSecurityAudit: Date;
  riskLevel: 'low' | 'medium' | 'high';
  securityAlerts: SecurityAlert[];
}

export interface SecurityAlert {
  id: string;
  type: 'unauthorized_access' | 'suspicious_transaction' | 'key_compromise' | 'system_breach';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface StakingConfig {
  minStakeAmount: number;
  unbondingPeriod: number; // in days
  maxValidatorsPerPosition: number;
  instantUnstakeFee: number; // percentage
  protocolFee: number; // percentage
  rewardDistributionFrequency: number; // in hours
}

export interface NetworkInfo {
  currentEpoch: number;
  epochDuration: number; // in seconds
  totalSupply: number;
  totalStaked: number;
  stakingRatio: number; // percentage
  inflationRate: number; // percentage
  averageBlockTime: number; // in seconds
}