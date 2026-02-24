/**
 * Transaction Routes
 */

import { Router } from 'express';
import {
  getTransaction,
  getUserTransactions,
  createTransaction,
  updateTransactionStatus,
  getTransactionStatistics
} from '../controllers/transactions';

const router = Router();

// Transaction operations
router.get('/:transactionId', getTransaction);
router.get('/user/:userId', getUserTransactions);
router.post('/', createTransaction);
router.put('/:transactionId/status', updateTransactionStatus);

// Statistics
router.get('/user/:userId/statistics', getTransactionStatistics);

export default router;
