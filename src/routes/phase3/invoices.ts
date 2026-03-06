// PHASE 3: Yield-Generating Products
// Task 23.3 - Payment Collection and Distribution
// Routes for invoice payment collection and distribution

import { Router } from 'express';
import * as invoiceController from '../../controllers/phase3/invoices';
import { authenticateToken } from '../../middleware/auth-middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Invoice payment collection
router.post('/:invoiceId/collect', invoiceController.collectPayment);

// Distribute payment to token holders
router.post('/:invoiceId/distribute', invoiceController.distributePayment);

// Handle overdue invoice
router.post('/:invoiceId/overdue', invoiceController.handleOverdue);

// Adjust debtor credit rating
router.post('/:invoiceId/adjust-rating', invoiceController.adjustCreditRating);

// Get collection status
router.get('/:invoiceId/collection-status', invoiceController.getCollectionStatus);

// Reconcile payment
router.post('/:invoiceId/reconcile', invoiceController.reconcilePayment);

// Batch process overdue invoices
router.post('/process-overdue', invoiceController.processBatchOverdue);

// Debtor-specific routes
router.get('/debtors/:debtorBusinessName/payment-history', invoiceController.getDebtorPaymentHistory);
router.get('/debtors/:debtorBusinessName/metrics', invoiceController.getDebtorMetrics);

export default router;
