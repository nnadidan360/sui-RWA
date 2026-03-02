// PHASE 2: Asset Tokenization and Fractionalization
// Task 16.3 - Dividend Distribution Routes

import { Router } from 'express';
import { DividendController } from '../../controllers/phase2/dividend.controller';
import { DividendDistributionService } from '../../services/phase2/dividend-distribution-service';
import { SuiClient } from '@mysten/sui.js/client';

const router = Router();

// Initialize service and controller
const suiClient = new SuiClient({ url: process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io' });
const packageId = process.env.CREDIT_OS_PACKAGE_ID || '';
const dividendService = new DividendDistributionService(suiClient, packageId);
const dividendController = new DividendController(dividendService);

// Pool management
router.post('/pools', dividendController.createPool);
router.get('/pools/:poolId', dividendController.getPool);
router.post('/pools/:poolId/deposit', dividendController.depositDividend);
router.post('/pools/:poolId/distribute', dividendController.createDistribution);

// Claiming
router.post('/claim', dividendController.claimDividend);
router.get('/holders/:holder/claimable', dividendController.getHolderClaimable);

// Tax reporting
router.get('/tax-report/:holder', dividendController.getTaxReport);

// Reinvestment
router.post('/reinvestment', dividendController.enableReinvestment);

// Automated income collection
router.post('/rental-income', dividendController.collectRentalIncome);

export default router;
