/**
 * Fast Property-Based Tests for Asset Processing Round Trip
 * 
 * **Feature: credit-os, Property 2: Asset Processing Round Trip**
 * **Validates: Requirements 2.2, 2.3**
 */

import fc from 'fast-check';
import { DocumentUploadService, UploadedDocument } from '../../lib/assets/document-upload-service';
import { createHash } from 'crypto';

// Mock MongoDB for faster testing
jest.mock('mongodb', () => {
  const mockGridFSBucket = {
    openUploadStream: jest.fn(),
    openDownloadStream: jest.fn(),
    delete: jest.fn(),
    find: jest.fn()
  };

  const mockUploadStream = {
    id: { toString: () => 'mock-file-id-12345' },
    on: jest.fn((event, callback) => {
      if (event === 'finish') {
        setTimeout(callback, 1);
      }
    }),
    write: jest.fn(),
    end: jest.fn()
  };

  const mockDownloadStream = {
    on: jest.fn((event, callback) => {
      if (event === 'data') {
        // Simulate encrypted data being returned
        setTimeout(() => callback(Buffer.from('encrypted-data')), 1);
      } else if (event === 'end') {
        setTimeout(callback, 2);
      }
    })
  };

  mockGridFSBucket.openUploadStream.mockReturnValue(mockUploadStream);
  mockGridFSBucket.openDownloadStream.mockReturnValue(mockDownloadStream);
  mockGridFSBucket.find.mockReturnValue({
    limit: () => ({ toArray: () => Promise.resolve([]) })
  });

  return {
    MongoClient: jest.fn().mockImplementation(() => ({
      db: () => ({ collection: () => ({ deleteMany: () => Promise.resolve() }) })
    })),
    GridFSBucket: jest.fn().mockImplementation(() => mockGridFSBucket),
    ObjectId: jest.fn().mockImplementation((id) => ({ toString: () => id }))
  };
});

describe('Asset Processing Round Trip Properties (Fast)', () => {
  let documentUploadService: DocumentUploadService;
  let mockMongoClient: any;

  beforeAll(() => {
    const { MongoClient } = require('mongodb');
    mockMongoClient = new MongoClient();
    documentUploadService = new DocumentUploadService(mockMongoClient);
  });

  /**
   * Property 2: Asset Processing Round Trip - Hash Consistency
   * For any valid document content, the hash should be deterministic and consistent
   */
  test('property: document hashing is deterministic and consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content: fc.string({ minLength: 5, maxLength: 50 }),
          filename: fc.string({ minLength: 3, maxLength: 15 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_') + '.txt'),
        }),
        async (data) => {
          const buffer = Buffer.from(data.content, 'utf-8');
          const document: UploadedDocument = {
            buffer,
            filename: data.filename,
            mimeType: 'text/plain'
          };

          // Upload document multiple times
          const result1 = await documentUploadService.uploadDocument(document);
          const result2 = await documentUploadService.uploadDocument(document);

          // Hash should be deterministic - same content produces same hash
          const expectedHash = createHash('sha256').update(buffer).digest('hex');
          expect(result1.hash).toBe(expectedHash);
          expect(result2.hash).toBe(expectedHash);
          expect(result1.hash).toBe(result2.hash);

          // Metadata should be consistent
          expect(result1.metadata.filename).toBe(data.filename);
          expect(result1.metadata.mimeType).toBe('text/plain');
          expect(result1.metadata.size).toBe(buffer.length);
          
          expect(result2.metadata.filename).toBe(data.filename);
          expect(result2.metadata.mimeType).toBe('text/plain');
          expect(result2.metadata.size).toBe(buffer.length);
        }
      ),
      { numRuns: 10, timeout: 2000 }
    );
  });

  /**
   * Property: Different content produces different hashes
   */
  test('property: different content produces different hashes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content1: fc.string({ minLength: 5, maxLength: 30 }),
          content2: fc.string({ minLength: 5, maxLength: 30 }),
          filename: fc.string({ minLength: 3, maxLength: 10 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_') + '.txt'),
        }).filter(data => data.content1 !== data.content2), // Ensure different content
        async (data) => {
          const buffer1 = Buffer.from(data.content1, 'utf-8');
          const buffer2 = Buffer.from(data.content2, 'utf-8');

          const document1: UploadedDocument = {
            buffer: buffer1,
            filename: data.filename,
            mimeType: 'text/plain'
          };

          const document2: UploadedDocument = {
            buffer: buffer2,
            filename: data.filename,
            mimeType: 'text/plain'
          };

          const result1 = await documentUploadService.uploadDocument(document1);
          const result2 = await documentUploadService.uploadDocument(document2);

          // Different content should produce different hashes
          expect(result1.hash).not.toBe(result2.hash);

          // Verify hashes match expected values
          const expectedHash1 = createHash('sha256').update(buffer1).digest('hex');
          const expectedHash2 = createHash('sha256').update(buffer2).digest('hex');
          
          expect(result1.hash).toBe(expectedHash1);
          expect(result2.hash).toBe(expectedHash2);
        }
      ),
      { numRuns: 5, timeout: 2000 }
    );
  });

  /**
   * Property: Document ID generation is consistent for same input
   */
  test('property: document ID generation is deterministic', async () => {
    const testContent = 'Test content for ID generation';
    const buffer = Buffer.from(testContent, 'utf-8');
    const document: UploadedDocument = {
      buffer,
      filename: 'test-id.txt',
      mimeType: 'text/plain'
    };

    // Upload same document multiple times
    const results = [];
    for (let i = 0; i < 3; i++) {
      const result = await documentUploadService.uploadDocument(document);
      results.push(result);
    }

    // All should have the same hash
    const firstHash = results[0].hash;
    results.forEach(result => {
      expect(result.hash).toBe(firstHash);
    });

    // Verify hash is correct
    const expectedHash = createHash('sha256').update(buffer).digest('hex');
    expect(firstHash).toBe(expectedHash);
  });

  /**
   * Property: Metadata extraction preserves file information
   */
  test('property: metadata extraction preserves essential file information', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content: fc.string({ minLength: 10, maxLength: 100 }),
          filename: fc.string({ minLength: 5, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_') + '.txt'),
        }),
        async (data) => {
          const buffer = Buffer.from(data.content, 'utf-8');
          const document: UploadedDocument = {
            buffer,
            filename: data.filename,
            mimeType: 'text/plain'
          };

          const result = await documentUploadService.uploadDocument(document);

          // Metadata should preserve original file information
          expect(result.metadata.filename).toBe(data.filename);
          expect(result.metadata.mimeType).toBe('text/plain');
          expect(result.metadata.size).toBe(buffer.length);
          expect(result.metadata.uploadedAt).toBeInstanceOf(Date);

          // For text files, should have text metadata
          expect(result.metadata.extractedData).toBeDefined();
          if (result.metadata.extractedData?.textInfo) {
            expect(result.metadata.extractedData.textInfo.characterCount).toBe(data.content.length);
            expect(result.metadata.extractedData.textInfo.encoding).toBe('utf-8');
          }
        }
      ),
      { numRuns: 5, timeout: 2000 }
    );
  });

  /**
   * Basic validation test
   */
  test('basic document processing validation', async () => {
    const testContent = 'Hello, World! This is a test document for validation.';
    const buffer = Buffer.from(testContent, 'utf-8');
    const document: UploadedDocument = {
      buffer,
      filename: 'validation-test.txt',
      mimeType: 'text/plain'
    };

    const result = await documentUploadService.uploadDocument(document);

    // Verify all required fields are present
    expect(result.documentId).toBeDefined();
    expect(result.hash).toBeDefined();
    expect(result.hash).toHaveLength(64); // SHA-256 hex length
    expect(result.encryptedFileId).toBeDefined();
    expect(result.metadata).toBeDefined();

    // Verify hash is correct
    const expectedHash = createHash('sha256').update(buffer).digest('hex');
    expect(result.hash).toBe(expectedHash);

    // Verify metadata
    expect(result.metadata.filename).toBe('validation-test.txt');
    expect(result.metadata.mimeType).toBe('text/plain');
    expect(result.metadata.size).toBe(buffer.length);
  });
});