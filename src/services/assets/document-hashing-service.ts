/**
 * Document Hashing Service for Credit OS
 * 
 * Provides cryptographic hashing (SHA-256) for RWA documents
 */

import { createHash } from 'crypto';
import { logger } from '../../utils/logger';

export interface DocumentHash {
  sha256: string;
  algorithm: 'sha256';
  timestamp: Date;
}

export interface DocumentHashResult {
  documentHash: DocumentHash;
  fileSize: number;
  mimeType: string;
}

export class DocumentHashingService {
  /**
   * Generate SHA-256 hash for a document buffer
   */
  async hashDocument(
    buffer: Buffer,
    mimeType: string
  ): Promise<DocumentHashResult> {
    try {
      // Generate SHA-256 hash
      const hash = createHash('sha256');
      hash.update(buffer);
      const sha256 = hash.digest('hex');

      const documentHash: DocumentHash = {
        sha256,
        algorithm: 'sha256',
        timestamp: new Date()
      };

      logger.info('Document hashed successfully', {
        sha256: sha256.substring(0, 16) + '...',
        fileSize: buffer.length,
        mimeType
      });

      return {
        documentHash,
        fileSize: buffer.length,
        mimeType
      };
    } catch (error: any) {
      logger.error('Failed to hash document', {
        error: error.message,
        mimeType
      });
      throw error;
    }
  }

  /**
   * Verify document hash matches expected hash
   */
  async verifyDocumentHash(
    buffer: Buffer,
    expectedHash: string
  ): Promise<boolean> {
    try {
      const hash = createHash('sha256');
      hash.update(buffer);
      const actualHash = hash.digest('hex');

      const isValid = actualHash === expectedHash;

      logger.info('Document hash verification', {
        expectedHash: expectedHash.substring(0, 16) + '...',
        actualHash: actualHash.substring(0, 16) + '...',
        isValid
      });

      return isValid;
    } catch (error: any) {
      logger.error('Failed to verify document hash', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Generate hash for multiple documents
   */
  async hashMultipleDocuments(
    documents: Array<{ buffer: Buffer; mimeType: string }>
  ): Promise<DocumentHashResult[]> {
    try {
      const results: DocumentHashResult[] = [];

      for (const doc of documents) {
        const result = await this.hashDocument(doc.buffer, doc.mimeType);
        results.push(result);
      }

      logger.info('Multiple documents hashed', {
        count: documents.length
      });

      return results;
    } catch (error: any) {
      logger.error('Failed to hash multiple documents', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate composite hash for asset with multiple documents
   */
  async generateAssetHash(documentHashes: string[]): Promise<string> {
    try {
      // Sort hashes to ensure consistent ordering
      const sortedHashes = [...documentHashes].sort();
      
      // Create composite hash
      const compositeString = sortedHashes.join('|');
      const hash = createHash('sha256');
      hash.update(compositeString);
      const assetHash = hash.digest('hex');

      logger.info('Asset composite hash generated', {
        documentCount: documentHashes.length,
        assetHash: assetHash.substring(0, 16) + '...'
      });

      return assetHash;
    } catch (error: any) {
      logger.error('Failed to generate asset hash', {
        error: error.message
      });
      throw error;
    }
  }
}
