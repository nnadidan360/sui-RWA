// PHASE 2: Asset Tokenization and Fractionalization
// API Routes for fractionalization endpoints

import { Router } from 'express';
import * as fractionalizationController from '../../controllers/phase2/fractionalization.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/phase2/assets/:assetId/fractionalize
 * @desc    Request fractionalization of an asset
 * @access  Private
 */
router.post(
  '/assets/:assetId/fractionalize',
  fractionalizationController.requestFractionalization
);

/**
 * @route   GET /api/phase2/tokens/:tokenId
 * @desc    Get fractional token details
 * @access  Private
 */
router.get(
  '/tokens/:tokenId',
  fractionalizationController.getFractionalToken
);

/**
 * @route   GET /api/phase2/tokens/user/:userId
 * @desc    Get all fractional tokens for a user
 * @access  Private
 */
router.get(
  '/tokens/user/:userId',
  fractionalizationController.getUserFractionalTokens
);

/**
 * @route   POST /api/phase2/tokens/:tokenId/enable-trading
 * @desc    Enable trading for a fractional token
 * @access  Private (Creator only)
 */
router.post(
  '/tokens/:tokenId/enable-trading',
  fractionalizationController.enableTrading
);

/**
 * @route   POST /api/phase2/tokens/:tokenId/transfer
 * @desc    Transfer fractional tokens between users
 * @access  Private
 */
router.post(
  '/tokens/:tokenId/transfer',
  fractionalizationController.transferTokens
);

/**
 * @route   GET /api/phase2/tokens/:tokenId/holders
 * @desc    Get token holders for a fractional token
 * @access  Private
 */
router.get(
  '/tokens/:tokenId/holders',
  fractionalizationController.getTokenHolders
);

export default router;
