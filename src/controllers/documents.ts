/**
 * Document Upload Controller for Credit OS
 * 
 * Handles RWA document upload endpoints
 */

import { Request, Response } from 'express';
import { DocumentUploadService } from '../services/assets';
import { Asset } from '../models/Asset';
import { logger } from '../utils/logger';

const documentUploadService = new DocumentUploadService();

/**
 * Upload RWA document
 * POST /api/documents/upload
 */
export const uploadDocument = async (req: Request, res: Response) => {
  try {
    // In production, would use multer or similar for file upload
    const { buffer, fileName, mimeType, assetId, documentType } = req.body;
    const userId = (req as any).user?.internalUserId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    if (!buffer || !fileName || !mimeType || !assetId || !documentType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Convert base64 to buffer if needed
    const documentBuffer = Buffer.isBuffer(buffer) 
      ? buffer 
      : Buffer.from(buffer, 'base64');

    // Upload document
    const result = await documentUploadService.uploadDocument({
      buffer: documentBuffer,
      fileName,
      mimeType,
      userId,
      assetId,
      documentType
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        errors: result.errors
      });
    }

    // Update asset with document information
    await Asset.findOneAndUpdate(
      { tokenId: assetId, owner: userId },
      {
        $push: {
          'metadata.documents': {
            type: documentType,
            ipfsHash: result.ipfsHash,
            fileName,
            uploadDate: new Date(),
            pinningStatus: 'pending',
            fileSize: result.fileSize,
            mimeType
          },
          auditTrail: {
            action: 'document_uploaded',
            performedBy: userId,
            timestamp: new Date(),
            details: {
              documentType,
              fileName,
              sha256: result.sha256Hash
            }
          }
        }
      }
    );

    logger.info('Document upload completed', {
      userId,
      assetId,
      documentId: result.documentId
    });

    res.status(200).json({
      success: true,
      data: {
        documentId: result.documentId,
        sha256Hash: result.sha256Hash,
        ipfsHash: result.ipfsHash,
        fileSize: result.fileSize,
        metadata: result.metadata
      }
    });
  } catch (error: any) {
    logger.error('Document upload failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get document by ID
 * GET /api/documents/:documentId
 */
export const getDocument = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const userId = (req as any).user?.internalUserId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Get document metadata to verify ownership
    const metadata = await documentUploadService.getDocumentMetadata(documentId);

    if (metadata.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden'
      });
    }

    // Retrieve document
    const buffer = await documentUploadService.retrieveDocument(documentId);

    res.setHeader('Content-Type', metadata.mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error: any) {
    logger.error('Failed to retrieve document', {
      error: error.message,
      documentId: req.params.documentId
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Delete document
 * DELETE /api/documents/:documentId
 */
export const deleteDocument = async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const userId = (req as any).user?.internalUserId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Get document metadata to verify ownership
    const metadata = await documentUploadService.getDocumentMetadata(documentId);

    if (metadata.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden'
      });
    }

    // Delete document
    await documentUploadService.deleteDocument(documentId);

    // Update asset to remove document reference
    await Asset.findOneAndUpdate(
      { 
        tokenId: metadata.assetId,
        owner: userId 
      },
      {
        $pull: {
          'metadata.documents': { ipfsHash: metadata.ipfsHash }
        },
        $push: {
          auditTrail: {
            action: 'document_deleted',
            performedBy: userId,
            timestamp: new Date(),
            details: {
              documentId
            }
          }
        }
      }
    );

    logger.info('Document deleted', {
      userId,
      documentId
    });

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error: any) {
    logger.error('Failed to delete document', {
      error: error.message,
      documentId: req.params.documentId
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Check if document exists by hash
 * POST /api/documents/check-duplicate
 */
export const checkDuplicate = async (req: Request, res: Response) => {
  try {
    const { sha256Hash } = req.body;
    const userId = (req as any).user?.internalUserId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    if (!sha256Hash) {
      return res.status(400).json({
        success: false,
        error: 'SHA-256 hash is required'
      });
    }

    const exists = await documentUploadService.documentExists(sha256Hash, userId);

    res.status(200).json({
      success: true,
      data: {
        exists,
        sha256Hash
      }
    });
  } catch (error: any) {
    logger.error('Failed to check document duplicate', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
