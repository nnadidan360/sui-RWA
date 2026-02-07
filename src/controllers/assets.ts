/**
 * Asset Management API Controller
 * 
 * Handles asset valuation and management endpoints
 */

import { Request, Response } from 'express';
import { AssetValuationService, AssetType, ValuationData } from '../services/assets/asset-valuation-service';
import { logger } from '../utils/logger';

const assetValuationService = new AssetValuationService();

/**
 * Create initial asset valuation
 * POST /api/assets/:assetId/valuation
 */
export async function createAssetValuation(req: Request, res: Response): Promise<void> {
  try {
    const { assetId } = req.params;
    const { assetType, initialValue, appraiser, methodology } = req.body;

    // Validate required fields
    if (!assetType || !initialValue || !appraiser || !methodology) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: assetType, initialValue, appraiser, methodology'
      });
      return;
    }

    // Validate asset type
    if (!Object.values(AssetType).includes(assetType)) {
      res.status(400).json({
        success: false,
        error: 'Invalid asset type'
      });
      return;
    }

    const valuation = await assetValuationService.createInitialValuation(
      assetId as string,
      assetType as AssetType,
      initialValue,
      appraiser,
      methodology
    );

    logger.info('Asset valuation created', { assetId, initialValue });

    res.status(201).json({
      success: true,
      data: valuation
    });
  } catch (error: any) {
    logger.error('Failed to create asset valuation', { 
      error: error.message, 
      assetId: req.params.assetId 
    });

    res.status(error.code === 'UNAUTHORIZED' ? 403 : 400).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update asset valuation
 * PUT /api/assets/:assetId/valuation
 */
export async function updateAssetValuation(req: Request, res: Response): Promise<void> {
  try {
    const { assetId } = req.params;
    const { newValue, appraiser, methodology, marketFactors } = req.body;

    // Validate required fields
    if (!newValue || !appraiser || !methodology || !marketFactors) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: newValue, appraiser, methodology, marketFactors'
      });
      return;
    }

    const valuation = await assetValuationService.updateValuation(
      assetId as string,
      newValue,
      appraiser,
      methodology,
      marketFactors
    );

    logger.info('Asset valuation updated', { assetId, newValue });

    res.json({
      success: true,
      data: valuation
    });
  } catch (error: any) {
    logger.error('Failed to update asset valuation', { 
      error: error.message, 
      assetId: req.params.assetId 
    });

    const statusCode = error.code === 'VALUATION_NOT_FOUND' ? 404 : 
                      error.code === 'UNAUTHORIZED' ? 403 : 400;

    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get asset valuation
 * GET /api/assets/:assetId/valuation
 */
export async function getAssetValuation(req: Request, res: Response): Promise<void> {
  try {
    const { assetId } = req.params;

    const valuation = await assetValuationService.getValuation(assetId as string);

    if (!valuation) {
      res.status(404).json({
        success: false,
        error: 'Valuation not found'
      });
      return;
    }

    res.json({
      success: true,
      data: valuation
    });
  } catch (error: any) {
    logger.error('Failed to get asset valuation', { 
      error: error.message, 
      assetId: req.params.assetId 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get asset valuation history
 * GET /api/assets/:assetId/valuation/history
 */
export async function getAssetValuationHistory(req: Request, res: Response): Promise<void> {
  try {
    const { assetId } = req.params;

    const history = await assetValuationService.getValuationHistory(assetId as string);

    if (!history) {
      res.status(404).json({
        success: false,
        error: 'Valuation history not found'
      });
      return;
    }

    res.json({
      success: true,
      data: history
    });
  } catch (error: any) {
    logger.error('Failed to get asset valuation history', { 
      error: error.message, 
      assetId: req.params.assetId 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get market valuation estimate
 * POST /api/assets/market-estimate
 */
export async function getMarketValuationEstimate(req: Request, res: Response): Promise<void> {
  try {
    const { assetType, location, size } = req.body;

    // Validate required fields
    if (!assetType || !location || size === undefined) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: assetType, location, size'
      });
      return;
    }

    // Validate asset type
    if (!Object.values(AssetType).includes(assetType)) {
      res.status(400).json({
        success: false,
        error: 'Invalid asset type'
      });
      return;
    }

    const estimate = await assetValuationService.getMarketValuationEstimate(
      assetType as AssetType,
      location,
      size
    );

    res.json({
      success: true,
      data: estimate
    });
  } catch (error: any) {
    logger.error('Failed to get market valuation estimate', { 
      error: error.message, 
      assetType: req.body.assetType 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Validate valuation against market
 * POST /api/assets/:assetId/valuation/validate
 */
export async function validateValuationAgainstMarket(req: Request, res: Response): Promise<void> {
  try {
    const { assetId } = req.params;
    const { proposedValue, assetType, location, size } = req.body;

    // Validate required fields
    if (!proposedValue || !assetType || !location || size === undefined) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: proposedValue, assetType, location, size'
      });
      return;
    }

    // Validate asset type
    if (!Object.values(AssetType).includes(assetType)) {
      res.status(400).json({
        success: false,
        error: 'Invalid asset type'
      });
      return;
    }

    const validation = await assetValuationService.validateValuationAgainstMarket(
      assetId as string,
      proposedValue,
      assetType as AssetType,
      location,
      size
    );

    res.json({
      success: true,
      data: validation
    });
  } catch (error: any) {
    logger.error('Failed to validate valuation against market', { 
      error: error.message, 
      assetId: req.params.assetId 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Request manual revaluation
 * POST /api/assets/:assetId/valuation/manual-request
 */
export async function requestManualRevaluation(req: Request, res: Response): Promise<void> {
  try {
    const { assetId } = req.params;
    const { reason } = req.body;

    // Validate required fields
    if (!reason) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: reason'
      });
      return;
    }

    await assetValuationService.requestManualRevaluation(assetId as string, reason);

    logger.info('Manual revaluation requested', { assetId, reason });

    res.json({
      success: true,
      message: 'Manual revaluation request submitted'
    });
  } catch (error: any) {
    logger.error('Failed to request manual revaluation', { 
      error: error.message, 
      assetId: req.params.assetId 
    });

    res.status(error.code === 'UNAUTHORIZED' ? 403 : 500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Process revaluation triggers
 * POST /api/assets/process-triggers
 */
export async function processRevaluationTriggers(req: Request, res: Response): Promise<void> {
  try {
    const triggeredAssets = await assetValuationService.processRevaluationTriggers();

    logger.info('Revaluation triggers processed', { triggeredCount: triggeredAssets.length });

    res.json({
      success: true,
      data: {
        triggeredAssets,
        count: triggeredAssets.length
      }
    });
  } catch (error: any) {
    logger.error('Failed to process revaluation triggers', { error: error.message });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}