import mongoose, { Schema, Document } from 'mongoose';
import * as bcrypt from 'bcryptjs';

export interface IUser extends Document {
  // NEW: Account abstraction fields (replaces walletAddress)
  internalUserId: string; // Primary identifier for Credit OS
  userAccountObjectId?: string; // Sui on-chain UserAccountObject ID
  
  // NEW: Authentication methods (replaces wallet-based auth)
  authMethods: Array<{
    type: 'email' | 'phone' | 'passkey';
    identifier: string; // email address, phone number, or passkey ID
    verified: boolean;
    verificationDate?: Date;
    lastUsed?: Date;
    isActive: boolean;
  }>;
  
  // NEW: Device fingerprinting for fraud prevention
  deviceFingerprints: Array<{
    deviceId: string;
    browserFingerprint: string;
    ipAddress: string;
    geolocation?: {
      country?: string;
      region?: string;
      city?: string;
    };
    screenResolution?: string;
    timezone?: string;
    userAgent: string;
    lastUsed: Date;
    isActive: boolean;
  }>;
  
  // NEW: Session management
  activeSessions: Array<{
    sessionId: string;
    deviceId: string;
    createdAt: Date;
    expiresAt: Date;
    lastActivity: Date;
    isActive: boolean;
  }>;
  
  email?: string;
  
  // NEW: Credit OS specific fields
  creditProfile?: {
    internalScore: number; // 0-1000 internal scoring
    maxLoanAmount: number;
    riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
    lastUpdated: Date;
  };
  
  // NEW: Fraud detection signals
  fraudSignals: Array<{
    signalId: string;
    signalType: 'identity' | 'asset' | 'behavioral' | 'collusion';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    timestamp: Date;
    resolved: boolean;
    actionTaken?: string;
  }>;
  
  // NEW: Asset intelligence tracking
  assetIntelligence: Array<{
    assetId: string;
    assetType: string;
    confidenceScore: number;
    verificationStatus: 'pending' | 'approved' | 'rejected';
    uploadDate: Date;
  }>;
  
  profile: {
    firstName?: string;
    lastName?: string;
    country?: string;
    phoneNumber?: string;
    dateOfBirth?: Date;
    occupation?: string;
  };
  kyc: {
    status: 'not_started' | 'pending' | 'approved' | 'rejected' | 'expired';
    level: 'basic' | 'intermediate' | 'advanced';
    documents: Array<{
      type: 'passport' | 'drivers_license' | 'national_id' | 'utility_bill' | 'bank_statement';
      ipfsHash: string;
      uploadDate: Date;
      verificationStatus: 'pending' | 'approved' | 'rejected';
      expiryDate?: Date;
    }>;
    verifiedBy?: string;
    verificationDate?: Date;
    rejectionReason?: string;
  };
  security: {
    passwordHash?: string;
    twoFactorEnabled: boolean;
    twoFactorSecret?: string;
    loginAttempts: number;
    lockoutUntil?: Date;
    lastLoginAt?: Date;
    lastLoginIP?: string;
  };
  preferences: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    currency: string;
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
      transactionAlerts: boolean;
      marketingEmails: boolean;
    };
    privacy: {
      profileVisibility: 'public' | 'private';
      activityVisibility: 'public' | 'private';
    };
  };
  financialProfile: {
    riskTolerance: 'low' | 'medium' | 'high';
    investmentExperience: 'beginner' | 'intermediate' | 'advanced';
    annualIncome?: number;
    netWorth?: number;
    creditScore?: number;
  };
  activityLog: Array<{
    action: string;
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
    details: Record<string, any>;
  }>;
  compliance: {
    amlStatus: 'clear' | 'flagged' | 'under_review';
    sanctionsCheck: {
      status: 'clear' | 'flagged';
      lastChecked: Date;
    };
    pepStatus: boolean; // Politically Exposed Person
    riskRating: 'low' | 'medium' | 'high';
    complianceNotes?: string;
  };
  role: 'user' | 'admin' | 'super_admin';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  // NEW: Account abstraction fields (replaces walletAddress)
  internalUserId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  userAccountObjectId: { 
    type: String, 
    sparse: true,
    index: true 
  },
  
  // NEW: Authentication methods (replaces connectedWallets)
  authMethods: [{
    type: { 
      type: String, 
      required: true,
      enum: ['email', 'phone', 'passkey']
    },
    identifier: { type: String, required: true },
    verified: { type: Boolean, default: false },
    verificationDate: Date,
    lastUsed: Date,
    isActive: { type: Boolean, default: true }
  }],
  
  // NEW: Device fingerprinting for fraud prevention
  deviceFingerprints: [{
    deviceId: { type: String, required: true },
    browserFingerprint: { type: String, required: true },
    ipAddress: { type: String, required: true },
    geolocation: {
      country: String,
      region: String,
      city: String
    },
    screenResolution: String,
    timezone: String,
    userAgent: { type: String, required: true },
    lastUsed: { type: Date, required: true, default: Date.now },
    isActive: { type: Boolean, default: true }
  }],
  
  // NEW: Session management
  activeSessions: [{
    sessionId: { type: String, required: true },
    deviceId: { type: String, required: true },
    createdAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
    lastActivity: { type: Date, required: true, default: Date.now },
    isActive: { type: Boolean, default: true }
  }],
  
  email: { 
    type: String, 
    unique: true, 
    sparse: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  
  // NEW: Credit OS specific fields
  creditProfile: {
    internalScore: { type: Number, min: 0, max: 1000 },
    maxLoanAmount: { type: Number, min: 0 },
    riskBand: { 
      type: String, 
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'MEDIUM'
    },
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // NEW: Fraud detection signals
  fraudSignals: [{
    signalId: { type: String, required: true },
    signalType: { 
      type: String, 
      required: true,
      enum: ['identity', 'asset', 'behavioral', 'collusion']
    },
    severity: { 
      type: String, 
      required: true,
      enum: ['low', 'medium', 'high', 'critical']
    },
    description: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    resolved: { type: Boolean, default: false },
    actionTaken: String
  }],
  
  // NEW: Asset intelligence tracking
  assetIntelligence: [{
    assetId: { type: String, required: true },
    assetType: { type: String, required: true },
    confidenceScore: { type: Number, min: 0, max: 1 },
    verificationStatus: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    uploadDate: { type: Date, required: true, default: Date.now }
  }],
  
  profile: {
    firstName: String,
    lastName: String,
    country: String,
    phoneNumber: String,
    dateOfBirth: Date,
    occupation: String
  },
  kyc: {
    status: { 
      type: String, 
      enum: ['not_started', 'pending', 'approved', 'rejected', 'expired'],
      default: 'not_started',
      index: true
    },
    level: { 
      type: String, 
      enum: ['basic', 'intermediate', 'advanced'],
      default: 'basic'
    },
    documents: [{
      type: { 
        type: String, 
        required: true,
        enum: ['passport', 'drivers_license', 'national_id', 'utility_bill', 'bank_statement']
      },
      ipfsHash: { type: String, required: true },
      uploadDate: { type: Date, required: true, default: Date.now },
      verificationStatus: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      expiryDate: Date
    }],
    verifiedBy: String,
    verificationDate: Date,
    rejectionReason: String
  },
  security: {
    passwordHash: String,
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: String,
    loginAttempts: { type: Number, default: 0 },
    lockoutUntil: Date,
    lastLoginAt: Date,
    lastLoginIP: String
  },
  preferences: {
    theme: { 
      type: String, 
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    language: { type: String, default: 'en' },
    currency: { type: String, default: 'USD' },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      transactionAlerts: { type: Boolean, default: true },
      marketingEmails: { type: Boolean, default: false }
    },
    privacy: {
      profileVisibility: { 
        type: String, 
        enum: ['public', 'private'],
        default: 'private'
      },
      activityVisibility: { 
        type: String, 
        enum: ['public', 'private'],
        default: 'private'
      }
    }
  },
  financialProfile: {
    riskTolerance: { 
      type: String, 
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    investmentExperience: { 
      type: String, 
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner'
    },
    annualIncome: Number,
    netWorth: Number,
    creditScore: Number
  },
  activityLog: [{
    action: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    ipAddress: String,
    userAgent: String,
    details: { type: Schema.Types.Mixed }
  }],
  compliance: {
    amlStatus: { 
      type: String, 
      enum: ['clear', 'flagged', 'under_review'],
      default: 'clear',
      index: true
    },
    sanctionsCheck: {
      status: { 
        type: String, 
        enum: ['clear', 'flagged'],
        default: 'clear'
      },
      lastChecked: { type: Date, default: Date.now }
    },
    pepStatus: { type: Boolean, default: false },
    riskRating: { 
      type: String, 
      enum: ['low', 'medium', 'high'],
      default: 'low',
      index: true
    },
    complianceNotes: String
  },
  role: { 
    type: String, 
    enum: ['user', 'admin', 'super_admin'],
    default: 'user',
    index: true
  },
  isActive: { type: Boolean, default: true, index: true }
}, {
  timestamps: true,
  collection: 'users'
});

// Enhanced indexes for account abstraction and Credit OS
UserSchema.index({ internalUserId: 1, isActive: 1 });
UserSchema.index({ userAccountObjectId: 1 });
UserSchema.index({ 'authMethods.type': 1, 'authMethods.identifier': 1 });
UserSchema.index({ 'authMethods.verified': 1, 'authMethods.isActive': 1 });
UserSchema.index({ 'deviceFingerprints.deviceId': 1 });
UserSchema.index({ 'activeSessions.sessionId': 1 });
UserSchema.index({ 'activeSessions.expiresAt': 1 });
UserSchema.index({ 'kyc.status': 1, createdAt: -1 });
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ 'compliance.amlStatus': 1, 'compliance.riskRating': 1 });
UserSchema.index({ 'creditProfile.riskBand': 1 });
UserSchema.index({ 'fraudSignals.severity': 1, 'fraudSignals.resolved': 1 });

// Methods
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.security.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.security.passwordHash);
};

UserSchema.methods.hashPassword = async function(password: string): Promise<void> {
  const salt = await bcrypt.genSalt(12);
  this.security.passwordHash = await bcrypt.hash(password, salt);
};

// NEW: Account abstraction methods
UserSchema.methods.addAuthMethod = function(type: 'email' | 'phone' | 'passkey', identifier: string) {
  this.authMethods.push({
    type,
    identifier,
    verified: false,
    lastUsed: new Date(),
    isActive: true
  });
};

UserSchema.methods.verifyAuthMethod = function(identifier: string) {
  const authMethod = this.authMethods.find((am: any) => am.identifier === identifier);
  if (authMethod) {
    authMethod.verified = true;
    authMethod.verificationDate = new Date();
  }
};

UserSchema.methods.addDeviceFingerprint = function(fingerprint: any) {
  this.deviceFingerprints.push({
    deviceId: fingerprint.deviceId,
    browserFingerprint: fingerprint.browserFingerprint,
    ipAddress: fingerprint.ipAddress,
    geolocation: fingerprint.geolocation,
    screenResolution: fingerprint.screenResolution,
    timezone: fingerprint.timezone,
    userAgent: fingerprint.userAgent,
    lastUsed: new Date(),
    isActive: true
  });
};

UserSchema.methods.createSession = function(deviceId: string, expirationHours: number = 24) {
  const sessionId = require('crypto').randomUUID();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expirationHours);
  
  this.activeSessions.push({
    sessionId,
    deviceId,
    createdAt: new Date(),
    expiresAt,
    lastActivity: new Date(),
    isActive: true
  });
  
  return sessionId;
};

UserSchema.methods.validateSession = function(sessionId: string): boolean {
  const session = this.activeSessions.find((s: any) => s.sessionId === sessionId && s.isActive);
  if (!session) return false;
  
  if (session.expiresAt < new Date()) {
    session.isActive = false;
    return false;
  }
  
  session.lastActivity = new Date();
  return true;
};

UserSchema.methods.revokeSession = function(sessionId: string) {
  const session = this.activeSessions.find((s: any) => s.sessionId === sessionId);
  if (session) {
    session.isActive = false;
  }
};

UserSchema.methods.addFraudSignal = function(signalType: string, severity: string, description: string) {
  this.fraudSignals.push({
    signalId: require('crypto').randomUUID(),
    signalType,
    severity,
    description,
    timestamp: new Date(),
    resolved: false
  });
};

UserSchema.methods.logActivity = function(action: string, details: Record<string, any> = {}, ipAddress?: string, userAgent?: string) {
  this.activityLog.push({
    action,
    timestamp: new Date(),
    ipAddress,
    userAgent,
    details
  });
  
  // Keep only last 1000 activity logs
  if (this.activityLog.length > 1000) {
    this.activityLog = this.activityLog.slice(-1000);
  }
};

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);