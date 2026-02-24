/**
 * Vault Management Controller
 * Handles crypto collateral vaults
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface Vault {
  vaultId: string;
  userId: string;
  collateralType: 'SUI' | 'USDC' | 'USDT';
  collateralAmount: number;
  collateralValue: number;
  lockedAt: Date;
  status: 'active' | 'liquidated' | 'withdrawn';
  healthFactor: number;
  ltv: number;
  linkedLoanId?: string;
}

// In-memory storage (replace with database in production)
const vaults: Map<string, Vault> = new Map();

/**
 * Create a new vault
 */
export async function createVault(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, collateralType, collateralAmount, collateralValue } = req.body;
    
    if (!userId || !collateralType || !collateralAmount || !collateralValue) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const vaultId = `VAULT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const vault: Vault = {
      vaultId,
      userId,
      collateralType,
      collateralAmount,
      collateralValue,
      lockedAt: new Date(),
      status: 'active',
      healthFactor: 0,
      ltv: 0
    };
    
    vaults.set(vaultId, vault);
    
    logger.info(`Vault created: ${vaultId} for user: ${userId}`);
    
    res.status(201).json({
      success: true,
      data: vault
    });
  } catch (error) {
    logger.error('Error creating vault:', error);
    next(error);
  }
}

/**
 * Get vault by ID
 */
export async function getVault(req: Request, res: Response, next: NextFunction) {
  try {
    const { vaultId } = req.params;
    
    const vault = vaults.get(vaultId);
    
    if (!vault) {
      return res.status(404).json({
        success: false,
        error: 'Vault not found'
      });
    }
    
    res.json({
      success: true,
      data: vault
    });
  } catch (error) {
    logger.error('Error fetching vault:', error);
    next(error);
  }
}

/**
 * Get all vaults for a user
 */
export async function getUserVaults(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const { status } = req.query;
    
    let userVaults = Array.from(vaults.values()).filter(v => v.userId === userId);
    
    if (status) {
      userVaults = userVaults.filter(v => v.status === status);
    }
    
    res.json({
      success: true,
      data: {
        vaults: userVaults,
        count: userVaults.length
      }
    });
  } catch (error) {
    logger.error('Error fetching user vaults:', error);
    next(error);
  }
}

/**
 * Update vault collateral value
 */
export async function updateVaultValue(req: Request, res: Response, next: NextFunction) {
  try {
    const { vaultId } = req.params;
    const { newValue } = req.body;
    
    const vault = vaults.get(vaultId);
    
    if (!vault) {
      return res.status(404).json({
        success: false,
        error: 'Vault not found'
      });
    }
    
    vault.collateralValue = newValue;
    
    // Recalculate health factor if linked to a loan
    if (vault.linkedLoanId) {
      // This would integrate with loan service
      vault.healthFactor = newValue / (vault.collateralValue * vault.ltv);
    }
    
    vaults.set(vaultId, vault);
    
    logger.info(`Vault value updated: ${vaultId}, new value: ${newValue}`);
    
    res.json({
      success: true,
      data: vault
    });
  } catch (error) {
    logger.error('Error updating vault value:', error);
    next(error);
  }
}

/**
 * Link vault to a loan
 */
export async function linkVaultToLoan(req: Request, res: Response, next: NextFunction) {
  try {
    const { vaultId } = req.params;
    const { loanId, loanAmount } = req.body;
    
    const vault = vaults.get(vaultId);
    
    if (!vault) {
      return res.status(404).json({
        success: false,
        error: 'Vault not found'
      });
    }
    
    vault.linkedLoanId = loanId;
    vault.ltv = loanAmount / vault.collateralValue;
    vault.healthFactor = vault.collateralValue / loanAmount;
    
    vaults.set(vaultId, vault);
    
    logger.info(`Vault linked to loan: ${vaultId} -> ${loanId}`);
    
    res.json({
      success: true,
      data: vault
    });
  } catch (error) {
    logger.error('Error linking vault to loan:', error);
    next(error);
  }
}

/**
 * Withdraw from vault
 */
export async function withdrawFromVault(req: Request, res: Response, next: NextFunction) {
  try {
    const { vaultId } = req.params;
    const { amount } = req.body;
    
    const vault = vaults.get(vaultId);
    
    if (!vault) {
      return res.status(404).json({
        success: false,
        error: 'Vault not found'
      });
    }
    
    if (vault.linkedLoanId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot withdraw from vault linked to active loan'
      });
    }
    
    if (amount > vault.collateralAmount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient collateral in vault'
      });
    }
    
    vault.collateralAmount -= amount;
    
    if (vault.collateralAmount === 0) {
      vault.status = 'withdrawn';
    }
    
    vaults.set(vaultId, vault);
    
    logger.info(`Withdrawal from vault: ${vaultId}, amount: ${amount}`);
    
    res.json({
      success: true,
      data: vault
    });
  } catch (error) {
    logger.error('Error withdrawing from vault:', error);
    next(error);
  }
}

/**
 * Get vault statistics
 */
export async function getVaultStatistics(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    
    const userVaults = Array.from(vaults.values()).filter(v => v.userId === userId);
    
    const totalCollateralValue = userVaults.reduce((sum, v) => sum + v.collateralValue, 0);
    const activeVaults = userVaults.filter(v => v.status === 'active').length;
    
    const collateralByType = userVaults.reduce((acc, v) => {
      if (!acc[v.collateralType]) {
        acc[v.collateralType] = { amount: 0, value: 0 };
      }
      acc[v.collateralType].amount += v.collateralAmount;
      acc[v.collateralType].value += v.collateralValue;
      return acc;
    }, {} as Record<string, { amount: number; value: number }>);
    
    res.json({
      success: true,
      data: {
        totalVaults: userVaults.length,
        activeVaults,
        totalCollateralValue,
        collateralByType
      }
    });
  } catch (error) {
    logger.error('Error fetching vault statistics:', error);
    next(error);
  }
}
