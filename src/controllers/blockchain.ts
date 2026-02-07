import { Router, Response } from 'express';
import Joi from 'joi';
import { asyncHandler, CustomError } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../middleware/auth-middleware';
import { SuiService } from '../services/blockchain/sui-service';
import { ApiResponse } from '../types/api';

const router = Router();

// Initialize blockchain services
const suiService = new SuiService();

// Validation schemas
const deployTransactionSchema = Joi.object({
  blockchain: Joi.string().valid('sui').required(),
  contractHash: Joi.string().required(),
  entryPoint: Joi.string().required(),
  args: Joi.object().required(),
  paymentAmount: Joi.string().optional(),
});

const createAssetSchema = Joi.object({
  blockchain: Joi.string().valid('sui').required(),
  name: Joi.string().required(),
  description: Joi.string().required(),
  imageUrl: Joi.string().uri().optional(),
  attributes: Joi.object().optional(),
});

const transferAssetSchema = Joi.object({
  blockchain: Joi.string().valid('sui').required(),
  tokenId: Joi.string().required(),
  toAddress: Joi.string().required(),
});

/**
 * Get account balance for specified blockchain
 */
router.get('/balance/:blockchain/:address', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { blockchain, address } = req.params;
  
  if (!['sui'].includes(blockchain)) {
    throw new CustomError('Unsupported blockchain', 400);
  }

  const balance = await suiService.getAccountBalance(address);

  const response: ApiResponse<{ balance: string; blockchain: string; address: string }> = {
    success: true,
    data: {
      balance,
      blockchain,
      address,
    },
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

/**
 * Deploy transaction to blockchain
 */
router.post('/deploy', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  const { error, value } = deployTransactionSchema.validate(req.body);
  
  if (error) {
    throw new CustomError('Invalid request data', 400);
  }

  const { blockchain } = value;
  
  // Note: In production, private keys should never be sent to the backend
  // This would use a secure key management system or hardware security modules
  const privateKey = req.body.privateKey; // This is for demo purposes only
  
  if (!privateKey) {
    throw new CustomError('Private key required for transaction signing', 400);
  }

  if (blockchain === 'sui') {
    // Implement Sui transaction deployment
    throw new CustomError('Sui transaction deployment not implemented yet', 501);
  } else {
    throw new CustomError('Unsupported blockchain', 400);
  }
}));

/**
 * Create asset token on blockchain
 */
router.post('/assets', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  const { error, value } = createAssetSchema.validate(req.body);
  
  if (error) {
    throw new CustomError('Invalid request data', 400);
  }

  const { blockchain, name, description, imageUrl, attributes } = value;
  
  // Note: In production, private keys should never be sent to the backend
  const privateKey = req.body.privateKey;
  
  if (!privateKey) {
    throw new CustomError('Private key required for transaction signing', 400);
  }

  let result;
  
  if (blockchain === 'sui') {
    result = await suiService.createAssetNFT(
      req.user.address,
      { name, description, imageUrl: imageUrl || '', attributes: attributes || {} }
    );
  } else {
    throw new CustomError('Unsupported blockchain', 400);
  }

  const response: ApiResponse<typeof result> = {
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  };

  res.status(201).json(response);
}));

/**
 * Transfer asset token
 */
router.post('/assets/transfer', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  const { error, value } = transferAssetSchema.validate(req.body);
  
  if (error) {
    throw new CustomError('Invalid request data', 400);
  }

  const { blockchain, tokenId, toAddress } = value;
  
  // Note: In production, private keys should never be sent to the backend
  const privateKey = req.body.privateKey;
  
  if (!privateKey) {
    throw new CustomError('Private key required for transaction signing', 400);
  }

  let result;
  
  if (blockchain === 'sui') {
    result = await suiService.transferAssetNFT(
      req.user.address,
      tokenId,
      toAddress
    );
  } else {
    throw new CustomError('Unsupported blockchain', 400);
  }

  const response: ApiResponse<typeof result> = {
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

/**
 * Lock asset for collateral
 */
router.post('/assets/:tokenId/lock', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  const { tokenId } = req.params;
  
  const schema = Joi.object({
    blockchain: Joi.string().valid('sui').required(),
    loanId: Joi.string().required(),
    privateKey: Joi.string().required(),
  });

  const { error, value } = schema.validate(req.body);
  
  if (error) {
    throw new CustomError('Invalid request data', 400);
  }

  const { blockchain, loanId, privateKey } = value;

  let result;
  
  if (blockchain === 'sui') {
    result = await suiService.lockAssetForCollateral(
      req.user.address,
      tokenId,
      loanId
    );
  } else {
    throw new CustomError('Unsupported blockchain', 400);
  }

  const response: ApiResponse<typeof result> = {
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

/**
 * Unlock asset from collateral
 */
router.post('/assets/:tokenId/unlock', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new CustomError('Authentication required', 401);
  }

  const { tokenId } = req.params;
  
  const schema = Joi.object({
    blockchain: Joi.string().valid('sui').required(),
    privateKey: Joi.string().required(),
  });

  const { error, value } = schema.validate(req.body);
  
  if (error) {
    throw new CustomError('Invalid request data', 400);
  }

  const { blockchain, privateKey } = value;

  let result;
  
  if (blockchain === 'sui') {
    result = await suiService.unlockAssetFromCollateral(
      req.user.address,
      tokenId
    );
  } else {
    throw new CustomError('Unsupported blockchain', 400);
  }

  const response: ApiResponse<typeof result> = {
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

/**
 * Get transaction status
 */
router.get('/transactions/:blockchain/:hash', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { blockchain, hash } = req.params;
  
  if (!['sui'].includes(blockchain)) {
    throw new CustomError('Unsupported blockchain', 400);
  }

  const status = await suiService.getTransactionStatus(hash);

  const response: ApiResponse<typeof status> = {
    success: true,
    data: status,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

/**
 * Get network information
 */
router.get('/network/:blockchain', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { blockchain } = req.params;
  
  if (!['sui'].includes(blockchain)) {
    throw new CustomError('Unsupported blockchain', 400);
  }

  const networkInfo = await suiService.getNetworkInfo();

  const response: ApiResponse<typeof networkInfo> = {
    success: true,
    data: networkInfo,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

export default router;