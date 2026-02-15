/**
 * Asset Confidence Scoring Service for Credit OS
 * 
 * Provides probabilistic scoring for RWA documents based on verification,
 * registry checks, and duplicate detection
 */

import { logger } from '../../utils/logger';

export interface ConfidenceScoreFactors {
  documentQuality: number; // 0-1
  verificationStatus: number; // 0-1
  registryMatch: number; // 0-1
  duplicateCheck: number; // 0-1
  metadataCompleteness: number; // 0-1
  jurisdictionValidity: number; // 0-1
  ageOfDocuments: number; // 0-1
}

export interface ConfidenceScore {
  overallScore: number; // 0-1
  factors: ConfidenceScoreFactors;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  timestamp: Date;
}

export interface AssetVerificationData {
  documentCount: number;
  hasAppraisal: boolean;
  hasDeed: boolean;
  hasInsurance: boolean;
  verificationStatus: 'pending' | 'under_review' | 'approved' | 'rejected';
  registryCheckPassed?: boolean;
  duplicatesFound: number;
  metadataFields: number;
  totalMetadataFields: number;
  jurisdiction: string;
  documentAgeInDays: number;
}

export class AssetConfidenceScoring Service {
  // Scoring weights
  private readonly WEIGHTS = {
    documentQuality: 0.20,
    verificationStatus: 0.25,
    registryMatch: 0.20,
    duplicateCheck: 0.15,
    metadataCompleteness: 0.10,
    jurisdictionValidity: 0.05,
    ageOfDocuments: 0.05
  };

  /**
   * Calculate confidence score for an asset
   */
  async calculateConfidenceScore(
    verificationData: AssetVerificationData
  ): Promise<ConfidenceScore> {
    try {
      // Calculate individual factors
      const factors: ConfidenceScoreFactors = {
        documentQuality: this.scoreDocumentQuality(verificationData),
        verificationStatus: this.scoreVerificationStatus(verificationData),
        registryMatch: this.scoreRegistryMatch(verificationData),
        duplicateCheck: this.scoreDuplicateCheck(verificationData),
        metadataCompleteness: this.scoreMetadataCompleteness(verificationData),
        jurisdictionValidity: this.scoreJurisdictionValidity(verificationData),
        ageOfDocuments: this.scoreDocumentAge(verificationData)
      };

      // Calculate weighted overall score
      const overallScore = 
        factors.documentQuality * this.WEIGHTS.documentQuality +
        factors.verificationStatus * this.WEIGHTS.verificationStatus +
        factors.registryMatch * this.WEIGHTS.registryMatch +
        factors.duplicateCheck * this.WEIGHTS.duplicateCheck +
        factors.metadataCompleteness * this.WEIGHTS.metadataCompleteness +
        factors.jurisdictionValidity * this.WEIGHTS.jurisdictionValidity +
        factors.ageOfDocuments * this.WEIGHTS.ageOfDocuments;

      // Determine risk level
      const riskLevel = this.determineRiskLevel(overallScore);

      // Generate recommendations
      const recommendations = this.generateRecommendations(factors, verificationData);

      const confidenceScore: ConfidenceScore = {
        overallScore: Math.round(overallScore * 100) / 100,
        factors,
        riskLevel,
        recommendations,
        timestamp: new Date()
      };

      logger.info('Confidence score calculated', {
        overallScore: confidenceScore.overallScore,
        riskLevel: confidenceScore.riskLevel,
        documentCount: verificationData.documentCount
      });

      return confidenceScore;
    } catch (error: any) {
      logger.error('Failed to calculate confidence score', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Score document quality based on completeness
   */
  private scoreDocumentQuality(data: AssetVerificationData): number {
    let score = 0;

    // Base score from document count
    if (data.documentCount >= 3) {
      score += 0.4;
    } else if (data.documentCount >= 2) {
      score += 0.3;
    } else if (data.documentCount >= 1) {
      score += 0.2;
    }

    // Bonus for key documents
    if (data.hasDeed) score += 0.25;
    if (data.hasAppraisal) score += 0.20;
    if (data.hasInsurance) score += 0.15;

    return Math.min(score, 1.0);
  }

  /**
   * Score based on verification status
   */
  private scoreVerificationStatus(data: AssetVerificationData): number {
    switch (data.verificationStatus) {
      case 'approved':
        return 1.0;
      case 'under_review':
        return 0.5;
      case 'pending':
        return 0.3;
      case 'rejected':
        return 0.0;
      default:
        return 0.3;
    }
  }

  /**
   * Score based on registry match
   */
  private scoreRegistryMatch(data: AssetVerificationData): number {
    if (data.registryCheckPassed === undefined) {
      // Registry check not available for this jurisdiction
      return 0.5; // Neutral score
    }

    return data.registryCheckPassed ? 1.0 : 0.0;
  }

  /**
   * Score based on duplicate detection
   */
  private scoreDuplicateCheck(data: AssetVerificationData): number {
    if (data.duplicatesFound === 0) {
      return 1.0;
    } else if (data.duplicatesFound === 1) {
      return 0.3; // Possible legitimate duplicate
    } else {
      return 0.0; // Multiple duplicates - high fraud risk
    }
  }

  /**
   * Score based on metadata completeness
   */
  private scoreMetadataCompleteness(data: AssetVerificationData): number {
    if (data.totalMetadataFields === 0) {
      return 0.5; // Neutral if no metadata expected
    }

    const completeness = data.metadataFields / data.totalMetadataFields;
    return completeness;
  }

  /**
   * Score based on jurisdiction validity
   */
  private scoreJurisdictionValidity(data: AssetVerificationData): number {
    // List of supported jurisdictions with strong legal frameworks
    const supportedJurisdictions = [
      'US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'SG', 'CH', 'NL'
    ];

    if (supportedJurisdictions.includes(data.jurisdiction)) {
      return 1.0;
    } else if (data.jurisdiction && data.jurisdiction.length > 0) {
      return 0.5; // Valid but less supported jurisdiction
    } else {
      return 0.0; // No jurisdiction specified
    }
  }

  /**
   * Score based on document age
   */
  private scoreDocumentAge(data: AssetVerificationData): number {
    const ageInDays = data.documentAgeInDays;

    if (ageInDays <= 90) {
      return 1.0; // Very recent
    } else if (ageInDays <= 180) {
      return 0.8; // Recent
    } else if (ageInDays <= 365) {
      return 0.6; // Within a year
    } else if (ageInDays <= 730) {
      return 0.4; // Within two years
    } else {
      return 0.2; // Older documents
    }
  }

  /**
   * Determine risk level from overall score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.8) {
      return 'low';
    } else if (score >= 0.6) {
      return 'medium';
    } else if (score >= 0.4) {
      return 'high';
    } else {
      return 'critical';
    }
  }

  /**
   * Generate recommendations based on scoring factors
   */
  private generateRecommendations(
    factors: ConfidenceScoreFactors,
    data: AssetVerificationData
  ): string[] {
    const recommendations: string[] = [];

    // Document quality recommendations
    if (factors.documentQuality < 0.5) {
      if (!data.hasDeed) {
        recommendations.push('Upload property deed or title document');
      }
      if (!data.hasAppraisal) {
        recommendations.push('Provide professional appraisal document');
      }
      if (!data.hasInsurance) {
        recommendations.push('Add insurance documentation');
      }
      if (data.documentCount < 2) {
        recommendations.push('Upload additional supporting documents');
      }
    }

    // Verification status recommendations
    if (factors.verificationStatus < 0.5) {
      recommendations.push('Complete verification process to improve confidence score');
    }

    // Registry match recommendations
    if (factors.registryMatch < 0.5 && data.registryCheckPassed !== undefined) {
      recommendations.push('Registry check failed - verify asset ownership documentation');
    }

    // Duplicate check recommendations
    if (factors.duplicateCheck < 0.5) {
      recommendations.push('Duplicate documents detected - verify asset uniqueness');
    }

    // Metadata completeness recommendations
    if (factors.metadataCompleteness < 0.7) {
      recommendations.push('Complete all required metadata fields');
    }

    // Jurisdiction recommendations
    if (factors.jurisdictionValidity < 0.5) {
      recommendations.push('Specify valid jurisdiction for asset location');
    }

    // Document age recommendations
    if (factors.ageOfDocuments < 0.5) {
      recommendations.push('Consider updating documents - current documents are outdated');
    }

    // Overall recommendations
    if (recommendations.length === 0) {
      recommendations.push('Asset verification is complete - good confidence score');
    }

    return recommendations;
  }

  /**
   * Compare confidence scores over time
   */
  async compareScores(
    previousScore: ConfidenceScore,
    currentScore: ConfidenceScore
  ): Promise<{
    improved: boolean;
    change: number;
    significantChanges: string[];
  }> {
    const change = currentScore.overallScore - previousScore.overallScore;
    const improved = change > 0;

    const significantChanges: string[] = [];
    const threshold = 0.1; // 10% change is significant

    // Check each factor for significant changes
    const factorKeys = Object.keys(currentScore.factors) as Array<keyof ConfidenceScoreFactors>;
    
    for (const key of factorKeys) {
      const factorChange = currentScore.factors[key] - previousScore.factors[key];
      if (Math.abs(factorChange) >= threshold) {
        const direction = factorChange > 0 ? 'improved' : 'declined';
        significantChanges.push(`${key} ${direction} by ${Math.abs(factorChange * 100).toFixed(1)}%`);
      }
    }

    logger.info('Confidence score comparison', {
      previousScore: previousScore.overallScore,
      currentScore: currentScore.overallScore,
      change,
      improved,
      significantChanges: significantChanges.length
    });

    return {
      improved,
      change: Math.round(change * 100) / 100,
      significantChanges
    };
  }

  /**
   * Get minimum required score for loan approval
   */
  getMinimumRequiredScore(loanAmount: number, assetValue: number): number {
    const ltv = loanAmount / assetValue;

    // Higher LTV requires higher confidence score
    if (ltv >= 0.8) {
      return 0.85; // Very high confidence required
    } else if (ltv >= 0.6) {
      return 0.75; // High confidence required
    } else if (ltv >= 0.4) {
      return 0.65; // Medium confidence required
    } else {
      return 0.55; // Lower confidence acceptable for low LTV
    }
  }

  /**
   * Check if asset meets minimum confidence requirements
   */
  async meetsMinimumRequirements(
    confidenceScore: ConfidenceScore,
    loanAmount: number,
    assetValue: number
  ): Promise<{
    meets: boolean;
    requiredScore: number;
    currentScore: number;
    gap?: number;
  }> {
    const requiredScore = this.getMinimumRequiredScore(loanAmount, assetValue);
    const meets = confidenceScore.overallScore >= requiredScore;
    const gap = meets ? undefined : requiredScore - confidenceScore.overallScore;

    logger.info('Minimum requirements check', {
      meets,
      requiredScore,
      currentScore: confidenceScore.overallScore,
      gap,
      loanAmount,
      assetValue
    });

    return {
      meets,
      requiredScore,
      currentScore: confidenceScore.overallScore,
      gap
    };
  }
}
