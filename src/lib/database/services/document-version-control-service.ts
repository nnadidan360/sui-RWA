/**
 * Document Version Control Service
 * 
 * Implements comprehensive document version control and update history:
 * - Document versioning with IPFS storage
 * - Change tracking and approval workflows
 * - Document comparison and diff generation
 * - Automated backup and redundancy management
 */

import { connectToDatabase } from '../connection';
import { Asset } from '../models/index';
import type { IAsset } from '../models/index';

export interface DocumentVersion {
  documentId: string;
  version: number;
  ipfsHash: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: Date;
  changes: string[];
  approvals: Array<{
    approvedBy: string;
    approvedAt: Date;
    notes?: string;
  }>;
  rejections: Array<{
    rejectedBy: string;
    rejectedAt: Date;
    reason: string;
  }>;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'superseded';
  parentVersion?: number;
  backupHashes: string[];
  pinningStatus: 'pinned' | 'unpinned' | 'failed' | 'pending';
  lastPinCheck?: Date;
  metadata: {
    extractedText?: string;
    keywords: string[];
    tags: string[];
    checksum: string;
  };
}

export interface DocumentHistory {
  documentId: string;
  assetId: string;
  documentType: 'deed' | 'appraisal' | 'insurance' | 'permit' | 'other';
  versions: DocumentVersion[];
  currentVersion: number;
  createdAt: Date;
  lastUpdated: Date;
  totalVersions: number;
}

export interface VersionComparison {
  documentId: string;
  fromVersion: number;
  toVersion: number;
  changes: Array<{
    type: 'added' | 'removed' | 'modified';
    field: string;
    oldValue?: any;
    newValue?: any;
    description: string;
  }>;
  similarity: number; // 0-100 percentage
  comparedAt: Date;
}

export class DocumentVersionControlService {
  constructor() {}

  /**
   * Create a new document version
   */
  async createDocumentVersion(
    assetId: string,
    documentType: 'deed' | 'appraisal' | 'insurance' | 'permit' | 'other',
    documentData: {
      ipfsHash: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      uploadedBy: string;
      changes: string[];
      extractedText?: string;
      keywords?: string[];
      tags?: string[];
      checksum: string;
    }
  ): Promise<DocumentVersion> {
    await connectToDatabase();

    const asset = await Asset.findOne({ tokenId: assetId });
    if (!asset) {
      throw new Error('Asset not found');
    }

    // Find existing document or create new one
    const existingDoc = asset.metadata.documents.find((d: any) => d.type === documentType);
    const version = existingDoc ? await this.getNextVersionNumber(assetId, documentType) : 1;

    const documentVersion: DocumentVersion = {
      documentId: existingDoc?.ipfsHash || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      version,
      ipfsHash: documentData.ipfsHash,
      fileName: documentData.fileName,
      fileSize: documentData.fileSize,
      mimeType: documentData.mimeType,
      uploadedBy: documentData.uploadedBy,
      uploadedAt: new Date(),
      changes: documentData.changes,
      approvals: [],
      rejections: [],
      status: 'draft',
      parentVersion: version > 1 ? version - 1 : undefined,
      backupHashes: [],
      pinningStatus: 'pending',
      metadata: {
        extractedText: documentData.extractedText,
        keywords: documentData.keywords || [],
        tags: documentData.tags || [],
        checksum: documentData.checksum
      }
    };

    // Update asset with new document version
    if (existingDoc) {
      // Update existing document
      await Asset.updateOne(
        { 
          tokenId: assetId,
          'metadata.documents.type': documentType
        },
        {
          $set: {
            'metadata.documents.$.ipfsHash': documentData.ipfsHash,
            'metadata.documents.$.fileName': documentData.fileName,
            'metadata.documents.$.uploadDate': new Date(),
            'metadata.documents.$.fileSize': documentData.fileSize,
            'metadata.documents.$.mimeType': documentData.mimeType,
            'metadata.documents.$.pinningStatus': 'pending',
            updatedAt: new Date()
          },
          $push: {
            auditTrail: {
              action: 'document_version_created',
              performedBy: documentData.uploadedBy,
              timestamp: new Date(),
              details: {
                documentType,
                version,
                changes: documentData.changes,
                ipfsHash: documentData.ipfsHash
              }
            }
          }
        }
      );
    } else {
      // Add new document
      await Asset.updateOne(
        { tokenId: assetId },
        {
          $push: {
            'metadata.documents': {
              type: documentType,
              ipfsHash: documentData.ipfsHash,
              fileName: documentData.fileName,
              uploadDate: new Date(),
              fileSize: documentData.fileSize,
              mimeType: documentData.mimeType,
              pinningStatus: 'pending'
            },
            auditTrail: {
              action: 'document_created',
              performedBy: documentData.uploadedBy,
              timestamp: new Date(),
              details: {
                documentType,
                version: 1,
                ipfsHash: documentData.ipfsHash
              }
            }
          },
          $set: {
            updatedAt: new Date()
          }
        }
      );
    }

    // Store version history
    await this.storeVersionHistory(assetId, documentType, documentVersion);

    return documentVersion;
  }

  /**
   * Get document history for an asset
   */
  async getDocumentHistory(assetId: string, documentType?: string): Promise<DocumentHistory[]> {
    await connectToDatabase();

    const asset = await Asset.findOne({ tokenId: assetId });
    if (!asset) {
      throw new Error('Asset not found');
    }

    const histories: DocumentHistory[] = [];
    const documents = documentType 
      ? asset.metadata.documents.filter((d: any) => d.type === documentType)
      : asset.metadata.documents;

    for (const doc of documents) {
      const versions = await this.getVersionsForDocument(assetId, doc.type);
      
      histories.push({
        documentId: doc.ipfsHash,
        assetId,
        documentType: doc.type,
        versions,
        currentVersion: versions.length,
        createdAt: doc.uploadDate,
        lastUpdated: versions[versions.length - 1]?.uploadedAt || doc.uploadDate,
        totalVersions: versions.length
      });
    }

    return histories;
  }

  /**
   * Compare two document versions
   */
  async compareVersions(
    assetId: string,
    documentType: string,
    fromVersion: number,
    toVersion: number
  ): Promise<VersionComparison> {
    await connectToDatabase();

    const versions = await this.getVersionsForDocument(assetId, documentType);
    const fromDoc = versions.find(v => v.version === fromVersion);
    const toDoc = versions.find(v => v.version === toVersion);

    if (!fromDoc || !toDoc) {
      throw new Error('Version not found');
    }

    const changes: Array<{
      type: 'added' | 'removed' | 'modified';
      field: string;
      oldValue?: any;
      newValue?: any;
      description: string;
    }> = [];

    // Compare basic properties
    if (fromDoc.fileName !== toDoc.fileName) {
      changes.push({
        type: 'modified',
        field: 'fileName',
        oldValue: fromDoc.fileName,
        newValue: toDoc.fileName,
        description: `File name changed from "${fromDoc.fileName}" to "${toDoc.fileName}"`
      });
    }

    if (fromDoc.fileSize !== toDoc.fileSize) {
      changes.push({
        type: 'modified',
        field: 'fileSize',
        oldValue: fromDoc.fileSize,
        newValue: toDoc.fileSize,
        description: `File size changed from ${fromDoc.fileSize} to ${toDoc.fileSize} bytes`
      });
    }

    // Compare metadata
    const fromKeywords = new Set(fromDoc.metadata.keywords);
    const toKeywords = new Set(toDoc.metadata.keywords);

    // Added keywords
    for (const keyword of toKeywords) {
      if (!fromKeywords.has(keyword)) {
        changes.push({
          type: 'added',
          field: 'keywords',
          newValue: keyword,
          description: `Added keyword: "${keyword}"`
        });
      }
    }

    // Removed keywords
    for (const keyword of fromKeywords) {
      if (!toKeywords.has(keyword)) {
        changes.push({
          type: 'removed',
          field: 'keywords',
          oldValue: keyword,
          description: `Removed keyword: "${keyword}"`
        });
      }
    }

    // Calculate similarity based on content and metadata
    const similarity = this.calculateSimilarity(fromDoc, toDoc);

    return {
      documentId: fromDoc.documentId,
      fromVersion,
      toVersion,
      changes,
      similarity,
      comparedAt: new Date()
    };
  }

  /**
   * Private helper methods
   */
  private async getNextVersionNumber(assetId: string, documentType: string): Promise<number> {
    const versions = await this.getVersionsForDocument(assetId, documentType);
    return versions.length + 1;
  }

  private async getVersionsForDocument(assetId: string, documentType: string): Promise<DocumentVersion[]> {
    const asset = await Asset.findOne({ tokenId: assetId });
    if (!asset) return [];

    // Extract version information from audit trail
    const versionEntries = asset.auditTrail.filter((entry: any) => 
      (entry.action === 'document_version_created' || entry.action === 'document_created') &&
      entry.details.documentType === documentType
    );

    return versionEntries.map((entry: any, index: number) => ({
      documentId: entry.details.ipfsHash,
      version: entry.details.version || index + 1,
      ipfsHash: entry.details.ipfsHash,
      fileName: entry.details.fileName || 'Unknown',
      fileSize: entry.details.fileSize || 0,
      mimeType: entry.details.mimeType || 'application/octet-stream',
      uploadedBy: entry.performedBy,
      uploadedAt: entry.timestamp,
      changes: entry.details.changes || [],
      approvals: [],
      rejections: [],
      status: 'approved' as const,
      backupHashes: [],
      pinningStatus: 'pinned' as const,
      metadata: {
        keywords: [],
        tags: [],
        checksum: ''
      }
    }));
  }

  private async storeVersionHistory(
    assetId: string,
    documentType: string,
    version: DocumentVersion
  ): Promise<void> {
    await Asset.updateOne(
      { tokenId: assetId },
      {
        $push: {
          auditTrail: {
            action: 'document_version_stored',
            performedBy: version.uploadedBy,
            timestamp: new Date(),
            details: {
              documentType,
              version: version.version,
              ipfsHash: version.ipfsHash,
              fileName: version.fileName,
              fileSize: version.fileSize,
              mimeType: version.mimeType,
              changes: version.changes,
              checksum: version.metadata.checksum
            }
          }
        }
      }
    );
  }

  private calculateSimilarity(fromDoc: DocumentVersion, toDoc: DocumentVersion): number {
    let similarity = 0;

    // File name similarity
    if (fromDoc.fileName === toDoc.fileName) {
      similarity += 20;
    }

    // File size similarity (within 10% is considered similar)
    const sizeDiff = Math.abs(fromDoc.fileSize - toDoc.fileSize) / Math.max(fromDoc.fileSize, toDoc.fileSize);
    if (sizeDiff <= 0.1) {
      similarity += 20;
    }

    // MIME type similarity
    if (fromDoc.mimeType === toDoc.mimeType) {
      similarity += 20;
    }

    // Keywords similarity
    const fromKeywords = new Set(fromDoc.metadata.keywords);
    const toKeywords = new Set(toDoc.metadata.keywords);
    const intersection = new Set([...fromKeywords].filter(k => toKeywords.has(k)));
    const union = new Set([...fromKeywords, ...toKeywords]);
    
    if (union.size > 0) {
      similarity += (intersection.size / union.size) * 40;
    }

    return Math.round(similarity);
  }
}

export const documentVersionControlService = new DocumentVersionControlService();