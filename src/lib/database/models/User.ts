import mongoose, { Schema, Document } from 'mongoose';
import * as bcrypt from 'bcryptjs';

export interface IUser extends Document {
  walletAddress: string; // Primary wallet address
  email?: string;
  // Enhanced multi-wallet support
  connectedWallets: Array<{
    address: string;
    walletType: 'casper_wallet' | 'casper_signer' | 'ledger' | 'walletconnect' | 'other';
    connectionDate: Date;
    lastUsed: Date;
    isActive: boolean;
    nickname?: string;
    metadata?: Record<string, any>;
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
  walletAddress: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    lowercase: true 
  },
  email: { 
    type: String, 
    unique: true, 
    sparse: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  // Enhanced multi-wallet support
  connectedWallets: [{
    address: { type: String, required: true, index: true },
    walletType: { 
      type: String, 
      required: true,
      enum: ['casper_wallet', 'casper_signer', 'ledger', 'walletconnect', 'other']
    },
    connectionDate: { type: Date, required: true, default: Date.now },
    lastUsed: { type: Date, required: true, default: Date.now },
    isActive: { type: Boolean, default: true },
    nickname: String,
    metadata: { type: Schema.Types.Mixed }
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

// Enhanced indexes for performance and multi-wallet support
UserSchema.index({ walletAddress: 1, isActive: 1 });
UserSchema.index({ 'connectedWallets.address': 1 });
UserSchema.index({ 'connectedWallets.walletType': 1, 'connectedWallets.isActive': 1 });
UserSchema.index({ 'kyc.status': 1, createdAt: -1 });
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ 'compliance.amlStatus': 1, 'compliance.riskRating': 1 });

// Methods
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.security.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.security.passwordHash);
};

UserSchema.methods.hashPassword = async function(password: string): Promise<void> {
  const salt = await bcrypt.genSalt(12);
  this.security.passwordHash = await bcrypt.hash(password, salt);
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