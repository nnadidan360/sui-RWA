// ============================================================================
// CREDIT OS CONFIGURATION
// ============================================================================
// Central configuration for Credit OS system including blockchain, database,
// and feature flag settings

export interface CreditOSConfig {
  // Sui Blockchain Configuration
  sui: {
    network: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
    rpcUrl?: string;
    packageId?: string;
    adminPrivateKey?: string;
  };
  
  // MongoDB Configuration
  database: {
    uri: string;
    dbName: string;
    collections: {
      users: string;
      creditProfiles: string;
      assetIntelligence: string;
      fraudSignals: string;
      withdrawalPolicies: string;
      featureFlags: string;
    };
  };
  
  // Authentication Configuration
  auth: {
    sessionDuration: number; // in milliseconds
    maxActiveSessions: number;
    deviceTrustDuration: number; // in milliseconds
    recoveryTokenExpiry: number; // in milliseconds
  };
  
  // Asset Processing Configuration
  assets: {
    uploadFee: number; // $10 in cents
    maxFileSize: number; // in bytes
    allowedMimeTypes: string[];
    confidenceThreshold: number; // minimum score for auto-approval
  };
  
  // Crypto Collateral Configuration
  crypto: {
    maxLtv: number; // 30% = 3000 basis points
    liquidationLtv: number; // 60% = 6000 basis points
    alertThresholds: number[]; // [35%, 45%, 55%] in basis points
    priceUpdateInterval: number; // in milliseconds
  };
  
  // Loan Configuration
  loans: {
    rwaFacilitationFee: number; // 5% = 500 basis points
    maxLoanDuration: number; // in days
    gracePeriod: number; // in days
  };
  
  // Withdrawal Configuration
  withdrawals: {
    newUserCryptoFree: number; // 3 free withdrawals
    newUserCardFreeDuration: number; // 1 month in milliseconds
    dailyLimits: {
      crypto: number;
      card: number;
      usdSui: number;
    };
    velocityLimits: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  };
  
  // Fraud Detection Configuration
  fraud: {
    velocityThresholds: {
      assetUploads: number; // per day
      loanRequests: number; // per day
      amountEscalation: number; // percentage increase threshold
    };
    deviceConsistencyRequired: boolean;
    geoLocationTracking: boolean;
    suspiciousActivityCooldown: number; // in milliseconds
  };
  
  // Feature Flags (Phase Control)
  features: {
    // Phase 1 (Core Platform)
    accountAbstraction: boolean;
    rwaCollateral: boolean;
    cryptoCollateral: boolean;
    internalCreditBureau: boolean;
    fraudDetection: boolean;
    withdrawalIncentives: boolean;
    
    // Phase 2 (Asset Tokenization)
    assetTokenization: boolean;
    fractionalization: boolean;
    secondaryTrading: boolean;
    oracleIntegration: boolean;
    
    // Phase 3 (Yield Products)
    yieldProducts: boolean;
    rentalIncome: boolean;
    invoiceFactoring: boolean;
    royaltySecurities: boolean;
    
    // Phase 4 (Cross-Chain)
    crossChain: boolean;
    ethereum: boolean;
    polygon: boolean;
    arbitrum: boolean;
  };
  
  // External Service Configuration
  external: {
    // KYC/KYB Providers
    kyc: {
      provider: 'jumio' | 'onfido' | 'sumsub';
      apiKey?: string;
      webhookSecret?: string;
    };
    
    // Email Service
    email: {
      provider: 'sendgrid' | 'ses' | 'mailgun';
      apiKey?: string;
      fromAddress: string;
    };
    
    // SMS Service
    sms: {
      provider: 'twilio' | 'messagebird';
      apiKey?: string;
      fromNumber?: string;
    };
    
    // File Storage
    storage: {
      provider: 'mongodb' | 's3' | 'ipfs';
      config?: Record<string, any>;
    };
    
    // Oracle Services (Phase 2)
    oracles?: {
      property: {
        provider: 'zillow' | 'corelogic';
        apiKey?: string;
      };
      commodity: {
        provider: 'chainlink' | 'pyth';
        apiKey?: string;
      };
    };
  };
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const defaultCreditOSConfig: CreditOSConfig = {
  sui: {
    network: 'testnet',
    rpcUrl: process.env.SUI_RPC_URL,
    packageId: process.env.SUI_PACKAGE_ID,
    adminPrivateKey: process.env.SUI_ADMIN_PRIVATE_KEY,
  },
  
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGODB_DB_NAME || 'credit_os',
    collections: {
      users: 'credit_os_users',
      creditProfiles: 'credit_profiles',
      assetIntelligence: 'asset_intelligence',
      fraudSignals: 'fraud_signals',
      withdrawalPolicies: 'withdrawal_policies',
      featureFlags: 'feature_flags',
    },
  },
  
  auth: {
    sessionDuration: 24 * 60 * 60 * 1000, // 24 hours
    maxActiveSessions: 5,
    deviceTrustDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
    recoveryTokenExpiry: 60 * 60 * 1000, // 1 hour
  },
  
  assets: {
    uploadFee: 1000, // $10.00 in cents
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    confidenceThreshold: 75, // 75% confidence for auto-approval
  },
  
  crypto: {
    maxLtv: 3000, // 30%
    liquidationLtv: 6000, // 60%
    alertThresholds: [3500, 4500, 5500], // 35%, 45%, 55%
    priceUpdateInterval: 60 * 1000, // 1 minute
  },
  
  loans: {
    rwaFacilitationFee: 500, // 5%
    maxLoanDuration: 365, // 1 year
    gracePeriod: 7, // 7 days
  },
  
  withdrawals: {
    newUserCryptoFree: 3,
    newUserCardFreeDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
    dailyLimits: {
      crypto: 10000 * 100, // $10,000 in cents
      card: 5000 * 100, // $5,000 in cents
      usdSui: 50000 * 100, // $50,000 in cents (higher for TVL incentive)
    },
    velocityLimits: {
      daily: 10000 * 100, // $10,000 in cents
      weekly: 50000 * 100, // $50,000 in cents
      monthly: 200000 * 100, // $200,000 in cents
    },
  },
  
  fraud: {
    velocityThresholds: {
      assetUploads: 5, // max 5 assets per day
      loanRequests: 3, // max 3 loan requests per day
      amountEscalation: 50, // 50% increase threshold
    },
    deviceConsistencyRequired: true,
    geoLocationTracking: true,
    suspiciousActivityCooldown: 24 * 60 * 60 * 1000, // 24 hours
  },
  
  features: {
    // Phase 1 - Core Platform (MVP)
    accountAbstraction: true,
    rwaCollateral: true,
    cryptoCollateral: true,
    internalCreditBureau: true,
    fraudDetection: true,
    withdrawalIncentives: true,
    
    // Phase 2 - Asset Tokenization (Disabled by default)
    assetTokenization: false,
    fractionalization: false,
    secondaryTrading: false,
    oracleIntegration: false,
    
    // Phase 3 - Yield Products (Disabled by default)
    yieldProducts: false,
    rentalIncome: false,
    invoiceFactoring: false,
    royaltySecurities: false,
    
    // Phase 4 - Cross-Chain (Disabled by default)
    crossChain: false,
    ethereum: false,
    polygon: false,
    arbitrum: false,
  },
  
  external: {
    kyc: {
      provider: 'jumio',
      apiKey: process.env.JUMIO_API_KEY,
      webhookSecret: process.env.JUMIO_WEBHOOK_SECRET,
    },
    
    email: {
      provider: 'sendgrid',
      apiKey: process.env.SENDGRID_API_KEY,
      fromAddress: process.env.FROM_EMAIL || 'noreply@creditos.com',
    },
    
    sms: {
      provider: 'twilio',
      apiKey: process.env.TWILIO_API_KEY,
      fromNumber: process.env.TWILIO_FROM_NUMBER,
    },
    
    storage: {
      provider: 'mongodb',
      config: {
        bucketName: 'credit_os_files',
      },
    },
  },
};

// ============================================================================
// CONFIGURATION LOADER
// ============================================================================

let configInstance: CreditOSConfig | null = null;

export function getCreditOSConfig(): CreditOSConfig {
  if (!configInstance) {
    configInstance = { ...defaultCreditOSConfig };
    
    // Override with environment-specific values
    if (process.env.NODE_ENV === 'production') {
      configInstance.sui.network = 'mainnet';
      configInstance.fraud.deviceConsistencyRequired = true;
      configInstance.fraud.geoLocationTracking = true;
    } else if (process.env.NODE_ENV === 'development') {
      configInstance.sui.network = 'devnet';
      configInstance.fraud.deviceConsistencyRequired = false;
      configInstance.fraud.geoLocationTracking = false;
    }
  }
  
  return configInstance;
}

export function updateCreditOSConfig(updates: Partial<CreditOSConfig>): void {
  if (!configInstance) {
    configInstance = { ...defaultCreditOSConfig };
  }
  
  configInstance = {
    ...configInstance,
    ...updates,
  };
}

// ============================================================================
// FEATURE FLAG HELPERS
// ============================================================================

export function isFeatureEnabled(feature: keyof CreditOSConfig['features']): boolean {
  const config = getCreditOSConfig();
  return config.features[feature];
}

export function getPhaseFeatures(phase: 1 | 2 | 3 | 4): string[] {
  const config = getCreditOSConfig();
  
  switch (phase) {
    case 1:
      return [
        'accountAbstraction',
        'rwaCollateral', 
        'cryptoCollateral',
        'internalCreditBureau',
        'fraudDetection',
        'withdrawalIncentives'
      ];
    case 2:
      return [
        'assetTokenization',
        'fractionalization',
        'secondaryTrading',
        'oracleIntegration'
      ];
    case 3:
      return [
        'yieldProducts',
        'rentalIncome',
        'invoiceFactoring',
        'royaltySecurities'
      ];
    case 4:
      return [
        'crossChain',
        'ethereum',
        'polygon',
        'arbitrum'
      ];
    default:
      return [];
  }
}

export function enablePhase(phase: 1 | 2 | 3 | 4): void {
  const config = getCreditOSConfig();
  const features = getPhaseFeatures(phase);
  
  features.forEach(feature => {
    config.features[feature as keyof CreditOSConfig['features']] = true;
  });
}

export function disablePhase(phase: 1 | 2 | 3 | 4): void {
  const config = getCreditOSConfig();
  const features = getPhaseFeatures(phase);
  
  features.forEach(feature => {
    config.features[feature as keyof CreditOSConfig['features']] = false;
  });
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateConfig(config: CreditOSConfig): string[] {
  const errors: string[] = [];
  
  // Validate required Sui configuration
  if (!config.sui.packageId && config.features.accountAbstraction) {
    errors.push('Sui package ID is required when account abstraction is enabled');
  }
  
  // Validate database configuration
  if (!config.database.uri) {
    errors.push('Database URI is required');
  }
  
  // Validate external service configuration
  if (config.features.fraudDetection && !config.external.kyc.apiKey) {
    errors.push('KYC API key is required when fraud detection is enabled');
  }
  
  // Validate phase dependencies
  if (config.features.assetTokenization && !config.features.rwaCollateral) {
    errors.push('Asset tokenization requires RWA collateral to be enabled');
  }
  
  if (config.features.yieldProducts && !config.features.assetTokenization) {
    errors.push('Yield products require asset tokenization to be enabled');
  }
  
  if (config.features.crossChain && !config.features.yieldProducts) {
    errors.push('Cross-chain features require yield products to be enabled');
  }
  
  return errors;
}