import { createHash } from 'crypto';
import { GridFSBucket, MongoClient } from 'mongodb';
import { Readable } from 'stream';

export interface DocumentUploadResult {
  documentId: string;
  hash: string;
  metadata: DocumentMetadata;
  encryptedFileId: string;
}

export interface DocumentMetadata {
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  extractedData?: Record<string, any>;
}

export interface UploadedDocument {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export class DocumentUploadService {
  private gridFSBucket: GridFSBucket;
  private readonly SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  constructor(mongoClient: MongoClient, bucketName: string = 'rwa_documents') {
    this.gridFSBucket = new GridFSBucket(mongoClient.db(), { bucketName });
  }

  /**
   * Upload and process RWA document with validation and encryption
   */
  async uploadDocument(document: UploadedDocument): Promise<DocumentUploadResult> {
    // Validate file
    this.validateDocument(document);

    // Generate cryptographic hash
    const hash = this.generateDocumentHash(document.buffer);

    // Extract metadata
    const metadata: DocumentMetadata = {
      filename: document.filename,
      mimeType: document.mimeType,
      size: document.buffer.length,
      uploadedAt: new Date(),
      extractedData: await this.extractMetadata(document)
    };

    // Encrypt and store document
    const encryptedFileId = await this.storeEncryptedDocument(document, hash);

    // Generate unique document ID
    const documentId = this.generateDocumentId(hash, metadata);

    return {
      documentId,
      hash,
      metadata,
      encryptedFileId
    };
  }

  /**
   * Validate document meets requirements
   */
  private validateDocument(document: UploadedDocument): void {
    // Check file size
    if (document.buffer.length > this.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Check MIME type
    if (!this.SUPPORTED_MIME_TYPES.includes(document.mimeType)) {
      throw new Error(`Unsupported file type: ${document.mimeType}`);
    }

    // Check for empty file
    if (document.buffer.length === 0) {
      throw new Error('Empty file not allowed');
    }

    // Basic file integrity check
    if (!this.isValidFileStructure(document)) {
      throw new Error('Invalid or corrupted file structure');
    }
  }

  /**
   * Generate SHA-256 hash of document content
   */
  private generateDocumentHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Extract metadata from various file formats
   */
  private async extractMetadata(document: UploadedDocument): Promise<Record<string, any>> {
    const extractedData: Record<string, any> = {};

    try {
      switch (document.mimeType) {
        case 'application/pdf':
          extractedData.pdfInfo = await this.extractPdfMetadata(document.buffer);
          break;
        case 'image/jpeg':
        case 'image/png':
        case 'image/tiff':
          extractedData.imageInfo = await this.extractImageMetadata(document.buffer);
          break;
        case 'text/plain':
          extractedData.textInfo = await this.extractTextMetadata(document.buffer);
          break;
        default:
          extractedData.basicInfo = {
            detectedType: document.mimeType,
            hasContent: document.buffer.length > 0
          };
      }
    } catch (error) {
      // Log error but don't fail upload
      console.warn(`Metadata extraction failed for ${document.filename}:`, error);
      extractedData.extractionError = error instanceof Error ? error.message : 'Unknown error';
    }

    return extractedData;
  }

  /**
   * Store encrypted document in GridFS
   */
  private async storeEncryptedDocument(document: UploadedDocument, hash: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.gridFSBucket.openUploadStream(document.filename, {
        metadata: {
          originalName: document.filename,
          mimeType: document.mimeType,
          hash,
          uploadedAt: new Date(),
          encrypted: true
        }
      });

      uploadStream.on('error', reject);
      uploadStream.on('finish', () => {
        resolve(uploadStream.id.toString());
      });

      // Create readable stream from buffer and pipe to GridFS
      const readableStream = new Readable();
      readableStream.push(this.encryptBuffer(document.buffer));
      readableStream.push(null);
      readableStream.pipe(uploadStream);
    });
  }

  /**
   * Generate unique document ID from hash and metadata
   */
  private generateDocumentId(hash: string, metadata: DocumentMetadata): string {
    const idData = `${hash}-${metadata.filename}-${metadata.uploadedAt.getTime()}`;
    return createHash('sha256').update(idData).digest('hex').substring(0, 16);
  }

  /**
   * Basic file structure validation
   */
  private isValidFileStructure(document: UploadedDocument): boolean {
    const buffer = document.buffer;
    
    switch (document.mimeType) {
      case 'application/pdf':
        return buffer.subarray(0, 4).toString() === '%PDF';
      case 'image/jpeg':
        return buffer[0] === 0xFF && buffer[1] === 0xD8;
      case 'image/png':
        return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
      case 'text/plain':
        return true; // Text files don't have specific headers
      default:
        return true; // Allow other types to pass basic validation for testing
    }
  }

  /**
   * Extract PDF metadata (placeholder - would use pdf-parse in real implementation)
   */
  private async extractPdfMetadata(buffer: Buffer): Promise<Record<string, any>> {
    // Placeholder implementation - in production would use pdf-parse library
    return {
      pageCount: this.estimatePdfPages(buffer),
      hasText: buffer.includes(Buffer.from('stream')),
      fileSize: buffer.length
    };
  }

  /**
   * Extract image metadata (placeholder - would use sharp in real implementation)
   */
  private async extractImageMetadata(buffer: Buffer): Promise<Record<string, any>> {
    // Placeholder implementation - in production would use sharp library
    return {
      fileSize: buffer.length,
      hasImageData: buffer.length > 1000 // Basic check for substantial image data
    };
  }

  /**
   * Extract text metadata
   */
  private async extractTextMetadata(buffer: Buffer): Promise<Record<string, any>> {
    const text = buffer.toString('utf-8');
    return {
      characterCount: text.length,
      lineCount: text.split('\n').length,
      wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
      encoding: 'utf-8'
    };
  }

  /**
   * Estimate PDF page count from buffer (basic implementation)
   */
  private estimatePdfPages(buffer: Buffer): number {
    const pageMatches = buffer.toString('binary').match(/\/Type\s*\/Page[^s]/g);
    return pageMatches ? pageMatches.length : 1;
  }

  /**
   * Simple encryption for document storage (placeholder)
   * In production, would use proper encryption with key management
   */
  private encryptBuffer(buffer: Buffer): Buffer {
    // Placeholder encryption - XOR with simple key
    // In production, use AES-256-GCM with proper key management
    const key = Buffer.from('simple-encryption-key-placeholder-32b');
    const encrypted = Buffer.alloc(buffer.length);
    
    for (let i = 0; i < buffer.length; i++) {
      encrypted[i] = buffer[i] ^ key[i % key.length];
    }
    
    return encrypted;
  }

  /**
   * Retrieve and decrypt document
   */
  async retrieveDocument(encryptedFileId: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // Convert string ID to ObjectId for GridFS
      let objectId;
      try {
        const { ObjectId } = require('mongodb');
        objectId = new ObjectId(encryptedFileId);
      } catch (error) {
        reject(new Error(`Invalid file ID format: ${encryptedFileId}`));
        return;
      }

      const downloadStream = this.gridFSBucket.openDownloadStream(objectId);
      const chunks: Buffer[] = [];

      downloadStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      downloadStream.on('end', () => {
        const encryptedBuffer = Buffer.concat(chunks);
        const decryptedBuffer = this.decryptBuffer(encryptedBuffer);
        resolve(decryptedBuffer);
      });

      downloadStream.on('error', reject);
    });
  }

  /**
   * Decrypt document buffer
   */
  private decryptBuffer(encryptedBuffer: Buffer): Buffer {
    // Reverse of encryptBuffer - same XOR operation
    return this.encryptBuffer(encryptedBuffer);
  }

  /**
   * Check if document hash already exists (duplicate detection)
   */
  async isDuplicateDocument(hash: string): Promise<boolean> {
    try {
      const existingFile = await this.gridFSBucket.find({ 'metadata.hash': hash }).limit(1).toArray();
      return existingFile.length > 0;
    } catch (error) {
      console.error('Error checking for duplicate document:', error);
      return false;
    }
  }

  /**
   * Delete document by encrypted file ID
   */
  async deleteDocument(encryptedFileId: string): Promise<void> {
    const { ObjectId } = require('mongodb');
    const objectId = new ObjectId(encryptedFileId);
    await this.gridFSBucket.delete(objectId);
  }
}