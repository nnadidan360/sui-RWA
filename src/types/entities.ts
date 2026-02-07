// User Types
export interface User {
  id: string;
  address: string;
  profile: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  VALIDATOR = 'validator'
}

export interface UserProfile {
  displayName?: string;
  email?: string;
  avatar?: string;
  bio?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  language: string;
  theme: 'light' | 'dark';
  notifications: NotificationSettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
}

// Asset Types
export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  value: number;
  owner: string;
  status: AssetStatus;
  metadata: AssetMetadata;
  createdAt: string;
  updatedAt: string;
}

export enum AssetType {
  REAL_ESTATE = 'real_estate',
  COMMODITY = 'commodity',
  ARTWORK = 'artwork',
  VEHICLE = 'vehicle',
  EQUIPMENT = 'equipment',
  OTHER = 'other'
}

export enum AssetStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DISPUTED = 'disputed'
}

export interface AssetMetadata {
  description: string;
  location?: string;
  documents: Document[];
  images: string[];
  verificationData?: VerificationData;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  url: string;
  hash: string;
  uploadedAt: string;
}

export interface VerificationData {
  verifiedBy: string;
  verifiedAt: string;
  verificationScore: number;
  notes?: string;
}

// Loan Types
export interface Loan {
  id: string;
  borrower: string;
  lender?: string;
  assetId: string;
  amount: number;
  interestRate: number;
  duration: number;
  status: LoanStatus;
  terms: LoanTerms;
  createdAt: string;
  updatedAt: string;
}

export enum LoanStatus {
  REQUESTED = 'requested',
  APPROVED = 'approved',
  ACTIVE = 'active',
  REPAID = 'repaid',
  DEFAULTED = 'defaulted',
  LIQUIDATED = 'liquidated'
}

export interface LoanTerms {
  collateralRatio: number;
  liquidationThreshold: number;
  gracePeriod: number;
  penalties: PenaltyStructure;
}

export interface PenaltyStructure {
  lateFeeRate: number;
  defaultPenaltyRate: number;
  liquidationFeeRate: number;
}

// Transaction Types
export interface Transaction {
  id: string;
  type: TransactionType;
  from: string;
  to: string;
  amount: number;
  asset?: string;
  status: TransactionStatus;
  hash?: string;
  blockNumber?: number;
  gasUsed?: number;
  createdAt: string;
  confirmedAt?: string;
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  LOAN_REQUEST = 'loan_request',
  LOAN_APPROVAL = 'loan_approval',
  REPAYMENT = 'repayment',
  LIQUIDATION = 'liquidation',
  ASSET_TOKENIZATION = 'asset_tokenization'
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Price Feed Types
export interface PriceFeed {
  assetId: string;
  price: number;
  currency: string;
  timestamp: string;
  source: string;
  confidence: number;
}

export interface PriceHistory {
  assetId: string;
  prices: PricePoint[];
}

export interface PricePoint {
  price: number;
  timestamp: string;
}

// Staking Types
export interface StakingPosition {
  id: string;
  user: string;
  amount: number;
  asset: string;
  startDate: string;
  endDate?: string;
  rewards: number;
  status: StakingStatus;
}

export enum StakingStatus {
  ACTIVE = 'active',
  UNSTAKING = 'unstaking',
  COMPLETED = 'completed'
}

// Admin Types
export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  roles: AdminRole[];
  permissions: AdminPermission[];
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRole {
  id: string;
  name: string;
  description: string;
  permissions: AdminPermission[];
  createdAt: string;
  updatedAt: string;
}

export enum AdminPermission {
  USER_MANAGEMENT = 'user_management',
  ASSET_MANAGEMENT = 'asset_management',
  LOAN_MANAGEMENT = 'loan_management',
  SYSTEM_SETTINGS = 'system_settings',
  AUDIT_LOGS = 'audit_logs',
  SECURITY_MONITOR = 'security_monitor'
}

export interface AdminSession {
  id: string;
  adminId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  lastAccessedAt: Date;
  ipAddress: string;
  userAgent: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  resource: string;
  success: boolean;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  error?: string;
}

// Verification Types
export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}