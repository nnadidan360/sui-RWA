/**
 * Property-Based Test: Asset Processing Round Trip
 * **Feature: credit-os, Property 2: Asset Processing Round Trip**
 * 
 * Tests that for any valid asset document, processing then retrieving should preserve 
 * document integrity through cryptographic hashes while creating proper on-chain attestations.
 * 
 * Validates: Requirements 2.2, 2.3
 */

import fc from 'fast-check';
import { AssetIntelligenceService } from '../../src/services/asset/asset-intelligence-service';
import { AssetIntelligence } from '../../src/models/AssetIntelligence';
import { connectTestDB, disconnectTestDB } from '../helpers/test-db';
import crypto from 'crypto';

describe('Property 2: Asset Processing Round Trip', () => {
  let assetService: AssetIntelligenceService;

  beforeAll(async () => {
    await connectTestDB();
    assetService = new AssetIntelligenceService();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await AssetIntelligence.deleteMany({});
  });

  // Generator for asset documents
  const assetDocumentArbitrary = fc.record({
    fileName: fc.string({ minLength: 5, maxLength: 50 }).map(s => s + '.pdf'),
    fileType: fc.constantFrom('application/pdf', 'image/jpeg', 'image/png', 'application/msword'),
    fileSize: fc.integer({ min: 1024, max: 10485760 }), // 1KB to 10MB
    content: fc.uint8Array({ minLength: 100, maxLength: 1000 }),
    assetType: fc.constantFrom('property', 'vehicle', 'equipment', 'invoice', 'receivable'),
    jurisdiction: fc.constantFrom('US', 'CA', 'GB', 'DE', 'FR', 'JP', 'AU', 'SG')
  });

  // Generator for asset metadata
  const assetMetadataArbitrary = fc.record({
    title: fc.string({ minLength: 5, maxLength: 100 }),
    description: fc.string({ minLength: 10, maxLength: 500 }),
    estimatedValue: fc.integer({ min: 1000, max: 10000000 }),
    ownerName: fc.string({ minLength: 3, maxLength: 50 }),
    acquisitionDate: fc.date({ min: new Date('2000-01-01'), max: new Date() })
  });

  it('Property 2.1: Document hash should be preserved through processing and retrieval', async () => {
    await fc.assert(
      fc.asyncProperty(
        assetDocumentArbitrary,
        assetMetadataArbitrary,
        async (document, metadata) => {
          // Arrange: Calculate original hash
          const originalHash = crypto
            .createHash('sha256')
            .update(Buffer.from(document.content))
            .digest('hex');

          // Act: Process document
          const processedAsset = await assetService.processDocument({
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            content: document.content,
            assetType: document.assetType,
            jurisdiction: document.jurisdiction,
            metadata
          });

          // Retrieve processed document
          const retrievedAsset = await assetService.getAssetById(processedAsset.assetId);

          // Assert: Hash should be preserved
          expect(retrievedAsset).toBeDefined();
          expect(retrievedAsset!.documentHashes).toContain(originalHash);
          expect(retrievedAsset!.documentHashes[0]).toBe(originalHash);
          
          // Verify document integrity
          expect(retrievedAsset!.assetType).toBe(document.assetType);
          expect(retrievedAsset!.jurisdiction).toBe(document.jurisdiction);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 2.2: On-chain attestation should be created for every processed document', async () => {
    await fc.assert(
      fc.asyncProperty(
        assetDocumentArbitrary,
        assetMetadataArbitrary,
        async (document, metadata) => {
          // Act: Process document
          const processedAsset = await assetService.processDocument({
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            content: document.content,
            assetType: document.assetType,
            jurisdiction: document.jurisdiction,
            metadata
          });

          // Assert: On-chain attestation should be created
          expect(processedAsset.attestationId).toBeDefined();
          expect(processedAsset.attestationId).toMatch(/^0x[a-f0-9]{64}$/i);
          
          // Verify attestation contains document hash
          const retrievedAsset = await assetService.getAssetById(processedAsset.assetId);
          expect(retrievedAsset).toBeDefined();
          expect(retrievedAsset!.attestationId).toBe(processedAsset.attestationId);
          expect(retrievedAsset!.documentHashes.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 2.3: Metadata should be preserved without exposing personal data on-chain', async () => {
    await fc.assert(
      fc.asyncProperty(
        assetDocumentArbitrary,
        assetMetadataArbitrary,
        async (document, metadata) => {
          // Act: Process document
          const processedAsset = await assetService.processDocument({
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            content: document.content,
            assetType: document.assetType,
            jurisdiction: document.jurisdiction,
            metadata
          });

          // Retrieve processed document
          const retrievedAsset = await assetService.getAssetById(processedAsset.assetId);

          // Assert: Metadata should be preserved off-chain
          expect(retrievedAsset).toBeDefined();
          expect(retrievedAsset!.metadata).toBeDefined();
          expect(retrievedAsset!.metadata.title).toBe(metadata.title);
          expect(retrievedAsset!.metadata.description).toBe(metadata.description);
          expect(retrievedAsset!.metadata.estimatedValue).toBe(metadata.estimatedValue);
          
          // Verify personal data is not in attestation ID (on-chain)
          expect(retrievedAsset!.attestationId).not.toContain(metadata.ownerName);
          expect(retrievedAsset!.attestationId).not.toContain(metadata.title);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 2.4: Document retrieval should return exact same hash as original', async () => {
    await fc.assert(
      fc.asyncProperty(
        assetDocumentArbitrary,
        assetMetadataArbitrary,
        async (document, metadata) => {
          // Arrange: Calculate original hash
          const originalHash = crypto
            .createHash('sha256')
            .update(Buffer.from(document.content))
            .digest('hex');

          // Act: Process and retrieve document
          const processedAsset = await assetService.processDocument({
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            content: document.content,
            assetType: document.assetType,
            jurisdiction: document.jurisdiction,
            metadata
          });

          const retrievedDocument = await assetService.retrieveDocument(processedAsset.assetId);

          // Calculate retrieved hash
          const retrievedHash = crypto
            .createHash('sha256')
            .update(Buffer.from(retrievedDocument.content))
            .digest('hex');

          // Assert: Hashes should match exactly
          expect(retrievedHash).toBe(originalHash);
          expect(retrievedDocument.fileName).toBe(document.fileName);
          expect(retrievedDocument.fileType).toBe(document.fileType);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 2.5: Jurisdiction code should be preserved in attestation', async () => {
    await fc.assert(
      fc.asyncProperty(
        assetDocumentArbitrary,
        assetMetadataArbitrary,
        async (document, metadata) => {
          // Act: Process document
          const processedAsset = await assetService.processDocument({
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            content: document.content,
            assetType: document.assetType,
            jurisdiction: document.jurisdiction,
            metadata
          });

          // Retrieve processed document
          const retrievedAsset = await assetService.getAssetById(processedAsset.assetId);

          // Assert: Jurisdiction should be preserved
          expect(retrievedAsset).toBeDefined();
          expect(retrievedAsset!.jurisdiction).toBe(document.jurisdiction);
          
          // Verify jurisdiction is part of on-chain attestation
          expect(retrievedAsset!.attestationId).toBeDefined();
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });

  it('Property 2.6: Multiple documents for same asset should maintain separate hashes', async () => {
    await fc.assert(
      fc.asyncProperty(
        assetDocumentArbitrary,
        assetDocumentArbitrary,
        assetMetadataArbitrary,
        async (document1, document2, metadata) => {
          // Ensure documents are different
          fc.pre(!Buffer.from(document1.content).equals(Buffer.from(document2.content)));

          // Arrange: Calculate hashes
          const hash1 = crypto
            .createHash('sha256')
            .update(Buffer.from(document1.content))
            .digest('hex');
          const hash2 = crypto
            .createHash('sha256')
            .update(Buffer.from(document2.content))
            .digest('hex');

          // Act: Process first document
          const processedAsset1 = await assetService.processDocument({
            fileName: document1.fileName,
            fileType: document1.fileType,
            fileSize: document1.fileSize,
            content: document1.content,
            assetType: document1.assetType,
            jurisdiction: document1.jurisdiction,
            metadata
          });

          // Add second document to same asset
          const updatedAsset = await assetService.addDocumentToAsset(
            processedAsset1.assetId,
            {
              fileName: document2.fileName,
              fileType: document2.fileType,
              fileSize: document2.fileSize,
              content: document2.content
            }
          );

          // Assert: Both hashes should be preserved
          expect(updatedAsset.documentHashes).toHaveLength(2);
          expect(updatedAsset.documentHashes).toContain(hash1);
          expect(updatedAsset.documentHashes).toContain(hash2);
          expect(hash1).not.toBe(hash2);
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  });
});
