/**
 * Credit Engine Service
 * 
 * Internal credit bureau system that maintains private credit history,
 * scoring, and fraud detection without affecting external credit scores.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { User, IUser } from '../../models/User';
import { Asset } from '../../models/Asset';
import { Loan } from '../../models/Loan';
import { logger } from '../../utils/logger';

export interface EligibilityProfile {
  userId: string;
  internalScore: number; // 0-1000
  maxLoanAmount: number;
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
  eligibilityFactors: {
    assetQuality: number;
    repaymentHistory: number;
    accountAge: number;
    fraudRisk: number;
    verificationLevel: number;
  };
  recommendations: string[];
}

export interface CreditEvent {
  userId: string;
  eventType: 'asset_submission' | 'asset_verification' | 'loan_origination' | 'repayment' | 'default' | 'fraud_signal';
  eventData: Record<string, any>;
  timestamp: Date;
}

export interface ConsentScope {
  externalReporting: boolean;
  creditBureauSharing: boolean;
  consentDate?: Date;
  expiryDate?: Date;
}

export class CreditEngineService {
  /**
   * Compute eligibility profile for a user based on their credit history
   * Requirements: 7.1, 7.2
   */
  async computeEligibility(userId: string, assets: any[]): Promise<EligibilityProfile> {
    try {
      logger.info(`Computing eligibility for user: ${userId}`);

      const user = await User.findOne({ internalUserId: userId });
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Calculate eligibility factors
      const assetQuality = await this.calculateAssetQuality(user, assets);
      const repaymentHistory = await this.calculateRepaymentHistory(user);
      const accountAge = this.calculateAccountAge(user);
      const fraudRisk = this.calculateFraudRisk(user);
      const verificationLevel = this.calculateVerificationLevel(user);

      // Compute internal score (0-1000)
      const internalScore = this.computeInternalScore({
        assetQuality,
        repaymentHistory,
        accountAge,
        fraudRisk,
        verificationLevel
      });

      // Determine risk band
      const riskBand = this.determineRiskBand(internalScore, fraudRisk);

      // Calculate max loan amount based on score and assets
      const maxLoanAmount = this.calculateMaxLoanAmount(internalScore, assets, riskBand);

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        assetQuality,
        repaymentHistory,
        accountAge,
        fraudRisk,
        verificationLevel,
        riskBand
      });

      const eligibilityProfile: EligibilityProfile = {
        userId,
        internalScore,
        maxLoanAmount,
        riskBand,
        eligibilityFactors: {
          assetQuality,
          repaymentHistory,
          accountAge,
          fraudRisk,
          verificationLevel
        },
        recommendations
      };

      // Update user's credit profile (private, not exposed externally)
      await this.updateUserCreditProfile(user, eligibilityProfile);

      logger.info(`Eligibility computed for user ${userId}: score=${internalScore}, risk=${riskBand}`);
      return eligibilityProfile;
    } catch (error) {
      logger.error('Error computing eligibility:', error);
      throw error;
    }
  }

  /**
   * Update credit history with new events
   * Requirements: 7.1
   */
  async updateCreditHistory(userId: string, event: CreditEvent): Promise<void> {
    try {
      logger.info(`Updating credit history for user ${userId}: ${event.eventType}`);

      const user = await User.findOne({ internalUserId: userId });
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Log the credit event in activity log
      user.logActivity(`credit_event_${event.eventType}`, {
        eventType: event.eventType,
        eventData: event.eventData,
        timestamp: event.timestamp
      });

      // Update specific tracking based on event type
      switch (event.eventType) {
        case 'asset_submission':
          await this.handleAssetSubmission(user, event);
          break;
        case 'asset_verification':
          await this.handleAssetVerification(user, event);
          break;
        case 'loan_origination':
          await this.handleLoanOrigination(user, event);
          break;
        case 'repayment':
          await this.handleRepayment(user, event);
          break;
        case 'default':
          await this.handleDefault(user, event);
          break;
        case 'fraud_signal':
          await this.handleFraudSignal(user, event);
          break;
      }

      await user.save();
      logger.info(`Credit history updated for user ${userId}`);
    } catch (error) {
      logger.error('Error updating credit history:', error);
      throw error;
    }
  }

  /**
   * Check if user has consented to external reporting
   * Requirements: 7.4
   */
  async checkExternalReportingConsent(userId: string): Promise<boolean> {
    try {
      const user = await User.findOne({ internalUserId: userId });
      if (!user) {
        return false;
      }

      // Check if user has explicitly consented to external reporting
      const consentActivity = user.activityLog.find(
        (log: any) => log.action === 'external_reporting_consent' && log.details.consented === true
      );

      if (!consentActivity) {
        return false;
      }

      // Check if consent has expired
      const consentDate = consentActivity.timestamp;
      const expiryDate = new Date(consentDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year expiry

      return new Date() < expiryDate;
    } catch (error) {
      logger.error('Error checking external reporting consent:', error);
      return false;
    }
  }

  /**
   * Report to external credit bureaus (only with consent)
   * Requirements: 7.4
   */
  async reportToExternalBureau(userId: string, reportData: any): Promise<void> {
    try {
      const hasConsent = await this.checkExternalReportingConsent(userId);
      
      if (!hasConsent) {
        logger.info(`User ${userId} has not consented to external reporting. Skipping.`);
        return;
      }

      logger.info(`Reporting to external bureau for user ${userId} (with consent)`);
      
      // TODO: Integrate with external credit bureau APIs
      // This would be implemented based on specific bureau requirements
      // For now, just log the action
      
      const user = await User.findOne({ internalUserId: userId });
      if (user) {
        user.logActivity('external_bureau_report', {
          reportData,
          timestamp: new Date()
        });
        await user.save();
      }
    } catch (error) {
      logger.error('Error reporting to external bureau:', error);
      throw error;
    }
  }

  /**
   * Calculate asset quality score (0-1)
   */
  private async calculateAssetQuality(user: IUser, assets: any[]): Promise<number> {
    if (!assets || assets.length === 0) {
      return 0;
    }

    // Average confidence score of all assets
    const totalConfidence = user.assetIntelligence.reduce(
      (sum: number, asset: any) => sum + (asset.confidenceScore || 0),
      0
    );

    const avgConfidence = totalConfidence / user.assetIntelligence.length;

    // Bonus for verified assets
    const verifiedCount = user.assetIntelligence.filter(
      (asset: any) => asset.verificationStatus === 'approved'
    ).length;
    const verificationBonus = (verifiedCount / user.assetIntelligence.length) * 0.2;

    return Math.min(1, avgConfidence + verificationBonus);
  }

  /**
   * Calculate repayment history score (0-1)
   */
  private async calculateRepaymentHistory(user: IUser): Promise<number> {
    try {
      const loans = await Loan.find({ borrower: user._id });
      
      if (loans.length === 0) {
        return 0.5; // Neutral score for no history
      }

      const repaidLoans = loans.filter(loan => loan.status === 'repaid').length;
      const defaultedLoans = loans.filter(loan => loan.status === 'defaulted').length;

      // Calculate score based on repayment ratio
      const repaymentRatio = repaidLoans / loans.length;
      const defaultPenalty = (defaultedLoans / loans.length) * 0.5;

      return Math.max(0, Math.min(1, repaymentRatio - defaultPenalty));
    } catch (error) {
      logger.error('Error calculating repayment history:', error);
      return 0.5;
    }
  }

  /**
   * Calculate account age score (0-1)
   */
  private calculateAccountAge(user: IUser): Promise<number> {
    const accountAgeInDays = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    
    // Score increases with account age, maxing out at 365 days
    const score = Math.min(1, accountAgeInDays / 365);
    
    return Promise.resolve(score);
  }

  /**
   * Calculate fraud risk score (0-1, where 0 is no risk)
   */
  private calculateFraudRisk(user: IUser): number {
    const unresolvedSignals = user.fraudSignals.filter((signal: any) => !signal.resolved);
    
    if (unresolvedSignals.length === 0) {
      return 0;
    }

    // Weight by severity
    const severityWeights = {
      low: 0.1,
      medium: 0.3,
      high: 0.6,
      critical: 1.0
    };

    const totalRisk = unresolvedSignals.reduce((sum: number, signal: any) => {
      return sum + (severityWeights[signal.severity as keyof typeof severityWeights] || 0);
    }, 0);

    return Math.min(1, totalRisk / unresolvedSignals.length);
  }

  /**
   * Calculate verification level score (0-1)
   */
  private calculateVerificationLevel(user: IUser): number {
    const kycScore = user.kyc.status === 'approved' ? 0.5 : 0;
    const authMethodsScore = user.authMethods.filter((am: any) => am.verified).length * 0.15;
    const deviceScore = user.deviceFingerprints.length > 0 ? 0.2 : 0;

    return Math.min(1, kycScore + authMethodsScore + deviceScore);
  }

  /**
   * Compute internal credit score (0-1000)
   */
  private computeInternalScore(factors: {
    assetQuality: number;
    repaymentHistory: number;
    accountAge: number;
    fraudRisk: number;
    verificationLevel: number;
  }): number {
    // Weighted scoring algorithm
    const weights = {
      assetQuality: 0.25,
      repaymentHistory: 0.35,
      accountAge: 0.10,
      fraudRisk: -0.20, // Negative weight for fraud risk
      verificationLevel: 0.10
    };

    const rawScore = 
      factors.assetQuality * weights.assetQuality +
      factors.repaymentHistory * weights.repaymentHistory +
      factors.accountAge * weights.accountAge +
      factors.fraudRisk * weights.fraudRisk +
      factors.verificationLevel * weights.verificationLevel;

    // Convert to 0-1000 scale
    return Math.max(0, Math.min(1000, Math.round(rawScore * 1000)));
  }

  /**
   * Determine risk band based on score and fraud risk
   */
  private determineRiskBand(score: number, fraudRisk: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    // Critical fraud risk always results in HIGH risk band
    if (fraudRisk > 0.7) {
      return 'HIGH';
    }

    if (score >= 700) {
      return 'LOW';
    } else if (score >= 400) {
      return 'MEDIUM';
    } else {
      return 'HIGH';
    }
  }

  /**
   * Calculate maximum loan amount
   */
  private calculateMaxLoanAmount(score: number, assets: any[], riskBand: string): number {
    // Base amount based on score
    const baseAmount = (score / 1000) * 100000; // Max $100k at perfect score

    // Adjust based on risk band
    const riskMultipliers = {
      LOW: 1.0,
      MEDIUM: 0.7,
      HIGH: 0.3
    };

    const riskAdjusted = baseAmount * (riskMultipliers[riskBand as keyof typeof riskMultipliers] || 0.5);

    // Asset-based adjustment
    const assetValue = assets.reduce((sum, asset) => sum + (asset.estimatedValue || 0), 0);
    const assetBased = assetValue * 0.3; // 30% LTV

    // Return the lower of risk-adjusted or asset-based
    return Math.round(Math.min(riskAdjusted, assetBased));
  }

  /**
   * Generate recommendations for improving eligibility
   */
  private generateRecommendations(factors: any): string[] {
    const recommendations: string[] = [];

    if (factors.assetQuality < 0.5) {
      recommendations.push('Upload higher quality asset documentation to improve your score');
    }

    if (factors.verificationLevel < 0.5) {
      recommendations.push('Complete KYC verification to increase your borrowing limit');
    }

    if (factors.accountAge < 0.3) {
      recommendations.push('Build account history by maintaining active engagement');
    }

    if (factors.fraudRisk > 0.3) {
      recommendations.push('Resolve outstanding fraud signals to improve your risk profile');
    }

    if (factors.riskBand === 'HIGH') {
      recommendations.push('Focus on building repayment history with smaller loans first');
    }

    return recommendations;
  }

  /**
   * Update user's credit profile in database
   */
  private async updateUserCreditProfile(user: IUser, profile: EligibilityProfile): Promise<void> {
    user.creditProfile = {
      internalScore: profile.internalScore,
      maxLoanAmount: profile.maxLoanAmount,
      riskBand: profile.riskBand,
      lastUpdated: new Date()
    };

    await user.save();
  }

  /**
   * Event handlers for credit history updates
   */
  private async handleAssetSubmission(user: IUser, event: CreditEvent): Promise<void> {
    // Track asset submission in intelligence array
    if (event.eventData.assetId) {
      const existingAsset = user.assetIntelligence.find(
        (a: any) => a.assetId === event.eventData.assetId
      );

      if (!existingAsset) {
        user.assetIntelligence.push({
          assetId: event.eventData.assetId,
          assetType: event.eventData.assetType || 'unknown',
          confidenceScore: event.eventData.confidenceScore || 0,
          verificationStatus: 'pending',
          uploadDate: new Date()
        });
      }
    }
  }

  private async handleAssetVerification(user: IUser, event: CreditEvent): Promise<void> {
    // Update asset verification status
    const asset = user.assetIntelligence.find(
      (a: any) => a.assetId === event.eventData.assetId
    );

    if (asset) {
      asset.verificationStatus = event.eventData.status;
      asset.confidenceScore = event.eventData.confidenceScore || asset.confidenceScore;
    }
  }

  private async handleLoanOrigination(user: IUser, event: CreditEvent): Promise<void> {
    // Loan origination tracked in Loan model, just log here
    logger.info(`Loan originated for user ${user.internalUserId}: ${event.eventData.loanId}`);
  }

  private async handleRepayment(user: IUser, event: CreditEvent): Promise<void> {
    // Positive credit event - repayment made
    logger.info(`Repayment recorded for user ${user.internalUserId}: ${event.eventData.amount}`);
  }

  private async handleDefault(user: IUser, event: CreditEvent): Promise<void> {
    // Negative credit event - loan default
    logger.warn(`Default recorded for user ${user.internalUserId}: ${event.eventData.loanId}`);
    
    // Add fraud signal for default
    user.addFraudSignal('behavioral', 'high', `Loan default: ${event.eventData.loanId}`);
  }

  private async handleFraudSignal(user: IUser, event: CreditEvent): Promise<void> {
    // Fraud signal already added, just log
    logger.warn(`Fraud signal for user ${user.internalUserId}: ${event.eventData.description}`);
  }
}

export const creditEngineService = new CreditEngineService();
