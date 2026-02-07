/**
 * Crypto Operations API Controller
 * 
 * Handles price feeds, LTV calculations, and crypto-related operations
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';

// Mock crypto service for demonstration
class CryptoService {
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Initialize with some mock prices
    this.initializeMockPrices();
  }

  private initializeMockPrices(): void {
    const mockPrices = {
      'SUI': 2.45,
      'BTC': 43500.00,
      'ETH': 2650.00,
      'USDC': 1.00,
      'USDT': 1.00,
    };

    for (const [symbol, price] of Object.entries(mockPrices)) {
      this.priceCache.set(symbol, {
        price,
        timestamp: Date.now()
      });
    }
  }

  async getPrice(symbol: string): Promise<{ price: number; timestamp: number } | null> {
    const cached = this.priceCache.get(symbol.toUpperCase());
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached;
    }

    // In production, this would fetch from external price APIs
    // For now, return mock data with some random variation
    const basePrices: Record<string, number> = {
      'SUI': 2.45,
      'BTC': 43500.00,
      'ETH': 2650.00,
      'USDC': 1.00,
      'USDT': 1.00,
    };

    const basePrice = basePrices[symbol.toUpperCase()];
    if (!basePrice) {
      return null;
    }

    // Add random variation (±5%)
    const variation = (Math.random() - 0.5) * 0.1;
    const price = basePrice * (1 + variation);

    const priceData = {
      price: Math.round(price * 100000) / 100000, // Round to 5 decimal places
      timestamp: Date.now()
    };

    this.priceCache.set(symbol.toUpperCase(), priceData);
    return priceData;
  }

  async getMultiplePrices(symbols: string[]): Promise<Record<string, { price: number; timestamp: number } | null>> {
    const prices: Record<string, { price: number; timestamp: number } | null> = {};
    
    for (const symbol of symbols) {
      prices[symbol] = await this.getPrice(symbol);
    }

    return prices;
  }

  calculateLTV(collateralValue: number, loanAmount: number): number {
    if (collateralValue <= 0) {
      return 0;
    }
    return (loanAmount / collateralValue) * 100;
  }

  calculateHealthFactor(collateralValue: number, loanAmount: number, liquidationThreshold: number = 80): number {
    if (loanAmount <= 0) {
      return Infinity;
    }
    return (collateralValue * liquidationThreshold / 100) / loanAmount;
  }

  calculateMaxLoanAmount(collateralValue: number, maxLTV: number = 70): number {
    return collateralValue * (maxLTV / 100);
  }

  calculateRequiredCollateral(loanAmount: number, maxLTV: number = 70): number {
    return loanAmount / (maxLTV / 100);
  }
}

const cryptoService = new CryptoService();

/**
 * Get current price for a cryptocurrency
 * GET /api/crypto/price/:symbol
 */
export async function getCryptoPrice(req: Request, res: Response): Promise<void> {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      res.status(400).json({
        success: false,
        error: 'Symbol is required'
      });
      return;
    }

    const priceData = await cryptoService.getPrice(symbol as string);

    if (!priceData) {
      res.status(404).json({
        success: false,
        error: 'Price not found for symbol'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        symbol: (symbol as string).toUpperCase(),
        ...priceData
      }
    });
  } catch (error: any) {
    logger.error('Failed to get crypto price', { 
      error: error.message, 
      symbol: req.params.symbol 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get prices for multiple cryptocurrencies
 * POST /api/crypto/prices
 */
export async function getMultipleCryptoPrices(req: Request, res: Response): Promise<void> {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Symbols array is required'
      });
      return;
    }

    if (symbols.length > 20) {
      res.status(400).json({
        success: false,
        error: 'Maximum 20 symbols allowed per request'
      });
      return;
    }

    const prices = await cryptoService.getMultiplePrices(symbols);

    res.json({
      success: true,
      data: prices
    });
  } catch (error: any) {
    logger.error('Failed to get multiple crypto prices', { 
      error: error.message, 
      symbols: req.body.symbols 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Calculate Loan-to-Value ratio
 * POST /api/crypto/calculate-ltv
 */
export async function calculateLTV(req: Request, res: Response): Promise<void> {
  try {
    const { collateralValue, loanAmount } = req.body;

    if (collateralValue === undefined || loanAmount === undefined) {
      res.status(400).json({
        success: false,
        error: 'collateralValue and loanAmount are required'
      });
      return;
    }

    if (collateralValue < 0 || loanAmount < 0) {
      res.status(400).json({
        success: false,
        error: 'Values must be non-negative'
      });
      return;
    }

    const ltv = cryptoService.calculateLTV(collateralValue, loanAmount);

    res.json({
      success: true,
      data: {
        collateralValue,
        loanAmount,
        ltv: Math.round(ltv * 100) / 100, // Round to 2 decimal places
        ltvPercentage: `${Math.round(ltv * 100) / 100}%`
      }
    });
  } catch (error: any) {
    logger.error('Failed to calculate LTV', { 
      error: error.message, 
      collateralValue: req.body.collateralValue,
      loanAmount: req.body.loanAmount 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Calculate health factor
 * POST /api/crypto/calculate-health-factor
 */
export async function calculateHealthFactor(req: Request, res: Response): Promise<void> {
  try {
    const { collateralValue, loanAmount, liquidationThreshold = 80 } = req.body;

    if (collateralValue === undefined || loanAmount === undefined) {
      res.status(400).json({
        success: false,
        error: 'collateralValue and loanAmount are required'
      });
      return;
    }

    if (collateralValue < 0 || loanAmount < 0 || liquidationThreshold < 0 || liquidationThreshold > 100) {
      res.status(400).json({
        success: false,
        error: 'Invalid values provided'
      });
      return;
    }

    const healthFactor = cryptoService.calculateHealthFactor(collateralValue, loanAmount, liquidationThreshold);

    res.json({
      success: true,
      data: {
        collateralValue,
        loanAmount,
        liquidationThreshold,
        healthFactor: healthFactor === Infinity ? 'Infinity' : Math.round(healthFactor * 100) / 100,
        status: healthFactor > 1.5 ? 'safe' : healthFactor > 1.2 ? 'warning' : 'danger'
      }
    });
  } catch (error: any) {
    logger.error('Failed to calculate health factor', { 
      error: error.message, 
      collateralValue: req.body.collateralValue,
      loanAmount: req.body.loanAmount 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Calculate maximum loan amount
 * POST /api/crypto/calculate-max-loan
 */
export async function calculateMaxLoanAmount(req: Request, res: Response): Promise<void> {
  try {
    const { collateralValue, maxLTV = 70 } = req.body;

    if (collateralValue === undefined) {
      res.status(400).json({
        success: false,
        error: 'collateralValue is required'
      });
      return;
    }

    if (collateralValue < 0 || maxLTV < 0 || maxLTV > 100) {
      res.status(400).json({
        success: false,
        error: 'Invalid values provided'
      });
      return;
    }

    const maxLoanAmount = cryptoService.calculateMaxLoanAmount(collateralValue, maxLTV);

    res.json({
      success: true,
      data: {
        collateralValue,
        maxLTV,
        maxLoanAmount: Math.round(maxLoanAmount * 100) / 100
      }
    });
  } catch (error: any) {
    logger.error('Failed to calculate max loan amount', { 
      error: error.message, 
      collateralValue: req.body.collateralValue,
      maxLTV: req.body.maxLTV 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Calculate required collateral
 * POST /api/crypto/calculate-required-collateral
 */
export async function calculateRequiredCollateral(req: Request, res: Response): Promise<void> {
  try {
    const { loanAmount, maxLTV = 70 } = req.body;

    if (loanAmount === undefined) {
      res.status(400).json({
        success: false,
        error: 'loanAmount is required'
      });
      return;
    }

    if (loanAmount < 0 || maxLTV < 0 || maxLTV > 100) {
      res.status(400).json({
        success: false,
        error: 'Invalid values provided'
      });
      return;
    }

    const requiredCollateral = cryptoService.calculateRequiredCollateral(loanAmount, maxLTV);

    res.json({
      success: true,
      data: {
        loanAmount,
        maxLTV,
        requiredCollateral: Math.round(requiredCollateral * 100) / 100
      }
    });
  } catch (error: any) {
    logger.error('Failed to calculate required collateral', { 
      error: error.message, 
      loanAmount: req.body.loanAmount,
      maxLTV: req.body.maxLTV 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get comprehensive loan analysis
 * POST /api/crypto/loan-analysis
 */
export async function getLoanAnalysis(req: Request, res: Response): Promise<void> {
  try {
    const { 
      collateralValue, 
      loanAmount, 
      maxLTV = 70, 
      liquidationThreshold = 80 
    } = req.body;

    if (collateralValue === undefined || loanAmount === undefined) {
      res.status(400).json({
        success: false,
        error: 'collateralValue and loanAmount are required'
      });
      return;
    }

    if (collateralValue < 0 || loanAmount < 0 || maxLTV < 0 || maxLTV > 100 || liquidationThreshold < 0 || liquidationThreshold > 100) {
      res.status(400).json({
        success: false,
        error: 'Invalid values provided'
      });
      return;
    }

    const ltv = cryptoService.calculateLTV(collateralValue, loanAmount);
    const healthFactor = cryptoService.calculateHealthFactor(collateralValue, loanAmount, liquidationThreshold);
    const maxLoanAmount = cryptoService.calculateMaxLoanAmount(collateralValue, maxLTV);
    const requiredCollateral = cryptoService.calculateRequiredCollateral(loanAmount, maxLTV);

    const analysis = {
      input: {
        collateralValue,
        loanAmount,
        maxLTV,
        liquidationThreshold
      },
      metrics: {
        currentLTV: Math.round(ltv * 100) / 100,
        healthFactor: healthFactor === Infinity ? 'Infinity' : Math.round(healthFactor * 100) / 100,
        maxLoanAmount: Math.round(maxLoanAmount * 100) / 100,
        requiredCollateral: Math.round(requiredCollateral * 100) / 100
      },
      status: {
        ltvStatus: ltv <= maxLTV ? 'acceptable' : 'too_high',
        healthStatus: healthFactor > 1.5 ? 'safe' : healthFactor > 1.2 ? 'warning' : 'danger',
        canBorrow: ltv <= maxLTV && healthFactor > 1.0
      },
      recommendations: [] as string[]
    };

    // Add recommendations
    if (ltv > maxLTV) {
      analysis.recommendations.push('Loan amount exceeds maximum LTV ratio. Consider reducing loan amount or adding more collateral.');
    }

    if (healthFactor < 1.5 && healthFactor !== Infinity) {
      analysis.recommendations.push('Health factor is low. Consider adding more collateral to reduce liquidation risk.');
    }

    if (loanAmount > maxLoanAmount) {
      analysis.recommendations.push(`Maximum borrowable amount with current collateral is ${Math.round(maxLoanAmount * 100) / 100}.`);
    }

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    logger.error('Failed to get loan analysis', { 
      error: error.message, 
      collateralValue: req.body.collateralValue,
      loanAmount: req.body.loanAmount 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}