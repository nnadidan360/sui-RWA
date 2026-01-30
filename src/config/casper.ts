/**
 * Casper Network Configuration
 * Handles testnet RPC endpoints, contract addresses, and network settings
 */

export interface CasperConfig {
  networkName: string;
  rpcEndpoints: string[];
  chainName: string;
  deployTtl: number;
  gasPrice: number;
  maxGasLimit: string;
  contractAddresses: {
    accessControl?: string;
    assetTokenFactory?: string;
    lendingPool?: string;
    stakingContract?: string;
    unifiedRwa?: string;
  };
}

// Casper Testnet Configuration
export const CASPER_TESTNET_CONFIG: CasperConfig = {
  networkName: 'casper-test',
  rpcEndpoints: [
    'https://rpc.testnet.casperlabs.io/rpc',
    'https://testnet.cspr.live/rpc',
    'https://casper-node.tor.us/rpc',
  ],
  chainName: 'casper-test',
  deployTtl: 1800000, // 30 minutes in milliseconds
  gasPrice: 1, // 1 mote per gas unit
  maxGasLimit: '5000000000', // 5 billion motes max
  contractAddresses: {
    // These will be populated after contract deployment
    accessControl: process.env.NEXT_PUBLIC_ACCESS_CONTROL_CONTRACT,
    assetTokenFactory: process.env.NEXT_PUBLIC_ASSET_TOKEN_FACTORY_CONTRACT,
    lendingPool: process.env.NEXT_PUBLIC_LENDING_POOL_CONTRACT,
    stakingContract: process.env.NEXT_PUBLIC_STAKING_CONTRACT,
    // Your deployed unified RWA contract
    unifiedRwa: process.env.NEXT_PUBLIC_UNIFIED_RWA_CONTRACT,
  },
};

// Environment-specific configuration
export const getCasperConfig = (): CasperConfig => {
  const env = process.env.NODE_ENV;
  
  if (env === 'production') {
    // In production, we might use mainnet or a different testnet
    return CASPER_TESTNET_CONFIG;
  }
  
  return CASPER_TESTNET_CONFIG;
};

// Network connection settings
export const CONNECTION_CONFIG = {
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 2000, // 2 seconds
  healthCheckInterval: 60000, // 1 minute
};

// Gas estimation constants
export const GAS_ESTIMATES = {
  // Standard operations
  transfer: '100000000', // 100M motes
  contractCall: '2000000000', // 2B motes
  contractDeploy: '5000000000', // 5B motes
  
  // Asset tokenization operations
  createAsset: '1500000000', // 1.5B motes
  transferAsset: '500000000', // 500M motes
  verifyAsset: '800000000', // 800M motes
  
  // Lending operations
  deposit: '1000000000', // 1B motes
  withdraw: '1200000000', // 1.2B motes
  borrow: '1800000000', // 1.8B motes
  repay: '1000000000', // 1B motes
  liquidate: '2500000000', // 2.5B motes
  
  // Staking operations
  stake: '1200000000', // 1.2B motes
  unstake: '1500000000', // 1.5B motes
  claimRewards: '800000000', // 800M motes
  
  // Admin operations
  grantRole: '300000000', // 300M motes
  revokeRole: '300000000', // 300M motes
  emergencyPause: '500000000', // 500M motes
};

// Contract entry point names - Updated for your unified RWA contract
export const CONTRACT_ENTRY_POINTS = {
  // Unified RWA Contract
  UNIFIED_RWA: {
    CREATE_ASSET: 'create_asset',
    CREATE_LOAN: 'create_loan', 
    REPAY_LOAN: 'repay_loan',
  },
  
  // Legacy entry points (kept for compatibility)
  ACCESS_CONTROL: {
    GRANT_ROLE: 'grant_role',
    REVOKE_ROLE: 'revoke_role',
    HAS_ROLE: 'has_role',
    EMERGENCY_PAUSE: 'emergency_pause',
    UNPAUSE: 'unpause',
    IS_PAUSED: 'is_paused',
  },
  
  // Asset Token Factory
  ASSET_TOKEN_FACTORY: {
    CREATE_ASSET_TOKEN: 'create_asset',
    VERIFY_ASSET: 'verify_asset',
    UPDATE_ASSET_VALUE: 'update_asset_value',
    TRANSFER_OWNERSHIP: 'transfer_ownership',
  },
  
  // Lending Pool
  LENDING_POOL: {
    DEPOSIT: 'deposit',
    WITHDRAW: 'withdraw',
    BORROW: 'create_loan',
    REPAY: 'repay_loan',
    LIQUIDATE: 'liquidate',
    GET_POOL_INFO: 'get_pool_info',
    GET_USER_POSITION: 'get_user_position',
  },
  
  // Staking Contract (not implemented in your contract yet)
  STAKING: {
    STAKE: 'stake',
    UNSTAKE: 'unstake',
    CLAIM_REWARDS: 'claim_rewards',
    GET_STAKING_INFO: 'get_staking_info',
    GET_USER_STAKES: 'get_user_stakes',
  },
};

// Error codes and messages
export const CASPER_ERRORS = {
  NETWORK_ERROR: 'Network connection failed',
  INSUFFICIENT_BALANCE: 'Insufficient account balance',
  CONTRACT_NOT_FOUND: 'Contract not found on network',
  INVALID_DEPLOY: 'Invalid deploy format',
  DEPLOY_FAILED: 'Deploy execution failed',
  TIMEOUT: 'Operation timed out',
  UNAUTHORIZED: 'Unauthorized access',
  PAUSED: 'System is currently paused',
} as const;

export type CasperError = keyof typeof CASPER_ERRORS;