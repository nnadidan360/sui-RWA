// PHASE 2: Asset Tokenization and Fractionalization
// Task 16.3 - Dividend Distribution Controller
// API endpoints for dividend management

import { Request, Response } from 'express';
import { DividendDistributionService } from '../../services/phase2/dividend-distribution-service';
import { logger } from '../../utils/logger';

export class DividendController {
  private dividendService: DividendDistributionService;

  constructor(dividendService: DividendDistributionService) {
    this.dividendService = dividendService;
  }

  /**
   * POST /api/phase2/dividends/pools
   * Create a new dividend pool
   */
  createPool = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tokenId } = req.body;
      const signerAddress = req.user?.address;

      if (!tokenId) {
        res.status(400).json({ error: 'Token ID is required' });
        return;
      }

      if (!signerAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const poolId = await this.dividendService.createDividendPool(tokenId, signerAddress);

      res.status(201).json({
        success: true,
        poolId,
        message: 'Dividend pool created successfully',
      });
    } catch (error) {
      logger.error('Error in createPool controller', { error });
      res.status(500).json({ error: 'Failed to create dividend pool' });
    }
  };

  /**
   * POST /api/phase2/dividends/pools/:poolId/deposit
   * Deposit dividends to pool
   */
  depositDividend = async (req: Request, res: Response): Promise<void> => {
    try {
      const { poolId } = req.params;
      const { amount, source } = req.body;
      const signerAddress = req.user?.address;

      if (!amount || !source) {
        res.status(400).json({ error: 'Amount and source are required' });
        return;
      }

      if (!signerAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await this.dividendService.depositDividend(poolId, amount, source, signerAddress);

      res.status(200).json({
        success: true,
        message: 'Dividend deposited successfully',
      });
    } catch (error) {
      logger.error('Error in depositDividend controller', { error });
      res.status(500).json({ error: 'Failed to deposit dividend' });
    }
  };

  /**
   * POST /api/phase2/dividends/pools/:poolId/distribute
   * Create a new distribution
   */
  createDistribution = async (req: Request, res: Response): Promise<void> => {
    try {
      const { poolId } = req.params;
      const { totalSupply } = req.body;
      const signerAddress = req.user?.address;

      if (!totalSupply) {
        res.status(400).json({ error: 'Total supply is required' });
        return;
      }

      if (!signerAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const distribution = await this.dividendService.createDistribution(
        poolId,
        totalSupply,
        signerAddress
      );

      res.status(201).json({
        success: true,
        distribution,
        message: 'Distribution created successfully',
      });
    } catch (error) {
      logger.error('Error in createDistribution controller', { error });
      res.status(500).json({ error: 'Failed to create distribution' });
    }
  };

  /**
   * POST /api/phase2/dividends/claim
   * Claim dividends
   */
  claimDividend = async (req: Request, res: Response): Promise<void> => {
    try {
      const { poolId, distributionId, claimId } = req.body;
      const signerAddress = req.user?.address;

      if (!poolId || !distributionId || !claimId) {
        res.status(400).json({ error: 'Pool ID, distribution ID, and claim ID are required' });
        return;
      }

      if (!signerAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await this.dividendService.claimDividend(poolId, distributionId, claimId, signerAddress);

      res.status(200).json({
        success: true,
        message: 'Dividend claimed successfully',
      });
    } catch (error) {
      logger.error('Error in claimDividend controller', { error });
      res.status(500).json({ error: 'Failed to claim dividend' });
    }
  };

  /**
   * GET /api/phase2/dividends/pools/:poolId
   * Get dividend pool information
   */
  getPool = async (req: Request, res: Response): Promise<void> => {
    try {
      const { poolId } = req.params;

      const poolInfo = await this.dividendService.getDividendPool(poolId);

      res.status(200).json({
        success: true,
        pool: poolInfo,
      });
    } catch (error) {
      logger.error('Error in getPool controller', { error });
      res.status(500).json({ error: 'Failed to get dividend pool' });
    }
  };

  /**
   * GET /api/phase2/dividends/holders/:holder/claimable
   * Get holder's claimable dividends
   */
  getHolderClaimable = async (req: Request, res: Response): Promise<void> => {
    try {
      const { holder } = req.params;
      const { tokenId } = req.query;

      if (!tokenId) {
        res.status(400).json({ error: 'Token ID is required' });
        return;
      }

      const claimable = await this.dividendService.getHolderClaimableDividends(
        holder,
        tokenId as string
      );

      res.status(200).json({
        success: true,
        claimable,
      });
    } catch (error) {
      logger.error('Error in getHolderClaimable controller', { error });
      res.status(500).json({ error: 'Failed to get claimable dividends' });
    }
  };

  /**
   * GET /api/phase2/dividends/tax-report/:holder
   * Generate tax report for holder
   */
  getTaxReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { holder } = req.params;
      const { year } = req.query;

      if (!year) {
        res.status(400).json({ error: 'Year is required' });
        return;
      }

      const report = await this.dividendService.generateTaxReport(
        holder,
        parseInt(year as string)
      );

      res.status(200).json({
        success: true,
        report,
      });
    } catch (error) {
      logger.error('Error in getTaxReport controller', { error });
      res.status(500).json({ error: 'Failed to generate tax report' });
    }
  };

  /**
   * POST /api/phase2/dividends/reinvestment
   * Enable automatic reinvestment
   */
  enableReinvestment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tokenId, percentage } = req.body;
      const holder = req.user?.address;

      if (!tokenId || percentage === undefined) {
        res.status(400).json({ error: 'Token ID and percentage are required' });
        return;
      }

      if (!holder) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await this.dividendService.enableReinvestment(holder, tokenId, percentage);

      res.status(200).json({
        success: true,
        message: 'Reinvestment enabled successfully',
      });
    } catch (error) {
      logger.error('Error in enableReinvestment controller', { error });
      res.status(500).json({ error: 'Failed to enable reinvestment' });
    }
  };

  /**
   * POST /api/phase2/dividends/rental-income
   * Collect rental income (automated)
   */
  collectRentalIncome = async (req: Request, res: Response): Promise<void> => {
    try {
      const { assetId, amount, source } = req.body;

      if (!assetId || !amount || !source) {
        res.status(400).json({ error: 'Asset ID, amount, and source are required' });
        return;
      }

      await this.dividendService.collectRentalIncome(assetId, amount, source);

      res.status(200).json({
        success: true,
        message: 'Rental income collected successfully',
      });
    } catch (error) {
      logger.error('Error in collectRentalIncome controller', { error });
      res.status(500).json({ error: 'Failed to collect rental income' });
    }
  };
}

export default DividendController;
