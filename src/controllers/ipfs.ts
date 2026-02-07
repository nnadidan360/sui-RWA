import { Router, Response } from 'express';
import multer from 'multer';
import Joi from 'joi';
import { asyncHandler, CustomError } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../middleware/auth-middleware';
import { IPFSService } from '../services/ipfs/ipfs-service';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types/api';

const router = Router();

// Initialize IPFS service
const ipfsService = new IPFSService();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/json',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

/**
 * Upload file to IPFS
 */
router.post('/upload', upload.single('file'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  if (!req.file) {
    throw new CustomError('No file provided', 400);
  }

  try {
    const result = await ipfsService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    logger.info('File uploaded to IPFS', {
      userId: req.user.id,
      fileName: req.file.originalname,
      hash: result.hash,
      size: result.size
    });

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('File upload failed', {
      error: errorMessage,
      userId: req.user.id,
      fileName: req.file.originalname
    });
    throw error;
  }
}));

/**
 * Upload JSON data to IPFS
 */
router.post('/upload-json', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  const schema = Joi.object({
    data: Joi.object().required(),
    name: Joi.string().required(),
  });

  const { error, value } = schema.validate(req.body);
  
  if (error) {
    throw new CustomError('Invalid request data', 400);
  }

  try {
    const result = await ipfsService.uploadJSON(value.data, value.name);

    logger.info('JSON uploaded to IPFS', {
      userId: req.user.id,
      name: value.name,
      hash: result.hash,
      size: result.size
    });

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('JSON upload failed', {
      error: errorMessage,
      userId: req.user.id,
      name: value.name
    });
    throw error;
  }
}));

/**
 * Get file information from IPFS
 */
router.get('/info/:hash', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { hash } = req.params;

  if (!ipfsService.isValidHash(hash)) {
    throw new CustomError('Invalid IPFS hash format', 400);
  }

  try {
    const fileInfo = await ipfsService.getFileInfo(hash);

    const response: ApiResponse<typeof fileInfo> = {
      success: true,
      data: fileInfo,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get file info', {
      error: errorMessage,
      hash
    });
    throw error;
  }
}));

/**
 * Get IPFS gateway URL for a hash
 */
router.get('/gateway/:hash', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { hash } = req.params;

  if (!ipfsService.isValidHash(hash)) {
    throw new CustomError('Invalid IPFS hash format', 400);
  }

  const gatewayUrl = ipfsService.getGatewayUrl(hash);

  const response: ApiResponse<{ hash: string; gatewayUrl: string }> = {
    success: true,
    data: {
      hash,
      gatewayUrl,
    },
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

/**
 * List pinned files (admin only)
 */
router.get('/files', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new CustomError('Admin access required', 403);
  }

  const limit = parseInt(req.query.limit as string) || 10;
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    const result = await ipfsService.listPinnedFiles(limit, offset);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to list pinned files', {
      error: errorMessage,
      userId: req.user.id
    });
    throw error;
  }
}));

/**
 * Unpin file from IPFS (admin only)
 */
router.delete('/unpin/:hash', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new CustomError('Admin access required', 403);
  }

  const { hash } = req.params;

  if (!ipfsService.isValidHash(hash)) {
    throw new CustomError('Invalid IPFS hash format', 400);
  }

  try {
    const success = await ipfsService.unpinFile(hash);

    logger.info('File unpinned from IPFS', {
      userId: req.user.id,
      hash,
      success
    });

    const response: ApiResponse<{ success: boolean; hash: string }> = {
      success: true,
      data: {
        success,
        hash,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to unpin file', {
      error: errorMessage,
      userId: req.user.id,
      hash
    });
    throw error;
  }
}));

/**
 * Get IPFS service status
 */
router.get('/status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await ipfsService.getServiceStatus();

    const response: ApiResponse<typeof status> = {
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get IPFS service status', {
      error: errorMessage
    });
    throw error;
  }
}));

export default router;