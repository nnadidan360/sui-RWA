/**
 * Asset Management Routes
 */

import { Router } from 'express';
import {
  createAssetValuation,
  updateAssetValuation,
  getAssetValuation,
  getAssetValuationHistory,
  getMarketValuationEstimate,
  validateValuationAgainstMarket,
  requestManualRevaluation,
  processRevaluationTriggers
} from '../controllers/assets';

const router = Router();

// Asset valuation routes
router.post('/:assetId/valuation', createAssetValuation);
router.put('/:assetId/valuation', updateAssetValuation);
router.get('/:assetId/valuation', getAssetValuation);
router.get('/:assetId/valuation/history', getAssetValuationHistory);
router.post('/:assetId/valuation/validate', validateValuationAgainstMarket);
router.post('/:assetId/valuation/manual-request', requestManualRevaluation);

// Market estimation routes
router.post('/market-estimate', getMarketValuationEstimate);

// Administrative routes
router.post('/process-triggers', processRevaluationTriggers);

export default router;