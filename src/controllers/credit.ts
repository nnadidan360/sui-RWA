/**
 * Credit Profile Controller
 */

import { Request, Response, NextFunction } from 'express';
import { CreditProfile } from '../models/CreditProfile';
import { Loan } from '../models/Loan';
import { logger } from '../utils/logger';

/**
 * Get credit profile for a user
 */
export async function getCreditProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    
    let profile = await CreditProfile.findOne({ userId });
    
    if (!profile) {
      profile = new CreditProfile({ userId });
      await profile.save();
    }
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error('Error fetching credit profile:', error);
    next(error);
  }
}

/**
 * Calculate and update credit score
 */
export async function updateCreditScore(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    
    const profile = await CreditProfile.findOne({ userId });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Credit profile not found'
      });
    }
    
    const factors = profile.creditScore.factors;
    
    const score = Math.round(
      factors.paymentHistory * 0.35 +
      factors.creditUtilization * 0.30 +
      factors.accountAge * 0.15 +
      factors.accountMix * 0.10 +
      factors.recentActivity * 0.10
    ) * 5.5 + 300;
    
    profile.creditScore.score = Math.max(300, Math.min(850, score));
    profile.creditScore.lastUpdated = new Date();
    
    if (profile.creditScore.score >= 750) {
      profile.riskProfile.riskLevel = 'very_low';
      profile.riskProfile.riskScore = 20;
      profile.riskProfile.defaultProbability = 0.02;
      profile.riskProfile.recommendedLTV = 0.7;
    } else if (profile.creditScore.score >= 700) {
      profile.riskProfile.riskLevel = 'low';
      profile.riskProfile.riskScore = 35;
      profile.riskProfile.defaultProbability = 0.05;
      profile.riskProfile.recommendedLTV = 0.6;
    } else if (profile.creditScore.score >= 650) {
      profile.riskProfile.riskLevel = 'medium';
      profile.riskProfile.riskScore = 50;
      profile.riskProfile.defaultProbability = 0.1;
      profile.riskProfile.recommendedLTV = 0.5;
    } else if (profile.creditScore.score >= 600) {
      profile.riskProfile.riskLevel = 'high';
      profile.riskProfile.riskScore = 70;
      profile.riskProfile.defaultProbability = 0.2;
      profile.riskProfile.recommendedLTV = 0.4;
    } else {
      profile.riskProfile.riskLevel = 'very_high';
      profile.riskProfile.riskScore = 85;
      profile.riskProfile.defaultProbability = 0.35;
      profile.riskProfile.recommendedLTV = 0.3;
    }
    
    profile.riskProfile.lastAssessment = new Date();
    
    await profile.save();
    
    logger.info(`Credit score updated for user: ${userId}, score: ${profile.creditScore.score}`);
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    logger.error('Error updating credit score:', error);
    next(error);
  }
}

/**
 * Get credit limit for a user
 */
export async function getCreditLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    
    const profile = await CreditProfile.findOne({ userId });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Credit profile not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        currentLimit: profile.creditLimits.currentLimit,
        availableCredit: profile.creditLimits.availableCredit,
        pendingCredit: profile.creditLimits.pendingCredit,
        utilizationPercentage: profile.creditUtilization.utilizationPercentage
      }
    });
  } catch (error) {
    logger.error('Error fetching credit limit:', error);
    next(error);
  }
}

/**
 * Update credit limit
 */
export async function updateCreditLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const { newLimit, reason } = req.body;
    
    const profile = await CreditProfile.findOne({ userId });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Credit profile not found'
      });
    }
    
    profile.creditLimits.limitHistory.push({
      limit: newLimit,
      effectiveDate: new Date(),
      reason: reason || 'Manual adjustment'
    });
    
    const previousLimit = profile.creditLimits.currentLimit;
    profile.creditLimits.currentLimit = newLimit;
    profile.creditLimits.availableCredit = 
      newLimit - profile.creditUtilization.currentUtilization;
    
    profile.creditEvents.push({
      eventType: newLimit > previousLimit ? 'credit_increase' : 'credit_decrease',
      eventDate: new Date(),
      impact: newLimit > previousLimit ? 10 : -10,
      description: `Credit limit ${newLimit > previousLimit ? 'increased' : 'decreased'} from ${previousLimit} to ${newLimit}`
    });
    
    await profile.save();
    
    logger.info(`Credit limit updated for user: ${userId}, new limit: ${newLimit}`);
    
    res.json({
      success: true,
      data: profile.creditLimits
    });
  } catch (error) {
    logger.error('Error updating credit limit:', error);
    next(error);
  }
}

/**
 * Get credit history
 */
export async function getCreditHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const { eventType, limit = 50 } = req.query;
    
    const profile = await CreditProfile.findOne({ userId });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Credit profile not found'
      });
    }
    
    let events = profile.creditEvents;
    
    if (eventType) {
      events = events.filter((e: any) => e.eventType === eventType);
    }
    
    events = events
      .sort((a: any, b: any) => b.eventDate.getTime() - a.eventDate.getTime())
      .slice(0, Number(limit));
    
    res.json({
      success: true,
      data: {
        events,
        count: events.length
      }
    });
  } catch (error) {
    logger.error('Error fetching credit history:', error);
    next(error);
  }
}

/**
 * Calculate borrowing capacity
 */
export async function calculateBorrowingCapacity(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const { collateralValue } = req.body;
    
    const profile = await CreditProfile.findOne({ userId });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Credit profile not found'
      });
    }
    
    const recommendedLTV = profile.riskProfile.recommendedLTV;
    const maxLoanFromCollateral = collateralValue * recommendedLTV;
    const maxLoanFromCredit = profile.creditLimits.availableCredit;
    
    const maxLoan = Math.min(maxLoanFromCollateral, maxLoanFromCredit);
    
    res.json({
      success: true,
      data: {
        maxLoan,
        recommendedLTV,
        availableCredit: profile.creditLimits.availableCredit,
        collateralValue,
        maxLoanFromCollateral,
        maxLoanFromCredit,
        limitingFactor: maxLoan === maxLoanFromCollateral ? 'collateral' : 'credit_limit'
      }
    });
  } catch (error) {
    logger.error('Error calculating borrowing capacity:', error);
    next(error);
  }
}

/**
 * Get risk assessment
 */
export async function getRiskAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    
    const profile = await CreditProfile.findOne({ userId });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Credit profile not found'
      });
    }
    
    const activeLoans = await Loan.find({ 
      borrower: userId, 
      status: 'active' 
    });
    
    const totalActiveDebt = activeLoans.reduce(
      (sum, loan) => sum + loan.currentStatus.totalOwed, 
      0
    );
    
    const avgHealthFactor = activeLoans.length > 0
      ? activeLoans.reduce((sum, loan) => sum + loan.currentStatus.healthFactor, 0) / activeLoans.length
      : 0;
    
    const recommendations: string[] = [];
    
    if (profile.riskProfile.riskLevel === 'high' || profile.riskProfile.riskLevel === 'very_high') {
      recommendations.push('Consider reducing your active loan count to improve your risk profile');
    }
    
    if (profile.creditUtilization.utilizationPercentage > 70) {
      recommendations.push('Your credit utilization is high. Try to keep it below 70%');
    }
    
    if (profile.paymentBehavior.latePayments > 0) {
      recommendations.push('Set up automatic payments to avoid late payments');
    }
    
    if (activeLoans.some(loan => loan.currentStatus.healthFactor < 1.5)) {
      recommendations.push('Some of your loans have low health factors. Consider adding more collateral');
    }
    
    if (profile.creditScore.score < 650) {
      recommendations.push('Focus on making on-time payments to improve your credit score');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Your credit profile looks good! Keep up the good payment habits');
    }
    
    res.json({
      success: true,
      data: {
        riskProfile: profile.riskProfile,
        creditScore: profile.creditScore.score,
        activeLoans: activeLoans.length,
        totalActiveDebt,
        avgHealthFactor,
        paymentReliability: profile.paymentBehavior.paymentReliabilityScore,
        collateralReliability: profile.collateralHistory.collateralReliabilityScore,
        recommendations
      }
    });
  } catch (error) {
    logger.error('Error fetching risk assessment:', error);
    next(error);
  }
}

/**
 * Simulate credit score impact
 */
export async function simulateCreditImpact(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const { action, amount } = req.body;
    
    const profile = await CreditProfile.findOne({ userId });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Credit profile not found'
      });
    }
    
    let impact = 0;
    let description = '';
    
    switch (action) {
      case 'new_loan':
        impact = -5;
        description = 'Taking a new loan will slightly decrease your credit score initially';
        break;
      case 'on_time_payment':
        impact = 5;
        description = 'Making on-time payments will improve your credit score';
        break;
      case 'late_payment':
        impact = -15;
        description = 'Late payments significantly hurt your credit score';
        break;
      case 'full_repayment':
        impact = 10;
        description = 'Fully repaying a loan will boost your credit score';
        break;
      case 'liquidation':
        impact = -50;
        description = 'Liquidation will severely damage your credit score';
        break;
      default:
        impact = 0;
        description = 'Unknown action';
    }
    
    const currentScore = profile.creditScore.score;
    const projectedScore = Math.max(300, Math.min(850, currentScore + impact));
    
    res.json({
      success: true,
      data: {
        currentScore,
        projectedScore,
        impact,
        description,
        action
      }
    });
  } catch (error) {
    logger.error('Error simulating credit impact:', error);
    next(error);
  }
}
