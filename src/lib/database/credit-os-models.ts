import { ObjectId } from 'mongodb';

// ============================================================================
// CREDIT OS DATABASE MODELS
// ============================================================================
// These models extend the existing system for Credit OS functionality
// Following the requirements for account abstraction, credit bureau, 
// asset intelligence, fraud detection, and withdrawal policies

// ============================================================================
// EXTENDED USER MODEL FOR CREDIT OS
// ============================================================================

export interface CreditOSUser extends Omit<import('./models').User, 'walletAddress'> {
  // Account Abstraction fields (Requirements 1.1, 1.2)
  internalUserId: string; // Internal unique identifier
  authMethods: AuthMethod[];
  deviceFingerprints: DeviceFingerprint[];
  
  // Session and Recovery (Requirements 1.3, 1.4)
  activeSessions: SessionInfo[];
  recoveryPolicy: RecoveryPolicy;
  
  // Sui Account Object reference (Requirements 1.2, 12.1)
  suiAccountObjectId?: string;
  
  // Privacy and Consent (Requirements 9.1, 7.4)
  consentScope: ConsentScope;
  jurisdictionCode: string;
  
  // Fraud Prevention (Requirements 6.1, 6.5)
  fraudStatus: 'clean' | 'flagged' | 'frozen';
  lastFraudCheck: Date;
}

export interface AuthMethod {
  type: 'email' | 'phone' | 'passkey';
  identifier: string; // email address, phone number, or passkey ID
  verified: boolean;
  verifiedAt?: Date;
  createdAt: Date;
}

export interface DeviceFingerprint {
  deviceId: string;
  fingerprint: string; // Hashed device characteristics
  userAgent: string;
  ipAddress: string; // Hashed for privacy
  location?: {
    country: string;
    region?: string;
  };
  firstSeen: Date;
  lastSeen: Date;
  trusted: boolean;
}

export interface SessionInfo {
  sessionId: string;
  deviceId: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  ipAddress: string; // Hashed
  active: boolean;
}

export interface RecoveryPolicy {
  emailRecovery: boolean;
  deviceRecovery: boolean;
  guardianRecovery: boolean;
  guardianEmails?: string[];
  recoveryAttempts: RecoveryAttempt[];
}

export interface RecoveryAttempt {
  attemptId: string;
  method: 'email' | 'device' | 'guardian';
  initiatedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  ipAddress: string; // Hashed
}

export interface ConsentScope {
  dataProcessing: boolean;
  creditReporting: boolean;
  externalReporting: boolean;
  marketingCommunications: boolean;
  grantedAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CREDIT PROFILE MODEL (Requirements 7.1, 7.2, 7.3)
// ============================================================================

export interface CreditProfile {
  _id?: ObjectId;
  userId: string; // References CreditOSUser.internalUserId
  
  // Internal Credit Scoring (Requirements 7.1, 7.2)
  internalScore: number; // 0-1000 scale
  maxLoanAmount: number;
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNRATED';
  
  // Credit History (Requirements 7.1, 4.5)
  assetHistory: AssetSubmission[];
  loanHistory: LoanRecord[];
  repaymentHistory: RepaymentRecord[];
  
  // Eligibility and Capabilities (Requirements 7.3, 4.3)
  eligibilityProfile: EligibilityProfile;
  activeCapabilities: string[]; // Sui object IDs
  
  // Privacy Controls (Requirements 7.4, 7.5)
  externalReportingEnabled: boolean;
  lastExternalReport?: Date;
  
  // Fraud Integration (Requirements 6.5, 7.1)
  fraudSignals: FraudSignal[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetSubmission {
  assetId: string;
  assetType: 'property' | 'vehicle' | 'equipment' | 'invoice' | 'commodity';
  submittedAt: Date;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  confidenceScore?: number;
  uploadFee: number; // $10 base fee
}

export interface LoanRecord {
  loanId: string;
  collateralType: 'rwa' | 'crypto';
  principal: number;
  interestRate: number;
  facilitationFee: number; // 5% for RWA
  status: 'active' | 'repaid' | 'liquidated' | 'defaulted';
  originatedAt: Date;
  completedAt?: Date;
}

export interface RepaymentRecord {
  loanId: string;
  amount: number;
  type: 'interest' | 'principal' | 'full';
  paidAt: Date;
  onTime: boolean;
  transactionHash?: string; // Sui transaction hash
}

export interface EligibilityProfile {
  maxBorrowAmount: number;
  approvedAssetTypes: string[];
  riskFactors: string[];
  lastAssessment: Date;
  validUntil: Date;
}

// ============================================================================
// ASSET INTELLIGENCE MODEL (Requirements 2.1, 2.2, 2.5)
// ============================================================================

export interface AssetIntelligence {
  _id?: ObjectId;
  assetId: string; // Internal asset identifier
  userId: string; // References CreditOSUser.internalUserId
  
  // Document Processing (Requirements 2.1, 2.2)
  documentHashes: DocumentHash[];
  metadata: AssetMetadata;
  encryptedStoragePath: string; // MongoDB GridFS path
  
  // Verification and Scoring (Requirements 2.5, 2.3)
  confidenceScore: number; // 0-100 probabilistic score
  verificationStatus: 'pending' | 'processing' | 'verified' | 'rejected';
  verificationResults: VerificationResult[];
  
  // Duplicate Detection (Requirements 2.4)
  duplicateFlags: DuplicateFlag[];
  crossPlatformChecks: CrossPlatformCheck[];
  
  // Sui Integration (Requirements 2.3, 12.2)
  suiAttestationObjectId?: string; // RWAAttestationObject ID
  jurisdictionCode: string;
  
  // Recovery Path (Requirements 6.1)
  recoveryPath: RecoveryPath;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentHash {
  algorithm: 'SHA-256';
  hash: string;
  documentType: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

export interface AssetMetadata {
  assetType: 'property' | 'vehicle' | 'equipment' | 'invoice' | 'commodity';
  estimatedValue?: number;
  currency: string;
  location?: string;
  description?: string;
  extractedFields: Record<string, any>; // Metadata extracted from documents
}

export interface VerificationResult {
  checkType: 'registry' | 'manual' | 'automated' | 'third_party';
  result: 'pass' | 'fail' | 'inconclusive';
  score: number; // Contribution to confidence score
  details?: string;
  verifiedAt: Date;
  verifiedBy?: string; // System or user ID
}

export interface DuplicateFlag {
  flagType: 'exact_hash' | 'similar_metadata' | 'cross_platform';
  matchedAssetId?: string;
  similarity: number; // 0-100%
  flaggedAt: Date;
  resolved: boolean;
  resolution?: string;
}

export interface CrossPlatformCheck {
  platform: string;
  checkType: 'hash' | 'metadata' | 'image_similarity';
  result: 'no_match' | 'potential_match' | 'confirmed_match';
  checkedAt: Date;
}

export interface RecoveryPath {
  type: 'manual' | 'legal' | 'automated';
  complexity: 'low' | 'medium' | 'high';
  estimatedTimeframe: string;
  requiredDocuments: string[];
  jurisdictionSpecific: boolean;
}

// ============================================================================
// FRAUD SIGNAL MODEL (Requirements 6.1, 6.2, 6.3, 6.4)
// ============================================================================

export interface FraudSignal {
  _id?: ObjectId;
  userId: string; // References CreditOSUser.internalUserId
  
  // Signal Classification (Requirements 6.1, 6.2, 6.3)
  signalType: 'identity' | 'asset' | 'behavioral' | 'collusion' | 'velocity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-100% confidence in fraud signal
  
  // Signal Details
  description: string;
  detectionMethod: 'automated' | 'manual' | 'external';
  relatedAssetId?: string;
  relatedTransactionId?: string;
  
  // Context Information
  deviceFingerprint?: string;
  ipAddress?: string; // Hashed
  userAgent?: string;
  geolocation?: {
    country: string;
    region?: string;
  };
  
  // Behavioral Patterns (Requirements 6.3)
  behavioralMetrics?: {
    assetUploadVelocity?: number; // Assets per time period
    loanRequestFrequency?: number;
    amountEscalation?: number; // Rate of increasing loan amounts
    timePatterns?: string[]; // Unusual timing patterns
  };
  
  // Response and Resolution (Requirements 6.4)
  status: 'active' | 'investigating' | 'resolved' | 'false_positive';
  responseActions: ResponseAction[];
  
  // Audit Trail
  detectedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  notes?: string;
}

export interface ResponseAction {
  action: 'freeze_account' | 'revoke_capabilities' | 'flag_manual_review' | 'increase_monitoring' | 'block_transaction';
  executedAt: Date;
  executedBy: 'system' | 'admin';
  reversible: boolean;
  reversedAt?: Date;
}

// ============================================================================
// WITHDRAWAL POLICY MODEL (Requirements 5.1, 5.3, 5.4)
// ============================================================================

export interface WithdrawalPolicy {
  _id?: ObjectId;
  userId: string; // References CreditOSUser.internalUserId
  
  // Sui Integration (Requirements 5.4, 12.5)
  suiPolicyObjectId?: string; // WithdrawalPolicyObject ID
  
  // Crypto Withdrawal Incentives (Requirements 5.1)
  cryptoWithdrawals: {
    totalUsed: number;
    freeRemaining: number; // Starts at 3 for new users
    lastUsed?: Date;
    transactions: CryptoWithdrawalRecord[];
  };
  
  // Card Withdrawal Incentives (Requirements 5.3)
  cardWithdrawals: {
    freeMaintenanceUntil?: Date; // 1 month from first use
    monthlyFee: number;
    lastCharged?: Date;
    transactions: CardWithdrawalRecord[];
  };
  
  // USDSui Incentives (Requirements 5.2)
  usdSuiIncentives: {
    totalGasSponsored: number;
    totalFeesWaived: number;
    transactions: USDSuiWithdrawalRecord[];
  };
  
  // Fraud Prevention (Requirements 5.5)
  velocityLimits: {
    dailyLimit: number;
    weeklyLimit: number;
    monthlyLimit: number;
    currentDailyUsage: number;
    currentWeeklyUsage: number;
    currentMonthlyUsage: number;
    lastReset: Date;
  };
  
  deviceConsistency: {
    approvedDevices: string[]; // Device fingerprint hashes
    suspiciousDevices: string[];
    lastDeviceCheck: Date;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

export interface CryptoWithdrawalRecord {
  transactionId: string;
  amount: number;
  currency: string;
  gasSponsored: boolean;
  feeWaived: boolean;
  deviceId: string;
  withdrawnAt: Date;
  suiTransactionHash?: string;
}

export interface CardWithdrawalRecord {
  transactionId: string;
  amount: number;
  currency: string;
  feeCharged: number;
  deviceId: string;
  withdrawnAt: Date;
  cardProvider?: string;
}

export interface USDSuiWithdrawalRecord {
  transactionId: string;
  amount: number;
  gasSponsored: number; // Amount of gas sponsored
  feeWaived: number; // Amount of fees waived
  deviceId: string;
  withdrawnAt: Date;
  suiTransactionHash: string;
}

// ============================================================================
// FEATURE FLAGS FOR PHASED ROLLOUT
// ============================================================================

export interface FeatureFlags {
  _id?: ObjectId;
  
  // Phase 2: Asset Tokenization (Requirements 13-16)
  ENABLE_ASSET_TOKENIZATION: boolean;
  ENABLE_FRACTIONALIZATION: boolean;
  ENABLE_SECONDARY_TRADING: boolean;
  ENABLE_ORACLE_INTEGRATION: boolean;
  
  // Phase 3: Yield Products (Requirements 17-20)
  ENABLE_YIELD_PRODUCTS: boolean;
  ENABLE_RENTAL_INCOME: boolean;
  ENABLE_INVOICE_FACTORING: boolean;
  ENABLE_ROYALTY_SECURITIES: boolean;
  
  // Phase 4: Cross-Chain (Requirements 21-24)
  ENABLE_CROSS_CHAIN: boolean;
  ENABLE_ETHEREUM: boolean;
  ENABLE_POLYGON: boolean;
  ENABLE_ARBITRUM: boolean;
  
  // System flags
  MAINTENANCE_MODE: boolean;
  NEW_USER_REGISTRATION: boolean;
  
  updatedAt: Date;
  updatedBy: string;
}

// ============================================================================
// STUB MODELS FOR SERVICES (MongoDB Integration)
// ============================================================================

export const CreditOSUserModel = {
  find: (filter?: any) => Promise.resolve([] as CreditOSUser[]),
  findOne: (filter?: any) => Promise.resolve(null as CreditOSUser | null),
  findByIdAndUpdate: (id: any, update: any) => Promise.resolve(null as CreditOSUser | null),
  updateOne: (filter: any, update: any) => Promise.resolve({ acknowledged: true }),
  countDocuments: (filter?: any) => Promise.resolve(0),
  aggregate: (pipeline?: any[]) => Promise.resolve([]),
  insertOne: (doc: CreditOSUser) => Promise.resolve({ insertedId: new ObjectId() }),
};

export const CreditProfileModel = {
  find: (filter?: any) => Promise.resolve([] as CreditProfile[]),
  findOne: (filter?: any) => Promise.resolve(null as CreditProfile | null),
  updateOne: (filter: any, update: any) => Promise.resolve({ acknowledged: true }),
  insertOne: (doc: CreditProfile) => Promise.resolve({ insertedId: new ObjectId() }),
  aggregate: (pipeline?: any[]) => Promise.resolve([]),
};

export const AssetIntelligenceModel = {
  find: (filter?: any) => Promise.resolve([] as AssetIntelligence[]),
  findOne: (filter?: any) => Promise.resolve(null as AssetIntelligence | null),
  updateOne: (filter: any, update: any) => Promise.resolve({ acknowledged: true }),
  insertOne: (doc: AssetIntelligence) => Promise.resolve({ insertedId: new ObjectId() }),
  aggregate: (pipeline?: any[]) => Promise.resolve([]),
};

export const FraudSignalModel = {
  find: (filter?: any) => Promise.resolve([] as FraudSignal[]),
  findOne: (filter?: any) => Promise.resolve(null as FraudSignal | null),
  updateOne: (filter: any, update: any) => Promise.resolve({ acknowledged: true }),
  insertOne: (doc: FraudSignal) => Promise.resolve({ insertedId: new ObjectId() }),
  aggregate: (pipeline?: any[]) => Promise.resolve([]),
};

export const WithdrawalPolicyModel = {
  find: (filter?: any) => Promise.resolve([] as WithdrawalPolicy[]),
  findOne: (filter?: any) => Promise.resolve(null as WithdrawalPolicy | null),
  updateOne: (filter: any, update: any) => Promise.resolve({ acknowledged: true }),
  insertOne: (doc: WithdrawalPolicy) => Promise.resolve({ insertedId: new ObjectId() }),
};

export const FeatureFlagsModel = {
  findOne: () => Promise.resolve(null as FeatureFlags | null),
  updateOne: (filter: any, update: any) => Promise.resolve({ acknowledged: true }),
  insertOne: (doc: FeatureFlags) => Promise.resolve({ insertedId: new ObjectId() }),
};