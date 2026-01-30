import mongoose, { Schema, Document } from 'mongoose';

export interface IAsset extends Document {
  tokenId: string;
  assetType: 'real_estate' | 'commodity' | 'invoice' | 'equipment' | 'other';
  owner: string; // wallet address
  metadata: {
    title: string;
    description: string;
    location?: {
      address: string;
      coordinates: {
        lat: number;
        lng: number;
      };
    };
    valuation: {
      amount: number;
      currency: string;
      date: Date;
      appraiser?: string;
    };
    documents: Array<{
      type: 'deed' | 'appraisal' | 'insurance' | 'permit' | 'other';
      ipfsHash: string;
      fileName: string;
      uploadDate: Date;
      verifiedBy?: string;
      verificationDate?: Date;
      // Enhanced IPFS backup and redundancy
      backupHashes?: string[]; // Additional IPFS nodes for redundancy
      pinningStatus: 'pinned' | 'unpinned' | 'failed' | 'pending';
      lastPinCheck?: Date;
      fileSize?: number;
      mimeType?: string;
    }>;
    specifications?: Record<string, any>;
    // Enhanced search indexing
    searchKeywords: string[]; // Extracted keywords for search
    fullTextContent?: string; // OCR/extracted text from documents
    tags: string[]; // User-defined tags
  };
  verification: {
    status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'requires_update';
    verifiedBy?: string;
    verificationDate?: Date;
    notes?: string;
    rejectionReason?: string;
    complianceChecks: {
      kycCompleted: boolean;
      documentationComplete: boolean;
      valuationVerified: boolean;
      legalClearance: boolean;
    };
  };
  onChainData: {
    contractAddress?: string;
    blockNumber?: number;
    transactionHash?: string;
    mintedAt?: Date;
  };
  financialData: {
    currentValue: number;
    valueHistory: Array<{
      value: number;
      date: Date;
      source: string;
    }>;
    utilizationInLoans: Array<{
      loanId: string;
      amount: number;
      startDate: Date;
      endDate?: Date;
    }>;
  };
  auditTrail: Array<{
    action: string;
    performedBy: string;
    timestamp: Date;
    details: Record<string, any>;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
const AssetSchema = new Schema<IAsset>({
  tokenId: { type: String, required: true, unique: true, index: true },
  assetType: { 
    type: String, 
    required: true, 
    enum: ['real_estate', 'commodity', 'invoice', 'equipment', 'other'],
    index: true 
  },
  owner: { type: String, required: true, index: true },
  metadata: {
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: {
      address: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    valuation: {
      amount: { type: Number, required: true },
      currency: { type: String, required: true, default: 'USD' },
      date: { type: Date, required: true },
      appraiser: String
    },
    documents: [{
      type: { 
        type: String, 
        required: true, 
        enum: ['deed', 'appraisal', 'insurance', 'permit', 'other'] 
      },
      ipfsHash: { type: String, required: true },
      fileName: { type: String, required: true },
      uploadDate: { type: Date, required: true, default: Date.now },
      verifiedBy: String,
      verificationDate: Date,
      // Enhanced IPFS backup and redundancy
      backupHashes: [String],
      pinningStatus: { 
        type: String, 
        enum: ['pinned', 'unpinned', 'failed', 'pending'],
        default: 'pending'
      },
      lastPinCheck: Date,
      fileSize: Number,
      mimeType: String
    }],
    specifications: { type: Schema.Types.Mixed },
    // Enhanced search indexing
    searchKeywords: { type: [String], default: [], index: true },
    fullTextContent: { type: String, index: 'text' },
    tags: { type: [String], default: [], index: true }
  },
  verification: {
    status: { 
      type: String, 
      required: true, 
      enum: ['pending', 'under_review', 'approved', 'rejected', 'requires_update'],
      default: 'pending',
      index: true
    },
    verifiedBy: String,
    verificationDate: Date,
    notes: String,
    rejectionReason: String,
    complianceChecks: {
      kycCompleted: { type: Boolean, default: false },
      documentationComplete: { type: Boolean, default: false },
      valuationVerified: { type: Boolean, default: false },
      legalClearance: { type: Boolean, default: false }
    }
  },
  onChainData: {
    contractAddress: String,
    blockNumber: Number,
    transactionHash: String,
    mintedAt: Date
  },
  financialData: {
    currentValue: { type: Number, required: true },
    valueHistory: [{
      value: { type: Number, required: true },
      date: { type: Date, required: true },
      source: { type: String, required: true }
    }],
    utilizationInLoans: [{
      loanId: { type: String, required: true },
      amount: { type: Number, required: true },
      startDate: { type: Date, required: true },
      endDate: Date
    }]
  },
  auditTrail: [{
    action: { type: String, required: true },
    performedBy: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    details: { type: Schema.Types.Mixed }
  }]
}, {
  timestamps: true,
  collection: 'assets'
});

// Enhanced indexes for performance and search
AssetSchema.index({ owner: 1, createdAt: -1 });
AssetSchema.index({ 'verification.status': 1, createdAt: -1 });
AssetSchema.index({ assetType: 1, 'verification.status': 1 });
AssetSchema.index({ 'metadata.valuation.amount': -1 });
AssetSchema.index({ 'metadata.searchKeywords': 1 });
AssetSchema.index({ 'metadata.tags': 1 });
AssetSchema.index({ 'metadata.title': 'text', 'metadata.description': 'text', 'metadata.fullTextContent': 'text' });

export const Asset = mongoose.models.Asset || mongoose.model<IAsset>('Asset', AssetSchema);