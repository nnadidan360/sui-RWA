/**
 * Document Upload Service for Credit OS
 * 
 * Handles RWA document uploads with validation, hashing, and GridFS storage
 */

import { Readable } from 'stream';
import mongoose from 'mongoose';
import { logger } from '../../utils/logger';
import { DocumentHashingService } from './document-hashing-service';
import { MetadataExtractionService } from './metadata-extraction-service';

export interface DocumentUploadRequest {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  userId: string;
  assetId: string;
  documentType: 'deed' | 'appraisal' | 'insurance' | 'permit' | 'other';
}

export interface DocumentUploadResult {
  success: boolean;
  documentId?: string;
  sha256Hash?: string;
  ipfsHash?: string;
  fileSize?: number;
  metadata?: any;
  errors?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class DocumentUploadService {
  private hashingService: DocumentHashingService;
  private metadataService: MetadataExtractionService;
  private gridFSBucket?: mongoose.mongo.GridFSBucket;

  // Validation constants
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  constructor() {
    this.hashingService = new DocumentHashingService();
    this.metadataService = new MetadataExtractionService();
  }

  /**
   * Initialize GridFS bucket
   */
  initializeGridFS(connection: mongoose.Connection): void {
    this.gridFSBucket = new mongoose.mongo.GridFSBucket(connection.db, {
      bucketName: 'rwa_documents'
    });
    logger.info('GridFS bucket initialized for RWA documents');
  }

  /**
   * Upload document with full processing pipeline
   */
  async uploadDocument(
    request: DocumentUploadRequest
  ): Promise<DocumentUploadResult> {
    try {
      // Validate document
      const validation = await this.validateDocument(request);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // Generate document hash
      const hashResult = await this.hashingService.hashDocument(
        request.buffer,
        request.mimeType
      );

      // Extract metadata
      const metadataResult = await this.metadataService.extractMetadata(
        request.buffer,
        request.fileName,
        request.mimeType
      );

      // Store in GridFS
      const documentId = await this.storeInGridFS(request, hashResult.documentHash.sha256);

      // In production, would also upload to IPFS
      const ipfsHash = await this.uploadToIPFS(request.buffer);

      logger.info('Document uploaded successfully', {
        documentId,
        sha256: hashResult.documentHash.sha256.substring(0, 16) + '...',
        ipfsHash,
        userId: request.userId,
        assetId: request.assetId
      });

      return {
        success: true,
        documentId,
        sha256Hash: hashResult.documentHash.sha256,
        ipfsHash,
        fileSize: hashResult.fileSize,
        metadata: metadataResult.metadata
      };
    } catch (error: any) {
      logger.error('Failed to upload document', {
        error: error.message,
        userId: request.userId,
        assetId: request.assetId
      });

      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Validate document before upload
   */
  private async validateDocument(
    request: DocumentUploadRequest
  ): Promise<ValidationResult> {
    const errors: string[] = [];

    // Check file size
    if (request.buffer.length > this.MAX_FILE_SIZE) {
      errors.push(`File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Check mime type
    if (!this.ALLOWED_MIME_TYPES.includes(request.mimeType)) {
      errors.push(`File type ${request.mimeType} is not allowed`);
    }

    // Validate file format matches mime type
    const formatValidation = await this.metadataService.validateDocumentFormat(
      request.buffer,
      request.mimeType
    );

    if (!formatValidation.isValid) {
      errors.push(formatValidation.reason || 'Invalid file format');
    }

    // Check for empty file
    if (request.buffer.length === 0) {
      errors.push('File is empty');
    }

    // Validate filename
    if (!request.fileName || request.fileName.trim().length === 0) {
      errors.push('Filename is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Store document in MongoDB GridFS
   */
  private async storeInGridFS(
    request: DocumentUploadRequest,
    sha256Hash: string
  ): Promise<string> {
    if (!this.gridFSBucket) {
      throw new Error('GridFS bucket not initialized');
    }

    return new Promise((resolve, reject) => {
      const readableStream = Readable.from(request.buffer);
      
      const uploadStream = this.gridFSBucket!.openUploadStream(request.fileName, {
        metadata: {
          userId: request.userId,
          assetId: request.assetId,
          documentType: request.documentType,
          mimeType: request.mimeType,
          sha256Hash,
          uploadDate: new Date(),
          encrypted: true // Mark as encrypted in production
        }
      });

      readableStream.pipe(uploadStream);

      uploadStream.on('finish', () => {
        logger.info('Document stored in GridFS', {
          fileId: uploadStream.id.toString(),
          fileName: request.fileName
        });
        resolve(uploadStream.id.toString());
      });

      uploadStream.on('error', (error) => {
        logger.error('Failed to store document in GridFS', {
          error: error.message,
          fileName: request.fileName
        });
        reject(error);
      });
    });
  }

  /**
   * Retrieve document from GridFS
   */
  async retrieveDocument(documentId: string): Promise<Buffer> {
    if (!this.gridFSBucket) {
      throw new Error('GridFS bucket not initialized');
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      const downloadStream = this.gridFSBucket!.openDownloadStream(
        new mongoose.Types.ObjectId(documentId)
      );

      downloadStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      downloadStream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        logger.info('Document retrieved from GridFS', {
          documentId,
          size: buffer.length
        });
        resolve(buffer);
      });

      downloadStream.on('error', (error) => {
        logger.error('Failed to retrieve document from GridFS', {
          error: error.message,
          documentId
        });
        reject(error);
      });
    });
  }

  /**
   * Delete document from GridFS
   */
  async deleteDocument(documentId: string): Promise<void> {
    if (!this.gridFSBucket) {
      throw new Error('GridFS bucket not initialized');
    }

    try {
      await this.gridFSBucket.delete(new mongoose.Types.ObjectId(documentId));
      logger.info('Document deleted from GridFS', { documentId });
    } catch (error: any) {
      logger.error('Failed to delete document from GridFS', {
        error: error.message,
        documentId
      });
      throw error;
    }
  }

  /**
   * Upload to IPFS (mock implementation)
   */
  private async uploadToIPFS(buffer: Buffer): Promise<string> {
    // Mock implementation - in production would integrate with IPFS service
    // like Pinata, Infura, or local IPFS node
    
    const mockHash = `Qm${Buffer.from(buffer.slice(0, 32)).toString('base64').substring(0, 44)}`;
    
    logger.info('Document uploaded to IPFS (mock)', {
      ipfsHash: mockHash,
      size: buffer.length
    });

    return mockHash;
  }

  /**
   * Check if document with hash already exists
   */
  async documentExists(sha256Hash: string, userId: string): Promise<boolean> {
    if (!this.gridFSBucket) {
      throw new Error('GridFS bucket not initialized');
    }

    try {
      const files = await this.gridFSBucket
        .find({
          'metadata.sha256Hash': sha256Hash,
          'metadata.userId': userId
        })
        .toArray();

      return files.length > 0;
    } catch (error: any) {
      logger.error('Failed to check document existence', {
        error: error.message,
        sha256Hash: sha256Hash.substring(0, 16) + '...'
      });
      return false;
    }
  }

  /**
   * Get document metadata from GridFS
   */
  async getDocumentMetadata(documentId: string): Promise<any> {
    if (!this.gridFSBucket) {
      throw new Error('GridFS bucket not initialized');
    }

    try {
      const files = await this.gridFSBucket
        .find({ _id: new mongoose.Types.ObjectId(documentId) })
        .toArray();

      if (files.length === 0) {
        throw new Error('Document not found');
      }

      return files[0].metadata;
    } catch (error: any) {
      logger.error('Failed to get document metadata', {
        error: error.message,
        documentId
      });
      throw error;
    }
  }
}
