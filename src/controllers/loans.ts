/**
 * Loan Management Controller
 */

import { Request, Response, NextFunction } from 'express';
import { Loan } from '../models/Loan';
import { CreditProfile } from '../models/CreditProfile';
import { logger } from '../utils/logger';

/**
 * Create a new loan
 */
export async function createLoan(req: Request, res: Response, next: NextFunction) {
  try {
    const { borrower, collateral, loanTerms } = req.body;
    
    // Validate required fields
    if (!borrower || !collateral || !loanTerms) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: borrower, collateral, loanTerms'
      });
    }
    
    // Generate loan ID
    const loanId = `LOAN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate initial values
    const totalCollateralValue = collateral.assets.reduce(
      (sum: number, asset: any) => sum + asset.valuationAtLoan, 
      0
    );
    
    const totalLTV = loanTerms.principalAmount / totalCollateralValue;
    const healthFactor = totalCollateralValue / loanTerms.principalAmount;
    
    // Calculate maturity date
    const startDate = new Date();
    const maturityDate = new Date(startDate);
    maturityDate.setDate(maturityDate.getDate() + loanTerms.duration);
    
    // Create loan
    const loan = new Loan({
      loanId,
      borrower,
      collateral: {
        assets: collateral.assets,
        totalValue: totalCollateralValue,
        totalLTV
      },
      loanTerms: {
        ...loanTerms,
        startDate,
        maturityDate
      },
      currentStatus: {
        outstandingPrincipal: loanTerms.principalAmount,
        accruedInterest: 0,
        totalOwed: loanTerms.principalAmount,
        healthFactor,
        liquidationThreshold: 0.8,
        nextPaymentDue: new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        nextPaymentAmount: loanTerms.principalAmount * (loanTerms.interestRate / 12 / 100)
      },
      payments: [],
      riskMetrics: {
        initialRiskScore: 50,
        currentRiskScore: 50,
        riskCategory: healthFactor > 2 ? 'low' : healthFactor > 1.5 ? 'medium' : 'high',
        liquidationRisk: 0,
        priceVolatility: 0
      },
      status: 'active',
      auditTrail: [{
        action: 'loan_created',
        performedBy: borrower,
        timestamp: new Date(),
        details: { loanTerms, collateral }
      }]
    });
    
    await loan.save();
    
    // Update credit profile
    await updateCreditProfileForLoan(borrower, loan);
    
    logger.info(`Loan created: ${loanId} for borrower: ${borrower}`);
    
    res.status(201).json({
      success: true,
      data: loan
    });
  } catch (error) {
    logger.error('Error creating loan:', error);
    next(error);
  }
}

/**
 * Get loan by ID
 */
export async function getLoan(req: Request, res: Response, next: NextFunction) {
  try {
    const { loanId } = req.params;
    
    const loan = await Loan.findOne({ loanId });
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }
    
    res.json({
      success: true,
      data: loan
    });
  } catch (error) {
    logger.error('Error fetching loan:', error);
    next(error);
  }
}

/**
 * Get all loans for a borrower
 */
export async function getBorrowerLoans(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    
    const query: any = { borrower: userId };
    if (status) {
      query.status = status;
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const [loans, total] = await Promise.all([
      Loan.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Loan.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        loans,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching borrower loans:', error);
    next(error);
  }
}

/**
 * Make a loan payment
 */
export async function makeLoanPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { loanId } = req.params;
    const { amount, type, transactionHash } = req.body;
    
    const loan = await Loan.findOne({ loanId });
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }
    
    if (loan.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Loan is not active'
      });
    }
    
    // Create payment record
    const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const payment = {
      paymentId,
      amount,
      type: type || 'principal',
      paidAt: new Date(),
      transactionHash,
      remainingBalance: loan.currentStatus.totalOwed - amount
    };
    
    loan.payments.push(payment);
    
    // Update loan status
    if (type === 'full_repayment' || payment.remainingBalance <= 0) {
      loan.status = 'repaid';
      loan.currentStatus.outstandingPrincipal = 0;
      loan.currentStatus.totalOwed = 0;
    } else {
      loan.currentStatus.outstandingPrincipal -= amount;
      loan.currentStatus.totalOwed = payment.remainingBalance;
    }
    
    // Recalculate health factor
    loan.currentStatus.healthFactor = 
      loan.collateral.totalValue / loan.currentStatus.totalOwed;
    
    // Add audit trail
    loan.auditTrail.push({
      action: 'payment_made',
      performedBy: loan.borrower,
      timestamp: new Date(),
      details: { payment }
    });
    
    await loan.save();
    
    // Update credit profile
    await updateCreditProfileForPayment(loan.borrower, loan, payment);
    
    logger.info(`Payment made for loan: ${loanId}, amount: ${amount}`);
    
    res.json({
      success: true,
      data: {
        loan,
        payment
      }
    });
  } catch (error) {
    logger.error('Error making loan payment:', error);
    next(error);
  }
}

/**
 * Update loan health factor
 */
export async function updateLoanHealth(req: Request, res: Response, next: NextFunction) {
  try {
    const { loanId } = req.params;
    const { currentCollateralValue } = req.body;
    
    const loan = await Loan.findOne({ loanId });
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }
    
    // Update collateral value
    loan.collateral.totalValue = currentCollateralValue;
    
    // Recalculate health factor
    loan.currentStatus.healthFactor = 
      currentCollateralValue / loan.currentStatus.totalOwed;
    
    // Update risk metrics
    const healthFactor = loan.currentStatus.healthFactor;
    if (healthFactor < 1.1) {
      loan.riskMetrics.riskCategory = 'critical';
      loan.riskMetrics.liquidationRisk = 90;
    } else if (healthFactor < 1.3) {
      loan.riskMetrics.riskCategory = 'high';
      loan.riskMetrics.liquidationRisk = 60;
    } else if (healthFactor < 1.5) {
      loan.riskMetrics.riskCategory = 'medium';
      loan.riskMetrics.liquidationRisk = 30;
    } else {
      loan.riskMetrics.riskCategory = 'low';
      loan.riskMetrics.liquidationRisk = 10;
    }
    
    loan.auditTrail.push({
      action: 'health_updated',
      performedBy: 'system',
      timestamp: new Date(),
      details: { 
        previousValue: loan.collateral.totalValue,
        newValue: currentCollateralValue,
        healthFactor 
      }
    });
    
    await loan.save();
    
    logger.info(`Loan health updated: ${loanId}, health factor: ${healthFactor}`);
    
    res.json({
      success: true,
      data: loan
    });
  } catch (error) {
    logger.error('Error updating loan health:', error);
    next(error);
  }
}

/**
 * Get loans at risk of liquidation
 */
export async function getLoansAtRisk(req: Request, res: Response, next: NextFunction) {
  try {
    const { threshold = 1.3 } = req.query;
    
    const loans = await Loan.find({
      status: 'active',
      'currentStatus.healthFactor': { $lt: Number(threshold) }
    }).sort({ 'currentStatus.healthFactor': 1 });
    
    res.json({
      success: true,
      data: {
        loans,
        count: loans.length
      }
    });
  } catch (error) {
    logger.error('Error fetching loans at risk:', error);
    next(error);
  }
}

/**
 * Liquidate a loan
 */
export async function liquidateLoan(req: Request, res: Response, next: NextFunction) {
  try {
    const { loanId } = req.params;
    const { liquidationPrice, recoveredAmount, liquidationFee } = req.body;
    
    const loan = await Loan.findOne({ loanId });
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }
    
    if (loan.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Loan is not active'
      });
    }
    
    // Create liquidation record
    loan.liquidation = {
      triggeredAt: new Date(),
      triggeredBy: 'system',
      liquidationPrice,
      recoveredAmount,
      liquidationFee,
      remainingDebt: Math.max(0, loan.currentStatus.totalOwed - recoveredAmount),
      status: 'completed'
    };
    
    loan.status = 'liquidated';
    
    loan.auditTrail.push({
      action: 'loan_liquidated',
      performedBy: 'system',
      timestamp: new Date(),
      details: { liquidation: loan.liquidation }
    });
    
    await loan.save();
    
    // Update credit profile
    await updateCreditProfileForLiquidation(loan.borrower, loan);
    
    logger.info(`Loan liquidated: ${loanId}`);
    
    res.json({
      success: true,
      data: loan
    });
  } catch (error) {
    logger.error('Error liquidating loan:', error);
    next(error);
  }
}

/**
 * Get loan statistics
 */
export async function getLoanStatistics(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    
    const [
      totalLoans,
      activeLoans,
      repaidLoans,
      liquidatedLoans,
      totalBorrowed,
      totalRepaid
    ] = await Promise.all([
      Loan.countDocuments({ borrower: userId }),
      Loan.countDocuments({ borrower: userId, status: 'active' }),
      Loan.countDocuments({ borrower: userId, status: 'repaid' }),
      Loan.countDocuments({ borrower: userId, status: 'liquidated' }),
      Loan.aggregate([
        { $match: { borrower: userId } },
        { $group: { _id: null, total: { $sum: '$loanTerms.principalAmount' } } }
      ]),
      Loan.aggregate([
        { $match: { borrower: userId, status: 'repaid' } },
        { $group: { _id: null, total: { $sum: '$loanTerms.principalAmount' } } }
      ])
    ]);
    
    res.json({
      success: true,
      data: {
        totalLoans,
        activeLoans,
        repaidLoans,
        liquidatedLoans,
        totalBorrowed: totalBorrowed[0]?.total || 0,
        totalRepaid: totalRepaid[0]?.total || 0
      }
    });
  } catch (error) {
    logger.error('Error fetching loan statistics:', error);
    next(error);
  }
}

// Helper functions

async function updateCreditProfileForLoan(userId: string, loan: any) {
  try {
    let profile = await CreditProfile.findOne({ userId });
    
    if (!profile) {
      profile = new CreditProfile({ userId });
    }
    
    profile.borrowingHistory.totalLoans += 1;
    profile.borrowingHistory.activeLoans += 1;
    profile.borrowingHistory.totalBorrowed += loan.loanTerms.principalAmount;
    profile.borrowingHistory.averageLoanSize = 
      profile.borrowingHistory.totalBorrowed / profile.borrowingHistory.totalLoans;
    profile.borrowingHistory.largestLoan = Math.max(
      profile.borrowingHistory.largestLoan,
      loan.loanTerms.principalAmount
    );
    
    profile.creditUtilization.currentUtilization += loan.loanTerms.principalAmount;
    profile.creditUtilization.utilizationPercentage = 
      (profile.creditUtilization.currentUtilization / profile.creditLimits.currentLimit) * 100;
    
    profile.creditEvents.push({
      eventType: 'loan_originated',
      eventDate: new Date(),
      impact: -5,
      description: `New loan originated: ${loan.loanId}`
    });
    
    profile.accountInfo.lastLoanDate = new Date();
    if (!profile.accountInfo.firstLoanDate) {
      profile.accountInfo.firstLoanDate = new Date();
    }
    
    await profile.save();
  } catch (error) {
    logger.error('Error updating credit profile for loan:', error);
  }
}

async function updateCreditProfileForPayment(userId: string, loan: any, payment: any) {
  try {
    const profile = await CreditProfile.findOne({ userId });
    
    if (!profile) return;
    
    profile.paymentBehavior.onTimePayments += 1;
    profile.borrowingHistory.totalRepaid += payment.amount;
    
    if (loan.status === 'repaid') {
      profile.borrowingHistory.activeLoans -= 1;
      profile.borrowingHistory.completedLoans += 1;
      profile.creditUtilization.currentUtilization -= loan.loanTerms.principalAmount;
    }
    
    profile.creditEvents.push({
      eventType: 'payment_made',
      eventDate: new Date(),
      impact: 5,
      description: `Payment made for loan: ${loan.loanId}`
    });
    
    profile.accountInfo.lastPaymentDate = new Date();
    
    await profile.save();
  } catch (error) {
    logger.error('Error updating credit profile for payment:', error);
  }
}

async function updateCreditProfileForLiquidation(userId: string, loan: any) {
  try {
    const profile = await CreditProfile.findOne({ userId });
    
    if (!profile) return;
    
    profile.borrowingHistory.activeLoans -= 1;
    profile.borrowingHistory.defaultedLoans += 1;
    profile.collateralHistory.liquidationEvents += 1;
    
    profile.creditEvents.push({
      eventType: 'liquidation',
      eventDate: new Date(),
      impact: -50,
      description: `Loan liquidated: ${loan.loanId}`
    });
    
    profile.riskProfile.riskLevel = 'very_high';
    profile.riskProfile.defaultProbability = Math.min(1, profile.riskProfile.defaultProbability + 0.3);
    
    await profile.save();
  } catch (error) {
    logger.error('Error updating credit profile for liquidation:', error);
  }
}
