/**
 * Simplified Property-Based Tests for Asset Processing Round Trip
 * 
 * **Feature: credit-os, Property 2: Asset Processing Round Trip**
 * **Validates: Requirements 2.2, 2.3**
 */

import fc from 'fast-check';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { DocumentUploadService, UploadedDocument } from '../../lib/assets/document-upload-service';
import { createHash } from 'crypto';

describe('Asset Processing Round Trip Properties (Simplified)', () => {
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
        // Generate smaller, valid document data
        fc.record({
          content: fc.uint8Array({ minLength: 100, maxLength: 1000 }),
          filename: fc.string({ minLength: 5, maxLength: 20 }).map(s => s + '.pdf'),
          mimeType: fc.constantFrom('application/pdf', 'text/plain')
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
        }
      ),
      { numRuns: 5, timeout: 15000 }
    );
  });

  /**
   * Property: Hash consistency across multiple uploads of same content
   */
  test('property: identical content produces identical hashes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content: fc.uint8Array({ minLength: 100, maxLength: 500 }),
          filename1: fc.string({ minLength: 5, maxLength: 15 }).map(s => s + '1.pdf'),
          filename2: fc.string({ minLength: 5, maxLength: 15 }).map(s => s + '2.pdf'),
          mimeType: fc.constantFrom('application/pdf', 'text/plain')
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

          // Both should retrieve to original content
          const retrieved1 = await documentUploadService.retrieveDocument(result1.encryptedFileId);
          const retrieved2 = await documentUploadService.retrieveDocument(result2.encryptedFileId);

          expect(retrieved1).toEqual(buffer);
          expect(retrieved2).toEqual(buffer);
        }
      ),
      { numRuns: 3, timeout: 15000 }
    );
  });

  /**
   * Basic unit test to verify the service works
   */
  test('basic document upload and retrieval works', async () => {
    const testContent = Buffer.from('Hello, World! This is a test document.');
    const document: UploadedDocument = {
      buffer: testContent,
      filename: 'test.txt',
      mimeType: 'text/plain'
    };

    const uploadResult = await documentUploadService.uploadDocument(document);
    expect(uploadResult.documentId).toBeDefined();
    expect(uploadResult.hash).toBeDefined();

    const retrievedBuffer = await documentUploadService.retrieveDocument(uploadResult.encryptedFileId);
    expect(retrievedBuffer).toEqual(testContent);
  });
});