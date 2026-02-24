/**
 * Vault Management Routes
 */

import { Router } from 'express';
import {
  createVault,
  getVault,
  getUserVaults,
  updateVaultValue,
  linkVaultToLoan,
  withdrawFromVault,
  getVaultStatistics
} from '../controllers/vaults';

const router = Router();

// Vault CRUD operations
router.post('/', createVault);
router.get('/:vaultId', getVault);
router.get('/user/:userId', getUserVaults);
router.get('/user/:userId/statistics', getVaultStatistics);

// Vault operations
router.put('/:vaultId/value', updateVaultValue);
router.post('/:vaultId/link-loan', linkVaultToLoan);
router.post('/:vaultId/withdraw', withdrawFromVault);

export default router;
