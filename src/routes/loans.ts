/**
 * Loan Management Routes
 */

import { Router } from 'express';
import {
  createLoan,
  getLoan,
  getBorrowerLoans,
  makeLoanPayment,
  updateLoanHealth,
  getLoansAtRisk,
  liquidateLoan,
  getLoanStatistics
} from '../controllers/loans';

const router = Router();

// Loan CRUD operations
router.post('/', createLoan);
router.get('/:loanId', getLoan);
router.get('/borrower/:userId', getBorrowerLoans);
router.get('/borrower/:userId/statistics', getLoanStatistics);

// Loan operations
router.post('/:loanId/payment', makeLoanPayment);
router.put('/:loanId/health', updateLoanHealth);
router.post('/:loanId/liquidate', liquidateLoan);

// Risk management
router.get('/risk/at-risk', getLoansAtRisk);

export default router;
