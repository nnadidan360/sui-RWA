/**
 * Property-Based Tests for Duplicate Asset Prevention
 * 
 * **Feature: credit-os, Property 3: Duplicate Asset Prevention**
 * **Validates: Requirements 2.4**
 * 
 * These tests verify that the system correctly identifies and prevents
 * duplicate asset submissions using document hashes and similarity analysis.
 */

import fc from 'fast-check';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AssetIntelligenceService, AssetProcessingRequest } from '../../lib/assets/asset-intelligence-service';
import { SuiService } from '../../lib/blockchain/sui-service';
import { UploadedDocument } from '../../lib/assets/document-upload-service';
import { createHash } from 'crypto';

describe('Duplicate Asset Prevention Properties', () => {
  let mongoServer: MongoMemoryServer;
  let mongoClient: MongoClient;
  let assetIntelligenceService: AssetIntelligenceService;
  let mockSuiService: jest.Mocked<SuiService>;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();

    // Mock SuiService for testing
    mockSuiService = {
      executeTransaction: jest.fn(),
      getObject: jest.fn(),
      getObjectsOwnedByAddress: jest.fn(),
    } as any;

    assetIntelligenceService = new AssetIntelligenceService(mongoClient, mockSuiService);
  });

  afterAll(async () => {
    await mongoClient.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clean up all collections before each test
    const db = mongoClient.db();
    await db.collection('rwa_documents.files').deleteMany({});
    await db.collection('rwa_documents.chunks').deleteMany({});
    await db.collection('asset_intelligence_results').deleteMany({});
    
    // Reset mocks
    jest.clearAllMocks();
  });

  /**
   * Property 3: Duplicate Asset Prevention
   * For any document content, submitting the same content multiple times should be detected as duplicate
   */
  test('property: identical document content is always detected as duplicate', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content: fc.uint8Array({ minLength: 500, maxLength: 5000 }),
          assetType: fc.constantFrom('real_estate', 'vehicle', 'equipment', 'intellectual_property', 'other'),
          jurisdiction: fc.constantFrom('US', 'UK', 'CA'),
          userAccountId1: fc.string({ minLength: 10, maxLength: 20 }),
          userAccountId2: fc.string({ minLength: 10, maxLength: 20 }),
          filename1: fc.string({ minLength: 5, maxLength: 20 }).map(s => s + '.pdf'),
          filename2: fc.string({ minLength: 5, maxLength: 20 }).map(s => s + '.pdf'),
        }),
        async (data) => {
          const buffer = Buffer.from(data.content);
          const expectedHash = createHash('sha256').update(buffer).digest('hex');

          // Create first document submission
          const document1: UploadedDocument = {
            buffer,
            filename: data.filename1,
            mimeType: 'application/pdf'
          };

          const request1: AssetProcessingRequest = {
            document: document1,
            assetType: data.assetType,
            jurisdiction: data.jurisdiction,
            assetDescription: 'Test asset 1',
            userAccountId: data.userAccountId1,
            createAttestation: false
          };

          // Process first submission
          const result1 = await assetIntelligenceService.processAsset(request1);
          expect(result1.processingStatus).toBe('completed');
          expect(result1.uploadResult.hash).toBe(expectedHash);

          // Create second document submission with same content
          const document2: UploadedDocument = {
            buffer,
            filename: data.filename2,
            mimeType: 'application/pdf'
          };

          const request2: AssetProcessingRequest = {
            document: document2,
            assetType: data.assetType,
            jurisdiction: data.jurisdiction,
            assetDescription: 'Test asset 2',
            userAccountId: data.userAccountId2,
            createAttestation: false
          };

          // Process second submission
          const result2 = await assetIntelligenceService.processAsset(request2);

          // Both should have same hash
          expect(result2.uploadResult.hash).toBe(expectedHash);
          expect(result2.uploadResult.hash).toBe(result1.uploadResult.hash);

          // Check for duplicates using the service
          const duplicateCheck = await assetIntelligenceService.checkForDuplicates(
            expectedHash, 
            data.userAccountId2
          );

          // Should detect duplicate
          expect(duplicateCheck.isDuplicate).toBe(true);
          expect(duplicateCheck.existingAssets.length).toBeGreaterThan(0);
          expect(duplicateCheck.existingAssets[0].documentHash).toBe(expectedHash);
          expect(duplicateCheck.similarity).toBeGreaterThan(0);

          // Both submissions should be flagged in processing errors if duplicate detection is working
          if (result2.errors.length > 0) {
            expect(result2.errors.some(error => error.includes('Duplicate'))).toBe(true);
          }
        }
      ),
      { numRuns: 50, timeout: 30000 }
    );
  });

  /**
   * Property: Different content produces different hashes and no duplicates
   */
  test('property: different document content never produces false duplicate detection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content1: fc.uint8Array({ minLength: 500, maxLength: 3000 }),
          content2: fc.uint8Array({ minLength: 500, maxLength: 3000 }),
          assetType: fc.constantFrom('real_estate', 'vehicle', 'equipment'),
          jurisdiction: fc.constantFrom('US', 'UK', 'CA'),
          userAccountId: fc.string({ minLength: 10, maxLength: 20 }),
          filename1: fc.string({ minLength: 5, maxLength: 15 }).map(s => s + '1.pdf'),
          filename2: fc.string({ minLength: 5, maxLength: 15 }).map(s => s + '2.pdf'),
        }).filter(data => !Buffer.from(data.content1).equals(Buffer.from(data.content2))), // Ensure different content
        async (data) => {
          const buffer1 = Buffer.from(data.content1);
          const buffer2 = Buffer.from(data.content2);
          const hash1 = createHash('sha256').update(buffer1).digest('hex');
          const hash2 = createHash('sha256').update(buffer2).digest('hex');

          // Hashes should be different for different content
          expect(hash1).not.toBe(hash2);

          // Process first document
          const document1: UploadedDocument = {
            buffer: buffer1,
            filename: data.filename1,
            mimeType: 'application/pdf'
          };

          const request1: AssetProcessingRequest = {
            document: document1,
            assetType: data.assetType,
            jurisdiction: data.jurisdiction,
            assetDescription: 'Test asset 1',
            userAccountId: data.userAccountId,
            createAttestation: false
          };

          const result1 = await assetIntelligenceService.processAsset(request1);
          expect(result1.uploadResult.hash).toBe(hash1);

          // Process second document
          const document2: UploadedDocument = {
            buffer: buffer2,
            filename: data.filename2,
            mimeType: 'application/pdf'
          };

          const request2: AssetProcessingRequest = {
            document: document2,
            assetType: data.assetType,
            jurisdiction: data.jurisdiction,
            assetDescription: 'Test asset 2',
            userAccountId: data.userAccountId,
            createAttestation: false
          };

          const result2 = await assetIntelligenceService.processAsset(request2);
          expect(result2.uploadResult.hash).toBe(hash2);

          // Check for duplicates - should not find any
          const duplicateCheck = await assetIntelligenceService.checkForDuplicates(
            hash2,
            data.userAccountId
          );

          // Should not detect duplicate for different content
          expect(duplicateCheck.isDuplicate).toBe(false);
          expect(duplicateCheck.existingAssets.length).toBe(0);
          expect(duplicateCheck.similarity).toBe(0);
        }
      ),
      { numRuns: 50, timeout: 30000 }
    );
  });

  /**
   * Property: Duplicate detection works across different users
   */
  test('property: duplicate detection identifies same content across different users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content: fc.uint8Array({ minLength: 1000, maxLength: 4000 }),
          assetType: fc.constantFrom('real_estate', 'vehicle', 'equipment'),
          jurisdiction: fc.constantFrom('US', 'UK', 'CA'),
          userAccountId1: fc.string({ minLength: 10, maxLength: 20 }),
          userAccountId2: fc.string({ minLength: 10, maxLength: 20 }),
          filename: fc.string({ minLength: 5, maxLength: 15 }).map(s => s + '.pdf'),
        }).filter(data => data.userAccountId1 !== data.userAccountId2), // Ensure different users
        async (data) => {
          const buffer = Buffer.from(data.content);
          const expectedHash = createHash('sha256').update(buffer).digest('hex');

          // User 1 submits document
          const document1: UploadedDocument = {
            buffer,
            filename: data.filename,
            mimeType: 'application/pdf'
          };

          const request1: AssetProcessingRequest = {
            document: document1,
            assetType: data.assetType,
            jurisdiction: data.jurisdiction,
            assetDescription: 'Asset from user 1',
            userAccountId: data.userAccountId1,
            createAttestation: false
          };

          const result1 = await assetIntelligenceService.processAsset(request1);
          expect(result1.uploadResult.hash).toBe(expectedHash);

          // User 2 submits same document
          const document2: UploadedDocument = {
            buffer,
            filename: data.filename,
            mimeType: 'application/pdf'
          };

          const request2: AssetProcessingRequest = {
            document: document2,
            assetType: data.assetType,
            jurisdiction: data.jurisdiction,
            assetDescription: 'Asset from user 2',
            userAccountId: data.userAccountId2,
            createAttestation: false
          };

          const result2 = await assetIntelligenceService.processAsset(request2);
          expect(result2.uploadResult.hash).toBe(expectedHash);

          // Check for duplicates from user 2's perspective
          const duplicateCheck = await assetIntelligenceService.checkForDuplicates(
            expectedHash,
            data.userAccountId2
          );

          // Should detect duplicate even across different users
          expect(duplicateCheck.isDuplicate).toBe(true);
          expect(duplicateCheck.existingAssets.length).toBeGreaterThan(0);
          
          // Should find the asset from user 1
          const foundAsset = duplicateCheck.existingAssets.find(
            asset => asset.owner === data.userAccountId1
          );
          expect(foundAsset).toBeDefined();
          expect(foundAsset?.documentHash).toBe(expectedHash);
        }
      ),
      { numRuns: 30, timeout: 30000 }
    );
  });

  /**
   * Property: Hash-based duplicate detection is deterministic
   */
  test('property: duplicate detection results are consistent across multiple checks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content: fc.uint8Array({ minLength: 800, maxLength: 2000 }),
          assetType: fc.constantFrom('real_estate', 'vehicle'),
          jurisdiction: fc.constantFrom('US', 'UK'),
          userAccountId: fc.string({ minLength: 10, maxLength: 20 }),
          filename: fc.string({ minLength: 5, maxLength: 15 }).map(s => s + '.pdf'),
          checkCount: fc.integer({ min: 2, max: 5 })
        }),
        async (data) => {
          const buffer = Buffer.from(data.content);
          const expectedHash = createHash('sha256').update(buffer).digest('hex');

          // Submit document
          const document: UploadedDocument = {
            buffer,
            filename: data.filename,
            mimeType: 'application/pdf'
          };

          const request: AssetProcessingRequest = {
            document,
            assetType: data.assetType,
            jurisdiction: data.jurisdiction,
            assetDescription: 'Test asset for consistency',
            userAccountId: data.userAccountId,
            createAttestation: false
          };

          await assetIntelligenceService.processAsset(request);

          // Perform multiple duplicate checks
          const duplicateResults = [];
          for (let i = 0; i < data.checkCount; i++) {
            const duplicateCheck = await assetIntelligenceService.checkForDuplicates(
              expectedHash,
              data.userAccountId
            );
            duplicateResults.push(duplicateCheck);
          }

          // All results should be identical
          const firstResult = duplicateResults[0];
          for (let i = 1; i < duplicateResults.length; i++) {
            const currentResult = duplicateResults[i];
            
            expect(currentResult.isDuplicate).toBe(firstResult.isDuplicate);
            expect(currentResult.existingAssets.length).toBe(firstResult.existingAssets.length);
            expect(currentResult.similarity).toBe(firstResult.similarity);
            
            // Asset details should match
            for (let j = 0; j < currentResult.existingAssets.length; j++) {
              expect(currentResult.existingAssets[j].documentHash)
                .toBe(firstResult.existingAssets[j].documentHash);
              expect(currentResult.existingAssets[j].owner)
                .toBe(firstResult.existingAssets[j].owner);
            }
          }
        }
      ),
      { numRuns: 30, timeout: 30000 }
    );
  });

  /**
   * Property: Duplicate detection handles edge cases correctly
   */
  test('property: duplicate detection handles empty results and edge cases', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          nonExistentHash: fc.string({ minLength: 64, maxLength: 64 }).filter(s => /^[a-f0-9]{64}$/.test(s)),
          userAccountId: fc.string({ minLength: 10, maxLength: 20 })
        }),
        async (data) => {
          // Check for duplicates with a hash that doesn't exist
          const duplicateCheck = await assetIntelligenceService.checkForDuplicates(
            data.nonExistentHash,
            data.userAccountId
          );

          // Should not find duplicates for non-existent hash
          expect(duplicateCheck.isDuplicate).toBe(false);
          expect(duplicateCheck.existingAssets).toEqual([]);
          expect(duplicateCheck.similarity).toBe(0);
        }
      ),
      { numRuns: 50, timeout: 15000 }
    );
  });

  /**
   * Property: Multiple submissions of same content maintain referential integrity
   */
  test('property: multiple duplicate submissions maintain data consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content: fc.uint8Array({ minLength: 1000, maxLength: 3000 }),
          assetType: fc.constantFrom('real_estate', 'vehicle', 'equipment'),
          jurisdiction: fc.constantFrom('US', 'UK', 'CA'),
          userAccountId: fc.string({ minLength: 10, maxLength: 20 }),
          submissionCount: fc.integer({ min: 2, max: 4 })
        }),
        async (data) => {
          const buffer = Buffer.from(data.content);
          const expectedHash = createHash('sha256').update(buffer).digest('hex');
          const results = [];

          // Submit same document multiple times
          for (let i = 0; i < data.submissionCount; i++) {
            const document: UploadedDocument = {
              buffer,
              filename: `document_${i}.pdf`,
              mimeType: 'application/pdf'
            };

            const request: AssetProcessingRequest = {
              document,
              assetType: data.assetType,
              jurisdiction: data.jurisdiction,
              assetDescription: `Asset submission ${i}`,
              userAccountId: data.userAccountId,
              createAttestation: false
            };

            const result = await assetIntelligenceService.processAsset(request);
            results.push(result);
          }

          // All should have same hash
          results.forEach(result => {
            expect(result.uploadResult.hash).toBe(expectedHash);
          });

          // Check duplicate detection after all submissions
          const duplicateCheck = await assetIntelligenceService.checkForDuplicates(
            expectedHash,
            data.userAccountId
          );

          // Should detect duplicates
          expect(duplicateCheck.isDuplicate).toBe(true);
          expect(duplicateCheck.existingAssets.length).toBeGreaterThanOrEqual(1);
          
          // All found assets should have the same hash
          duplicateCheck.existingAssets.forEach(asset => {
            expect(asset.documentHash).toBe(expectedHash);
            expect(asset.owner).toBe(data.userAccountId);
          });
        }
      ),
      { numRuns: 20, timeout: 45000 }
    );
  });
});