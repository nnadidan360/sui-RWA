export type AssetType = 'real_estate' | 'commodity' | 'invoice' | 'equipment' | 'other';

export type VerificationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'requires_update';

export type DocumentType = 'deed' | 'appraisal' | 'insurance' | 'permit' | 'other';

export interface AssetDocument {
  type: DocumentType;
  ipfsHash: string;
  fileName: string;
  uploadDate: Date;
  verifiedBy?: string;
  verificationDate?: Date;
}

export interface AssetValuation {
  amount: number;
  currency: string;
  date: Date;
  appraiser?: string;
}

export interface AssetLocation {
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface AssetMetadata {
  title: string;
  description: string;
  location?: AssetLocation;
  valuation: AssetValuation;
  documents: AssetDocument[];
  specifications?: Record<string, any>;
}

export interface VerificationData {
  status: VerificationStatus;
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
}

export interface OnChainData {
  contractAddress?: string;
  blockNumber?: number;
  transactionHash?: string;
  mintedAt?: Date;
}

export interface FinancialData {
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
}

export interface AuditTrailEntry {
  action: string;
  performedBy: string;
  timestamp: Date;
  details: Record<string, any>;
}

export interface Asset {
  id: string;
  tokenId: string;
  assetType: AssetType;
  owner: string;
  metadata: AssetMetadata;
  verification: VerificationData;
  onChainData: OnChainData;
  financialData: FinancialData;
  auditTrail: AuditTrailEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetFormData {
  assetType: AssetType;
  title: string;
  description: string;
  location?: {
    address: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  valuation: {
    amount: number;
    currency: string;
    appraiser?: string;
  };
  specifications?: Record<string, any>;
}

export interface FileUpload {
  file: File;
  type: DocumentType;
  preview?: string;
}

export interface AssetFilters {
  assetType?: AssetType;
  status?: VerificationStatus;
  owner?: string;
  minValue?: number;
  maxValue?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'currentValue' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface AssetsPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface AssetsResponse {
  success: boolean;
  data: {
    assets: Asset[];
    pagination: AssetsPagination;
  };
  error?: string;
}