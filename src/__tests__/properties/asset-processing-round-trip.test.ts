/**
 * Property-Based Tests for Asset Processing Round Trip
 * 
 * **Feature: credit-os, Property 2: Asset Processing Round Trip**
 * **Validates: Requirements 2.2, 2.3**
 * 
 * These tests verify that asset processing maintains data integrity through
 * the complete upload, hash, encrypt, store, retrieve, decrypt cycle.
 */

import fc from 'fast-check';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { DocumentUploadService, UploadedDocument } from '../../lib/assets/document-upload-service';
import { createHash } from 'crypto';

describe('Asset Processing Round Trip Properties', () => {
  let mongoServer: MongoMemoryServer;
  let mongoClient: MongoClient;
  let documentUploadService: DocumentUploadService;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    documentUploadService = new DocumentUploadService(mongoClient);
  });

  afterAll(async () => {
    await mongoClient.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clean up GridFS collections before each test
    const db = mongoClient.db();
    await db.collection('rwa_documents.files').deleteMany({});
    await db.collection('rwa_documents.chunks').deleteMany({});
  });

  /**
   * Property 2: Asset Processing Round Trip
   * For any valid document, uploading then retrieving should produce equivalent content
   */
  test('property: document upload and retrieval preserves content integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid document data
        fc.record({
          content: fc.uint8Array({ minLength: 100, maxLength: 1000 }),
          filename: fc.string({ minLength: 5, maxLength: 50 }).map(s => s + '.pdf'),
          mimeType: fc.constantFrom(
            'application/pdf',
            'image/jpeg', 
            'image/png',
            'text/plain'
          )
        }),
        async (docData) => {
          // Create document object
          const document: UploadedDocument = {
            buffer: Buffer.from(docData.content),
            filename: docData.filename,
            mimeType: docData.mimeType
          };

          // Upload document
          const uploadResult = await documentUploadService.uploadDocument(document);

          // Verify upload result structure
          expect(uploadResult.documentId).toBeDefined();
          expect(uploadResult.hash).toBeDefined();
          expect(uploadResult.hash).toHaveLength(64); // SHA-256 hex length
          expect(uploadResult.encryptedFileId).toBeDefined();
          expect(uploadResult.metadata.filename).toBe(document.filename);
          expect(uploadResult.metadata.mimeType).toBe(document.mimeType);
          expect(uploadResult.metadata.size).toBe(document.buffer.length);

          // Verify hash is correct
          const expectedHash = createHash('sha256').update(document.buffer).digest('hex');
          expect(uploadResult.hash).toBe(expectedHash);

          // Retrieve document
          const retrievedBuffer = await documentUploadService.retrieveDocument(
            uploadResult.encryptedFileId
          );

          // Round trip property: retrieved content should match original
          expect(retrievedBuffer).toEqual(document.buffer);
          expect(retrievedBuffer.length).toBe(document.buffer.length);

          // Verify hash of retrieved content matches
          const retrievedHash = createHash('sha256').update(retrievedBuffer).digest('hex');
          expect(retrievedHash).toBe(uploadResult.hash);
          expect(retrievedHash).toBe(expectedHash);
        }
      ),
      { numRuns: 10, timeout: 30000 }
    );
  });

  /**
   * Property: Hash consistency across multiple uploads of same content
   */
  test('property: identical content produces identical hashes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content: fc.uint8Array({ minLength: 100, maxLength: 5000 }),
          filename1: fc.string({ minLength: 5, maxLength: 30 }).map(s => s + '.pdf'),
          filename2: fc.string({ minLength: 5, maxLength: 30 }).map(s => s + '.pdf'),
          mimeType: fc.constantFrom('application/pdf', 'image/jpeg', 'text/plain')
        }),
        async (data) => {
          const buffer = Buffer.from(data.content);

          // Upload same content with different filenames
          const doc1: UploadedDocument = {
            buffer,
            filename: data.filename1,
            mimeType: data.mimeType
          };

          const doc2: UploadedDocument = {
            buffer,
            filename: data.filename2,
            mimeType: data.mimeType
          };

          const result1 = await documentUploadService.uploadDocument(doc1);
          const result2 = await documentUploadService.uploadDocument(doc2);

          // Same content should produce same hash regardless of filename
          expect(result1.hash).toBe(result2.hash);

          // But different document IDs (includes filename in ID generation)
          expect(result1.documentId).not.toBe(result2.documentId);

          // Both should retrieve to original content
          const retrieved1 = await documentUploadService.retrieveDocument(result1.encryptedFileId);
          const retrieved2 = await documentUploadService.retrieveDocument(result2.encryptedFileId);

          expect(retrieved1).toEqual(buffer);
          expect(retrieved2).toEqual(buffer);
          expect(retrieved1).toEqual(retrieved2);
        }
      ),
      { numRuns: 50, timeout: 30000 }
    );
  });

  /**
   * Property: Duplicate detection works correctly
   */
  test('property: duplicate detection identifies same content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content: fc.uint8Array({ minLength: 100, maxLength: 5000 }),
          filename: fc.string({ minLength: 5, maxLength: 30 }).map(s => s + '.pdf'),
          mimeType: fc.constantFrom('application/pdf', 'image/jpeg')
        }),
        async (data) => {
          const document: UploadedDocument = {
            buffer: Buffer.from(data.content),
            filename: data.filename,
            mimeType: data.mimeType
          };

          // Upload document first time
          const firstUpload = await documentUploadService.uploadDocument(document);

          // Check for duplicates - should not find any yet
          const noDuplicates = await documentUploadService.isDuplicateDocument(firstUpload.hash);
          expect(noDuplicates).toBe(true); // Now it exists, so it's a "duplicate"

          // Upload same content again (different filename to avoid validation issues)
          const document2: UploadedDocument = {
            ...document,
            filename: 'different_' + document.filename
          };

          const secondUpload = await documentUploadService.uploadDocument(document2);

          // Should have same hash
          expect(secondUpload.hash).toBe(firstUpload.hash);

          // Duplicate check should return true
          const hasDuplicates = await documentUploadService.isDuplicateDocument(secondUpload.hash);
          expect(hasDuplicates).toBe(true);
        }
      ),
      { numRuns: 30, timeout: 30000 }
    );
  });

  /**
   * Property: Metadata extraction preserves essential information
   */
  test('property: metadata extraction maintains file characteristics', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content: fc.uint8Array({ minLength: 500, maxLength: 8000 }),
          filename: fc.string({ minLength: 5, maxLength: 40 }).map(s => s + '.txt'),
          mimeType: fc.constant('text/plain') // Focus on text files for predictable metadata
        }),
        async (data) => {
          const document: UploadedDocument = {
            buffer: Buffer.from(data.content),
            filename: data.filename,
            mimeType: data.mimeType
          };

          const uploadResult = await documentUploadService.uploadDocument(document);

          // Metadata should preserve basic file information
          expect(uploadResult.metadata.filename).toBe(document.filename);
          expect(uploadResult.metadata.mimeType).toBe(document.mimeType);
          expect(uploadResult.metadata.size).toBe(document.buffer.length);
          expect(uploadResult.metadata.uploadedAt).toBeInstanceOf(Date);

          // For text files, should have extracted text metadata
          if (data.mimeType === 'text/plain') {
            expect(uploadResult.metadata.extractedData).toBeDefined();
            expect(uploadResult.metadata.extractedData?.textInfo).toBeDefined();
            
            const textInfo = uploadResult.metadata.extractedData?.textInfo;
            expect(textInfo.characterCount).toBeGreaterThan(0);
            expect(textInfo.encoding).toBe('utf-8');
          }

          // Round trip should preserve all metadata relationships
          const retrieved = await documentUploadService.retrieveDocument(uploadResult.encryptedFileId);
          expect(retrieved.length).toBe(uploadResult.metadata.size);
        }
      ),
      { numRuns: 50, timeout: 30000 }
    );
  });

  /**
   * Property: File validation correctly rejects invalid inputs
   */
  test('property: file validation rejects invalid documents consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content: fc.oneof(
            fc.constant(new Uint8Array(0)), // Empty file
            fc.uint8Array({ minLength: 60 * 1024 * 1024, maxLength: 60 * 1024 * 1024 }) // Too large
          ),
          filename: fc.string({ minLength: 1, maxLength: 20 }).map(s => s + '.pdf'),
          mimeType: fc.oneof(
            fc.constant('application/pdf'),
            fc.constant('application/exe'), // Unsupported type
            fc.constant('text/html') // Unsupported type
          )
        }),
        async (data) => {
          const document: UploadedDocument = {
            buffer: Buffer.from(data.content),
            filename: data.filename,
            mimeType: data.mimeType
          };

          // Should reject invalid documents
          const shouldReject = 
            data.content.length === 0 || // Empty file
            data.content.length > 50 * 1024 * 1024 || // Too large
            !['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 
               'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
               'text/plain'].includes(data.mimeType); // Unsupported type

          if (shouldReject) {
            await expect(documentUploadService.uploadDocument(document))
              .rejects.toThrow();
          }
        }
      ),
      { numRuns: 50, timeout: 30000 }
    );
  });

  /**
   * Property: Document deletion removes all traces
   */
  test('property: document deletion completely removes stored data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content: fc.uint8Array({ minLength: 100, maxLength: 2000 }),
          filename: fc.string({ minLength: 5, maxLength: 30 }).map(s => s + '.pdf'),
          mimeType: fc.constant('application/pdf')
        }),
        async (data) => {
          const document: UploadedDocument = {
            buffer: Buffer.from(data.content),
            filename: data.filename,
            mimeType: data.mimeType
          };

          // Upload document
          const uploadResult = await documentUploadService.uploadDocument(document);

          // Verify it can be retrieved
          const retrieved = await documentUploadService.retrieveDocument(uploadResult.encryptedFileId);
          expect(retrieved).toEqual(document.buffer);

          // Delete document
          await documentUploadService.deleteDocument(uploadResult.encryptedFileId);

          // Should no longer be retrievable
          await expect(
            documentUploadService.retrieveDocument(uploadResult.encryptedFileId)
          ).rejects.toThrow();
        }
      ),
      { numRuns: 30, timeout: 30000 }
    );
  });
});