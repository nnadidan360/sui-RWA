// PHASE 2: Asset Tokenization and Fractionalization
// Task 16 - Fractionalization Controller
// Handles fractional asset token creation and management

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth-middleware';
import { FractionalToken } from '../../models/phase2/FractionalToken';
import { Asset } from '../../models/Asset';
import { logger } from '../../utils/logger';

/**
 * Request fractionalization of an asset
 * POST /api/phase2/assets/:assetId/fractionalize
 */
export const requestFractionalization = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { assetId } = req.params;
    const { requestedSupply, requestedPrice, assetName, assetDescription } = req.body;
    const userId = req.user?.id;

    // Validate asset exists and user owns it
    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    if (asset.owner.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to fractionalize this asset' });
    }

    // Check if already fractionalized
    const existing = await FractionalToken.findOne({ originalAssetId: assetId });
    if (existing) {
      return res.status(400).json({ error: 'Asset already fractionalized' });
    }

    // Validate supply and price
    const MINIMUM_SUPPLY = 100;
    const MAXIMUM_SUPPLY = 10000000;
    const MINIMUM_VALUE = 10000; // $10,000

    if (requestedSupply < MINIMUM_SUPPLY || requestedSupply > MAXIMUM_SUPPLY) {
      return res.status(400).json({ 
        error: `Supply must be between ${MINIMUM_SUPPLY} and ${MAXIMUM_SUPPLY}` 
      });
    }

    const totalValue = requestedSupply * requestedPrice;
    if (totalValue < MINIMUM_VALUE) {
      return res.status(400).json({ 
        error: `Total asset value must be at least $${MINIMUM_VALUE}` 
      });
    }

    // Create fractional token
    const fractionalToken = new FractionalToken({
      originalAssetId: assetId,
      assetName: assetName || asset.name,
      assetDescription: assetDescription || asset.description,
      totalSupply: requestedSupply,
      circulatingSupply: requestedSupply,
      pricePerToken: requestedPrice,
      tradingEnabled: false,
      status: 'pending',
      createdBy: userId,
      holders: [{
        userId,
        balance: requestedSupply,
        percentage: 100
      }]
    });

    await fractionalToken.save();

    logger.info('Fractionalization requested', { 
      assetId, 
      tokenId: fractionalToken._id,
      supply: requestedSupply 
    });

    res.status(201).json({
      message: 'Fractionalization request created',
      token: fractionalToken
    });
  } catch (error) {
    logger.error('Error requesting fractionalization', { error });
    res.status(500).json({ error: 'Failed to request fractionalization' });
  }
};

/**
 * Get fractional token details
 * GET /api/phase2/tokens/:tokenId
 */
export const getFractionalToken = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tokenId } = req.params;

    const token = await FractionalToken.findById(tokenId)
      .populate('originalAssetId');

    if (!token) {
      return res.status(404).json({ error: 'Fractional token not found' });
    }

    res.json({ token });
  } catch (error) {
    logger.error('Error fetching fractional token', { error });
    res.status(500).json({ error: 'Failed to fetch fractional token' });
  }
};

/**
 * Get all fractional tokens for a user
 * GET /api/phase2/tokens/user/:userId
 */
export const getUserFractionalTokens = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const tokens = await FractionalToken.find({
      'holders.userId': userId
    }).populate('originalAssetId');

    res.json({ tokens });
  } catch (error) {
    logger.error('Error fetching user fractional tokens', { error });
    res.status(500).json({ error: 'Failed to fetch user tokens' });
  }
};

/**
 * Enable trading for a fractional token
 * POST /api/phase2/tokens/:tokenId/enable-trading
 */
export const enableTrading = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tokenId } = req.params;
    const userId = req.user?.id;

    const token = await FractionalToken.findById(tokenId);
    if (!token) {
      return res.status(404).json({ error: 'Fractional token not found' });
    }

    // Check if user is the creator
    if (token.createdBy.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to enable trading' });
    }

    if (token.tradingEnabled) {
      return res.status(400).json({ error: 'Trading already enabled' });
    }

    token.tradingEnabled = true;
    token.status = 'active';
    await token.save();

    logger.info('Trading enabled for fractional token', { tokenId });

    res.json({
      message: 'Trading enabled successfully',
      token
    });
  } catch (error) {
    logger.error('Error enabling trading', { error });
    res.status(500).json({ error: 'Failed to enable trading' });
  }
};

/**
 * Transfer fractional tokens between users
 * POST /api/phase2/tokens/:tokenId/transfer
 */
export const transferTokens = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tokenId } = req.params;
    const { toUserId, amount } = req.body;
    const fromUserId = req.user?.id;

    if (!toUserId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid transfer parameters' });
    }

    const token = await FractionalToken.findById(tokenId);
    if (!token) {
      return res.status(404).json({ error: 'Fractional token not found' });
    }

    // Find sender's holding
    const senderHolding = token.holders.find(h => h.userId.toString() === fromUserId);
    if (!senderHolding || senderHolding.balance < amount) {
      return res.status(400).json({ error: 'Insufficient token balance' });
    }

    // Update sender's balance
    senderHolding.balance -= amount;
    senderHolding.percentage = (senderHolding.balance / token.totalSupply) * 100;

    // Find or create receiver's holding
    let receiverHolding = token.holders.find(h => h.userId.toString() === toUserId);
    if (receiverHolding) {
      receiverHolding.balance += amount;
      receiverHolding.percentage = (receiverHolding.balance / token.totalSupply) * 100;
    } else {
      token.holders.push({
        userId: toUserId,
        balance: amount,
        percentage: (amount / token.totalSupply) * 100,
        acquiredAt: new Date(),
        totalDividendsReceived: 0
      });
    }

    // Remove holders with zero balance
    token.holders = token.holders.filter(h => h.balance > 0);

    await token.save();

    logger.info('Fractional tokens transferred', { 
      tokenId, 
      from: fromUserId, 
      to: toUserId, 
      amount 
    });

    res.json({
      message: 'Tokens transferred successfully',
      token
    });
  } catch (error) {
    logger.error('Error transferring tokens', { error });
    res.status(500).json({ error: 'Failed to transfer tokens' });
  }
};

/**
 * Get token holders for a fractional token
 * GET /api/phase2/tokens/:tokenId/holders
 */
export const getTokenHolders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tokenId } = req.params;

    const token = await FractionalToken.findById(tokenId);
    if (!token) {
      return res.status(404).json({ error: 'Fractional token not found' });
    }

    res.json({ 
      holders: token.holders,
      totalSupply: token.totalSupply,
      circulatingSupply: token.circulatingSupply
    });
  } catch (error) {
    logger.error('Error fetching token holders', { error });
    res.status(500).json({ error: 'Failed to fetch token holders' });
  }
};