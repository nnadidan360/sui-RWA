/**
 * Crypto Operations Routes
 */

import { Router } from 'express';
import {
  getCryptoPrice,
  getMultipleCryptoPrices,
  calculateLTV,
  calculateHealthFactor,
  calculateMaxLoanAmount,
  calculateRequiredCollateral,
  getLoanAnalysis
} from '../controllers/crypto';

const router = Router();

// Price feed routes
router.get('/price/:symbol', getCryptoPrice);
router.post('/prices', getMultipleCryptoPrices);

// Calculation routes
router.post('/calculate-ltv', calculateLTV);
router.post('/calculate-health-factor', calculateHealthFactor);
router.post('/calculate-max-loan', calculateMaxLoanAmount);
router.post('/calculate-required-collateral', calculateRequiredCollateral);

// Analysis routes
router.post('/loan-analysis', getLoanAnalysis);

export default router;