/**
 * Working Property-Based Tests for Asset Processing Round Trip
 * 
 * **Feature: credit-os, Property 2: Asset Processing Round Trip**
 * **Validates: Requirements 2.2, 2.3**
 */

import fc from 'fast-check';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { DocumentUploadService, UploadedDocument } from '../../lib/assets/document-upload-service';
import { createHash } from 'crypto';

describe('Asset Processing Round Trip Properties (Working)', () => {
  let mongoServer: MongoMemoryServer;
  let mongoClient: MongoClient;
  let documentUploadService: DocumentUploadService;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'test-db',
        storageEngine: 'wiredTiger'
      }
    });
    const uri = mongoServer.getUri();
    mongoClient = new MongoClient(uri, {
      maxPoolSize: 1,
      minPoolSize: 1
    });
    await mongoClient.connect();
    documentUploadService = new DocumentUploadService(mongoClient);
  }, 30000);

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

  // Helper function to generate valid PDF content
  const generateValidPDF = (content: string): Buffer => {
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length ${content.length + 20}
>>
stream
BT
/F1 12 Tf
100 700 Td
(${content}) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000074 00000 n 
0000000120 00000 n 
0000000179 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
${300 + content.length}
%%EOF`;
    return Buffer.from(pdfContent);
  };

  // Helper function to generate valid text content
  const generateValidText = (content: string): Buffer => {
    return Buffer.from(content, 'utf-8');
  };

  /**
   * Property 2: Asset Processing Round Trip
   * For any valid document, uploading then retrieving should produce equivalent content
   */
  test('property: document upload and retrieval preserves content integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          textContent: fc.string({ minLength: 5, maxLength: 20 }),
          filename: fc.string({ minLength: 5, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_') + '.txt'),
        }),
        async (data) => {
          // Create valid text document
          const buffer = generateValidText(data.textContent);
          const document: UploadedDocument = {
            buffer,
            filename: data.filename,
            mimeType: 'text/plain'
          };

          // Upload document
          const uploadResult = await documentUploadService.uploadDocument(document);

          // Verify upload result structure
          expect(uploadResult.documentId).toBeDefined();
          expect(uploadResult.hash).toBeDefined();
          expect(uploadResult.hash).toHaveLength(64); // SHA-256 hex length
          expect(uploadResult.encryptedFileId).toBeDefined();

          // Verify hash is correct
          const expectedHash = createHash('sha256').update(buffer).digest('hex');
          expect(uploadResult.hash).toBe(expectedHash);

          // Retrieve document
          const retrievedBuffer = await documentUploadService.retrieveDocument(
            uploadResult.encryptedFileId
          );

          // Round trip property: retrieved content should match original
          expect(retrievedBuffer).toEqual(buffer);
          expect(retrievedBuffer.length).toBe(buffer.length);

          // Verify hash of retrieved content matches
          const retrievedHash = createHash('sha256').update(retrievedBuffer).digest('hex');
          expect(retrievedHash).toBe(uploadResult.hash);
        }
      ),
      { numRuns: 2, timeout: 5000 }
    );
  });

  /**
   * Property: Hash consistency across multiple uploads of same content
   */
  test('property: identical content produces identical hashes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          textContent: fc.string({ minLength: 5, maxLength: 15 }),
          filename1: fc.string({ minLength: 5, maxLength: 15 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_') + '1.txt'),
          filename2: fc.string({ minLength: 5, maxLength: 15 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_') + '2.txt'),
        }),
        async (data) => {
          const buffer = generateValidText(data.textContent);

          // Upload same content with different filenames
          const doc1: UploadedDocument = {
            buffer,
            filename: data.filename1,
            mimeType: 'text/plain'
          };

          const doc2: UploadedDocument = {
            buffer,
            filename: data.filename2,
            mimeType: 'text/plain'
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
      { numRuns: 2, timeout: 5000 }
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

  /**
   * Test duplicate detection
   */
  test('duplicate detection works correctly', async () => {
    const testContent = Buffer.from('Duplicate test content');
    const document: UploadedDocument = {
      buffer: testContent,
      filename: 'duplicate-test.txt',
      mimeType: 'text/plain'
    };

    // Upload first time
    const result1 = await documentUploadService.uploadDocument(document);
    
    // Check for duplicates - should find the uploaded document
    const isDuplicate = await documentUploadService.isDuplicateDocument(result1.hash);
    expect(isDuplicate).toBe(true);
  });

  /**
   * Test file validation
   */
  test('file validation rejects invalid files', async () => {
    // Empty file should be rejected
    const emptyDocument: UploadedDocument = {
      buffer: Buffer.alloc(0),
      filename: 'empty.txt',
      mimeType: 'text/plain'
    };

    await expect(documentUploadService.uploadDocument(emptyDocument))
      .rejects.toThrow('Empty file not allowed');

    // Unsupported file type should be rejected
    const unsupportedDocument: UploadedDocument = {
      buffer: Buffer.from('test content'),
      filename: 'test.exe',
      mimeType: 'application/exe'
    };

    await expect(documentUploadService.uploadDocument(unsupportedDocument))
      .rejects.toThrow('Unsupported file type');
  });
});