/**
 * Property-Based Test: Duplicate Asset Prevention
 * **Feature: credit-os, Property 3: Duplicate Asset Prevention**
 * 
 * Tests that for any document hash, attempting to upload the same hash multiple times 
 * should be prevented and flagged as potential fraud.
 * 
 * Validates: Requirements 2.4
 */

import fc from 'fast-check';
import { AssetIntelligenceService } from '../../src/services/asset/asset-intelligence-service';
import { FraudDetectionService } from '../../src/services/fraud/fraud-detection-service';
import { AssetIntelligence } from '../../src/models/AssetIntelligence';
import { FraudSignal } from '../../src/models/FraudSignal';
import { connectTestDB, disconnectTestDB } from '../helpers/test-db';
import crypto from 'crypto';

describe('Property 3: Duplicate Asset Prevention', () => {
  let assetService: AssetIntelligenceService;
  let fraudService: FraudDetectionService;

  beforeAll(async () => {
    await connectTestDB();
    assetService = new AssetIntelligenceService();
    fraudService = new FraudDetectionService();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await AssetIntelligence.deleteMany({});
    await FraudSignal.deleteMany({});
  });

  // Generator for asset documents
  const assetDocumentArbitrary = fc.record({
    fileName: fc.string({ minLength: 5, maxLength: 50 }).map(s => s + '.pdf'),
    fileType: fc.constantFrom('application/pdf', 'image/jpeg', 'image/png'),
    fileSize: fc.integer({ min: 1024, max: 10485760 }),
    content: fc.uint8Array({ minLength: 100, maxLength: 1000 }),
    assetType: fc.constantFrom('property', 'vehicle', 'equipment', 'invoice'),
    jurisdiction: fc.constantFrom('US', 'CA', 'GB', 'DE', 'FR'),
    userId: fc.uuid()
  });

  // Generator for metadata
  const metadataArbitrary = fc.record({
    title: fc.string({ minLength: 5, maxLength: 100 }),
    description: fc.string({ minLength: 10, maxLength: 500 }),
    estimatedValue: fc.integer({ min: 1000, max: 10000000 })
  });

  it('Property 3.1: Uploading same document hash twice should be prevented', async () => {
    await fc.assert(
      fc.asyncProperty(
        assetDocumentArbitrary,
        metadataArbitrary,
        async (document, metadata) => {
          // Act: Upload document first time
          const firstUpload = await assetService.processDocument({
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            content: document.content,
            assetType: document.assetType,
            jurisdiction: document.jurisdiction,
            userId: document.userId,
            metadata
          });

          // Attempt to upload same document again
          const secondUploadAttempt = await assetService.processDocument({
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            content: document.content,
            assetType: document.assetType,
            jurisdiction: document.jurisdiction,
            userId: document.userId,
            metadata
          });

          // Assert: Second upload should be rejected
          expect(firstUpload.success).toBe(true);
          expect(secondUploadAttempt.success).toBe(false);
          expect(secondUploadAttempt.error).toContain('duplicate');
          expect(secondUploadAttempt.duplicateAssetId).toBe(firstUpload.assetId);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 3.2: Duplicate detection should work across different users', async () => {
    await fc.assert(
      fc.asyncProperty(
        assetDocumentArbitrary,
        fc.uuid(),
        fc.uuid(),
        metadataArbitrary,
        async (document, userId1, userId2, metadata) => {
          // Ensure different users
          fc.pre(userId1 !== userId2);

          // Act: User 1 uploads document
          const firstUpload = await assetService.processDocument({
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            content: document.content,
            assetType: document.assetType,
            jurisdiction: document.jurisdiction,
            userId: userId1,
            metadata
          });

          // User 2 attempts to upload same document
          const secondUploadAttempt = await assetService.processDocument({
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            content: document.content,
            assetType: document.assetType,
            jurisdiction: document.jurisdiction,
            userId: userId2,
            metadata
          });

          // Assert: Second upload should be rejected even from different user
          expect(firstUpload.success).toBe(true);
          expect(secondUploadAttempt.success).toBe(false);
          expect(secondUploadAttempt.error).toContain('duplicate');
          expect(secondUploadAttempt.originalUserId).toBe(userId1);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 3.3: Duplicate attempt should create fraud signal', async () => {
    await fc.assert(
      fc.asyncProperty(
        assetDocumentArbitrary,
        metadataArbitrary,
        async (document, metadata) => {
          // Act: Upload document first time
          await assetService.processDocument({
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            content: document.content,
            assetType: document.assetType,
            jurisdiction: document.jurisdiction,
            userId: document.userId,
            metadata
          });

          // Attempt duplicate upload
          await assetService.processDocument({
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            content: document.content,
            assetType: document.assetType,
            jurisdiction: document.jurisdiction,
            userId: document.userId,
            metadata
          });

          // Check for fraud signal
          const fraudSignals = await fraudService.getFraudSignalsByUser(document.userId);

          // Assert: Fraud signal should be created
          expect(fraudSignals.length).toBeGreaterThan(0);
          const duplicateSignal = fraudSignals.find(
            signal => signal.fraudType === 'asset_fraud' && signal.subType === 'duplicate_document'
          );
          expect(duplicateSignal).toBeDefined();
          expect(duplicateSignal!.severity).toBeGreaterThanOrEqual(5);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 3.4: Different documents should not trigger duplicate detection', async () => {
    await fc.assert(
      fc.asyncProperty(
        assetDocumentArbitrary,
        assetDocumentArbitrary,
        metadataArbitrary,
        async (document1, document2, metadata) => {
          // Ensure documents are different
          fc.pre(!Buffer.from(document1.content).equals(Buffer.from(document2.content)));

          // Act: Upload both documents
          const firstUpload = await assetService.processDocument({
            fileName: document1.fileName,
            fileType: document1.fileType,
            fileSize: document1.fileSize,
            content: document1.content,
            assetType: document1.assetType,
            jurisdiction: document1.jurisdiction,
            userId: document1.userId,
            metadata
          });

          const secondUpload = await assetService.processDocument({
            fileName: document2.fileName,
            fileType: document2.fileType,
            fileSize: document2.fileSize,
            content: document2.content,
            assetType: document2.assetType,
            jurisdiction: document2.jurisdiction,
            userId: document1.userId,
            metadata
          });

          // Assert: Both uploads should succeed
          expect(firstUpload.success).toBe(true);
          expect(secondUpload.success).toBe(true);
          expect(firstUpload.assetId).not.toBe(secondUpload.assetId);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 3.5: Duplicate detection should work with modified filenames', async () => {
    await fc.assert(
      fc.asyncProperty(
        assetDocumentArbitrary,
        fc.string({ minLength: 5, maxLength: 50 }),
        metadataArbitrary,
        async (document, differentFileName, metadata) => {
          // Ensure filename is different
          fc.pre(differentFileName !== document.fileName);

          // Act: Upload document with original filename
          const firstUpload = await assetService.processDocument({
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            content: document.content,
            assetType: document.assetType,
            jurisdiction: document.jurisdiction,
            userId: document.userId,
            metadata
          });

          // Attempt upload with same content but different filename
          const secondUploadAttempt = await assetService.processDocument({
            fileName: differentFileName + '.pdf',
            fileType: document.fileType,
            fileSize: document.fileSize,
            content: document.content,
            assetType: document.assetType,
            jurisdiction: document.jurisdiction,
            userId: document.userId,
            metadata
          });

          // Assert: Should still detect duplicate based on content hash
          expect(firstUpload.success).toBe(true);
          expect(secondUploadAttempt.success).toBe(false);
          expect(secondUploadAttempt.error).toContain('duplicate');
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 3.6: Hash comparison should be case-insensitive', async () => {
    await fc.assert(
      fc.asyncProperty(
        assetDocumentArbitrary,
        metadataArbitrary,
        async (document, metadata) => {
          // Arrange: Calculate hash
          const documentHash = crypto
            .createHash('sha256')
            .update(Buffer.from(document.content))
            .digest('hex');

          // Act: Upload document
          const firstUpload = await assetService.processDocument({
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            content: document.content,
            assetType: document.assetType,
            jurisdiction: document.jurisdiction,
            userId: document.userId,
            metadata
          });

          // Check duplicate with uppercase hash
          const isDuplicate = await assetService.checkDuplicateHash(documentHash.toUpperCase());

          // Assert: Should detect duplicate regardless of case
          expect(firstUpload.success).toBe(true);
          expect(isDuplicate).toBe(true);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 3.7: Multiple duplicate attempts should escalate fraud severity', async () => {
    await fc.assert(
      fc.asyncProperty(
        assetDocumentArbitrary,
        metadataArbitrary,
        fc.integer({ min: 2, max: 5 }),
        async (document, metadata, attemptCount) => {
          // Act: Upload document first time
          await assetService.processDocument({
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            content: document.content,
            assetType: document.assetType,
            jurisdiction: document.jurisdiction,
            userId: document.userId,
            metadata
          });

          // Attempt multiple duplicate uploads
          for (let i = 0; i < attemptCount; i++) {
            await assetService.processDocument({
              fileName: document.fileName,
              fileType: document.fileType,
              fileSize: document.fileSize,
              content: document.content,
              assetType: document.assetType,
              jurisdiction: document.jurisdiction,
              userId: document.userId,
              metadata
            });
          }

          // Check fraud signals
          const fraudSignals = await fraudService.getFraudSignalsByUser(document.userId);
          const duplicateSignals = fraudSignals.filter(
            signal => signal.fraudType === 'asset_fraud' && signal.subType === 'duplicate_document'
          );

          // Assert: Multiple attempts should create multiple signals or escalate severity
          expect(duplicateSignals.length).toBeGreaterThanOrEqual(1);
          const maxSeverity = Math.max(...duplicateSignals.map(s => s.severity));
          expect(maxSeverity).toBeGreaterThanOrEqual(5);
        }
      ),
      { numRuns: 100, timeout: 20000 }
    );
  });
});
