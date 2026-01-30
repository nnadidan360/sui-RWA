/**
 * IPFS Service for Asset Documentation Storage
 * 
 * This service handles uploading, retrieving, and validating asset documents
 * stored on IPFS for the Astake protocol.
 */

export interface IPFSUploadResult {
  hash: string;
  size: number;
  url: string;
}

export interface DocumentMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadDate: Date;
  documentType: 'deed' | 'appraisal' | 'insurance' | 'permit' | 'identity' | 'other';
}

export interface IPFSDocument {
  hash: string;
  metadata: DocumentMetadata;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verifiedBy?: string;
  verificationDate?: Date;
  verificationNotes?: string;
}

export class IPFSServiceError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'IPFSServiceError';
  }
}

/**
 * IPFS Service Implementation
 * 
 * Provides secure document storage and retrieval for asset tokenization
 */
export class IPFSService {
  private readonly ipfsGateway: string;
  private readonly pinataApiKey?: string;
  private readonly pinataSecretKey?: string;
  private documents: Map<string, IPFSDocument> = new Map();

  constructor(config?: {
    ipfsGateway?: string;
    pinataApiKey?: string;
    pinataSecretKey?: string;
  }) {
    this.ipfsGateway = config?.ipfsGateway || 'https://gateway.pinata.cloud/ipfs/';
    this.pinataApiKey = config?.pinataApiKey;
    this.pinataSecretKey = config?.pinataSecretKey;
  }

  /**
   * Upload document to IPFS
   * In production, this would integrate with Pinata or similar IPFS service
   */
  async uploadDocument(
    fileBuffer: Buffer,
    metadata: DocumentMetadata
  ): Promise<IPFSUploadResult> {
    try {
      // Validate file size (max 10MB)
      if (fileBuffer.length > 10 * 1024 * 1024) {
        throw new IPFSServiceError('FILE_TOO_LARGE', 'File size exceeds 10MB limit');
      }

      // Validate file type
      this.validateFileType(metadata.mimeType);

      // Generate mock IPFS hash for testing
      // In production, this would use actual IPFS upload
      const hash = this.generateMockIPFSHash(fileBuffer, metadata.fileName);

      // Store document metadata
      const document: IPFSDocument = {
        hash,
        metadata,
        verificationStatus: 'pending',
      };

      this.documents.set(hash, document);

      return {
        hash,
        size: fileBuffer.length,
        url: `${this.ipfsGateway}${hash}`,
      };
    } catch (error) {
      if (error instanceof IPFSServiceError) {
        throw error;
      }
      throw new IPFSServiceError('UPLOAD_FAILED', `Failed to upload document: ${error}`);
    }
  }

  /**
   * Retrieve document from IPFS
   */
  async getDocument(hash: string): Promise<IPFSDocument | null> {
    // Validate IPFS hash format
    if (!this.isValidIPFSHash(hash)) {
      throw new IPFSServiceError('INVALID_HASH', 'Invalid IPFS hash format');
    }

    return this.documents.get(hash) || null;
  }

  /**
   * Verify document authenticity and content
   */
  async verifyDocument(
    hash: string,
    verifier: string,
    status: 'verified' | 'rejected',
    notes?: string
  ): Promise<void> {
    const document = this.documents.get(hash);
    if (!document) {
      throw new IPFSServiceError('DOCUMENT_NOT_FOUND', `Document with hash ${hash} not found`);
    }

    document.verificationStatus = status;
    document.verifiedBy = verifier;
    document.verificationDate = new Date();
    document.verificationNotes = notes;

    this.documents.set(hash, document);
  }

  /**
   * Get document URL for viewing
   */
  getDocumentUrl(hash: string): string {
    if (!this.isValidIPFSHash(hash)) {
      throw new IPFSServiceError('INVALID_HASH', 'Invalid IPFS hash format');
    }

    return `${this.ipfsGateway}${hash}`;
  }

  /**
   * Batch upload multiple documents
   */
  async uploadMultipleDocuments(
    files: Array<{ buffer: Buffer; metadata: DocumentMetadata }>
  ): Promise<IPFSUploadResult[]> {
    const results: IPFSUploadResult[] = [];

    for (const file of files) {
      try {
        const result = await this.uploadDocument(file.buffer, file.metadata);
        results.push(result);
      } catch (error) {
        // Continue with other files, but log the error
        console.error(`Failed to upload ${file.metadata.fileName}:`, error);
        throw error; // Re-throw to fail the entire batch
      }
    }

    return results;
  }

  /**
   * Get all documents for an asset
   */
  async getAssetDocuments(documentHashes: string[]): Promise<IPFSDocument[]> {
    const documents: IPFSDocument[] = [];

    for (const hash of documentHashes) {
      const document = await this.getDocument(hash);
      if (document) {
        documents.push(document);
      }
    }

    return documents;
  }

  /**
   * Validate document completeness for asset type
   */
  validateDocumentCompleteness(
    assetType: string,
    documents: IPFSDocument[]
  ): { isComplete: boolean; missingDocuments: string[] } {
    const requiredDocuments = this.getRequiredDocuments(assetType);
    const providedTypes = documents.map(doc => doc.metadata.documentType);
    const missingDocuments = requiredDocuments.filter(
      required => !providedTypes.includes(required)
    );

    return {
      isComplete: missingDocuments.length === 0,
      missingDocuments,
    };
  }

  /**
   * Pin document to ensure persistence
   * In production, this would use Pinata or similar pinning service
   */
  async pinDocument(hash: string): Promise<void> {
    if (!this.isValidIPFSHash(hash)) {
      throw new IPFSServiceError('INVALID_HASH', 'Invalid IPFS hash format');
    }

    // Mock pinning - in production would call Pinata API
    console.log(`Pinning document ${hash} to IPFS`);
  }

  /**
   * Remove document pin (for cleanup)
   */
  async unpinDocument(hash: string): Promise<void> {
    if (!this.isValidIPFSHash(hash)) {
      throw new IPFSServiceError('INVALID_HASH', 'Invalid IPFS hash format');
    }

    // Mock unpinning - in production would call Pinata API
    console.log(`Unpinning document ${hash} from IPFS`);
  }

  // Private helper methods

  private validateFileType(mimeType: string): void {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(mimeType)) {
      throw new IPFSServiceError('INVALID_FILE_TYPE', `File type ${mimeType} not allowed`);
    }
  }

  private generateMockIPFSHash(buffer: Buffer, fileName: string): string {
    // Generate a mock IPFS hash for testing that passes validation
    // In production, this would be the actual IPFS hash returned from upload
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 1000000);
    
    // Use a known good pattern with variety
    const baseHashes = [
      'QmNLei78zWmzUdbeRB3CiUfAizWUrbeeZh5K1rhAQKCh51',
      'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
      'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB',
      'QmRAQB6YaCyidP37UdDnjFY5vQuiBrcqdyoW1CuDgwxkD4',
      'QmSrCRJmzE4zE1nAfWPbzVfanKQNBhp7ZWmMnEdkAAUEgh'
    ];
    
    const baseIndex = (timestamp + randomNum) % baseHashes.length;
    const baseHash = baseHashes[baseIndex];
    
    // Modify a few characters to make it unique while keeping it valid
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = baseHash;
    
    // Change 2-3 characters to make it unique
    for (let i = 0; i < 3; i++) {
      const pos = 2 + ((timestamp + i) % 42); // Skip 'Qm' prefix
      const charIndex = (timestamp + randomNum + i) % chars.length;
      result = result.substring(0, pos) + chars[charIndex] + result.substring(pos + 1);
    }
    
    return result;
  }

  private isValidIPFSHash(hash: string): boolean {
    // Basic IPFS hash validation (CIDv0 format)
    // Must start with Qm and be exactly 46 characters
    // Uses base58 alphabet excluding 0, O, I, l to avoid confusion
    if (!/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(hash)) {
      return false;
    }
    
    // Additional check: reject hashes with repeated characters (likely invalid)
    const hashPart = hash.substring(2);
    const uniqueChars = new Set(hashPart);
    if (uniqueChars.size < 10) { // Real IPFS hashes should have more variety
      return false;
    }
    
    return true;
  }

  private getRequiredDocuments(assetType: string): DocumentMetadata['documentType'][] {
    const requirements: Record<string, DocumentMetadata['documentType'][]> = {
      real_estate: ['deed', 'appraisal', 'insurance'],
      commodity: ['appraisal', 'insurance'],
      invoice: ['identity', 'other'], // Invoice copy and business registration
      equipment: ['appraisal', 'insurance'],
      other: ['appraisal'],
    };

    return requirements[assetType] || ['appraisal'];
  }
}

/**
 * Default IPFS service instance
 */
export const ipfsService = new IPFSService();