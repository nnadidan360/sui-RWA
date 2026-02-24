/**
 * Credit Profile Routes
 */

import { Router } from 'express';
import {
  getCreditProfile,
  updateCreditScore,
  getCreditLimit,
  updateCreditLimit,
  getCreditHistory,
  calculateBorrowingCapacity,
  getRiskAssessment,
  simulateCreditImpact
} from '../controllers/credit';

const router = Router();

// Credit profile operations
router.get('/:userId', getCreditProfile);
router.put('/:userId/score', updateCreditScore);

// Credit limit operations
router.get('/:userId/limit', getCreditLimit);
router.put('/:userId/limit', updateCreditLimit);

// Credit history
router.get('/:userId/history', getCreditHistory);

// Analysis and calculations
router.post('/:userId/borrowing-capacity', calculateBorrowingCapacity);
router.get('/:userId/risk-assessment', getRiskAssessment);
router.post('/:userId/simulate-impact', simulateCreditImpact);

export default router;
