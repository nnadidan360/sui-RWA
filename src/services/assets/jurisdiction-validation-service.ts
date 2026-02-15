/**
 * Jurisdiction Validation Service for Credit OS
 * 
 * Validates jurisdiction-specific requirements for RWA assets
 */

import { logger } from '../../utils/logger';

export interface JurisdictionRules {
  code: string;
  name: string;
  requiredDocuments: string[];
  registryAvailable: boolean;
  registryUrl?: string;
  legalFramework: 'strong' | 'moderate' | 'weak';
  supportLevel: 'full' | 'partial' | 'limited';
  specificRequirements?: string[];
}

export interface JurisdictionValidationResult {
  isValid: boolean;
  jurisdiction: JurisdictionRules;
  missingRequirements: string[];
  warnings: string[];
  recommendations: string[];
}

export class JurisdictionValidationService {
  private jurisdictions: Map<string, JurisdictionRules>;

  constructor() {
    this.jurisdictions = new Map();
    this.initializeJurisdictions();
  }

  /**
   * Initialize supported jurisdictions
   */
  private initializeJurisdictions(): void {
    // United States
    this.jurisdictions.set('US', {
      code: 'US',
      name: 'United States',
      requiredDocuments: ['deed', 'appraisal'],
      registryAvailable: true,
      registryUrl: 'https://www.usa.gov/property-records',
      legalFramework: 'strong',
      supportLevel: 'full',
      specificRequirements: [
        'Property must be registered with county recorder',
        'Title insurance recommended',
        'Appraisal must be from licensed appraiser'
      ]
    });

    // United Kingdom
    this.jurisdictions.set('UK', {
      code: 'UK',
      name: 'United Kingdom',
      requiredDocuments: ['deed', 'appraisal'],
      registryAvailable: true,
      registryUrl: 'https://www.gov.uk/government/organisations/land-registry',
      legalFramework: 'strong',
      supportLevel: 'full',
      specificRequirements: [
        'Property must be registered with HM Land Registry',
        'RICS valuation required for properties over £500k'
      ]
    });

    // Canada
    this.jurisdictions.set('CA', {
      code: 'CA',
      name: 'Canada',
      requiredDocuments: ['deed', 'appraisal'],
      registryAvailable: true,
      legalFramework: 'strong',
      supportLevel: 'full',
      specificRequirements: [
        'Provincial land registry registration required',
        'Appraisal from AIC-designated appraiser'
      ]
    });

    // Australia
    this.jurisdictions.set('AU', {
      code: 'AU',
      name: 'Australia',
      requiredDocuments: ['deed', 'appraisal'],
      registryAvailable: true,
      legalFramework: 'strong',
      supportLevel: 'full',
      specificRequirements: [
        'State land titles office registration',
        'Valuation from API-certified valuer'
      ]
    });

    // Germany
    this.jurisdictions.set('DE', {
      code: 'DE',
      name: 'Germany',
      requiredDocuments: ['deed', 'appraisal'],
      registryAvailable: true,
      legalFramework: 'strong',
      supportLevel: 'full',
      specificRequirements: [
        'Grundbuch (land register) entry required',
        'Notarized property transfer documents'
      ]
    });

    // Singapore
    this.jurisdictions.set('SG', {
      code: 'SG',
      name: 'Singapore',
      requiredDocuments: ['deed', 'appraisal'],
      registryAvailable: true,
      legalFramework: 'strong',
      supportLevel: 'full',
      specificRequirements: [
        'Singapore Land Authority registration',
        'Licensed appraiser valuation'
      ]
    });

    // Add more jurisdictions with partial support
    this.addPartialSupportJurisdictions();
  }

  /**
   * Add jurisdictions with partial support
   */
  private addPartialSupportJurisdictions(): void {
    const partialSupport = [
      { code: 'FR', name: 'France' },
      { code: 'JP', name: 'Japan' },
      { code: 'CH', name: 'Switzerland' },
      { code: 'NL', name: 'Netherlands' },
      { code: 'SE', name: 'Sweden' },
      { code: 'NO', name: 'Norway' },
      { code: 'DK', name: 'Denmark' }
    ];

    for (const jurisdiction of partialSupport) {
      this.jurisdictions.set(jurisdiction.code, {
        code: jurisdiction.code,
        name: jurisdiction.name,
        requiredDocuments: ['deed', 'appraisal'],
        registryAvailable: false,
        legalFramework: 'moderate',
        supportLevel: 'partial',
        specificRequirements: [
          'Manual verification required',
          'Additional documentation may be requested'
        ]
      });
    }
  }

  /**
   * Validate asset against jurisdiction rules
   */
  async validateJurisdiction(
    jurisdictionCode: string,
    assetType: string,
    documents: Array<{ type: string }>
  ): Promise<JurisdictionValidationResult> {
    try {
      const jurisdiction = this.jurisdictions.get(jurisdictionCode.toUpperCase());

      if (!jurisdiction) {
        return {
          isValid: false,
          jurisdiction: {
            code: jurisdictionCode,
            name: 'Unknown',
            requiredDocuments: [],
            registryAvailable: false,
            legalFramework: 'weak',
            supportLevel: 'limited'
          },
          missingRequirements: ['Jurisdiction not supported'],
          warnings: ['This jurisdiction has limited support'],
          recommendations: [
            'Consider assets in supported jurisdictions for better terms',
            'Manual verification will be required'
          ]
        };
      }

      // Check required documents
      const missingRequirements: string[] = [];
      const documentTypes = documents.map(d => d.type);

      for (const requiredDoc of jurisdiction.requiredDocuments) {
        if (!documentTypes.includes(requiredDoc)) {
          missingRequirements.push(`Missing required document: ${requiredDoc}`);
        }
      }

      // Generate warnings
      const warnings: string[] = [];
      if (jurisdiction.supportLevel === 'partial') {
        warnings.push('Partial support - manual verification required');
      }
      if (!jurisdiction.registryAvailable) {
        warnings.push('Registry check not available for this jurisdiction');
      }

      // Generate recommendations
      const recommendations: string[] = [];
      if (missingRequirements.length > 0) {
        recommendations.push('Upload all required documents to proceed');
      }
      if (jurisdiction.specificRequirements) {
        recommendations.push(...jurisdiction.specificRequirements);
      }

      const isValid = missingRequirements.length === 0;

      logger.info('Jurisdiction validation completed', {
        jurisdictionCode,
        isValid,
        missingRequirements: missingRequirements.length,
        supportLevel: jurisdiction.supportLevel
      });

      return {
        isValid,
        jurisdiction,
        missingRequirements,
        warnings,
        recommendations
      };
    } catch (error: any) {
      logger.error('Failed to validate jurisdiction', {
        error: error.message,
        jurisdictionCode
      });

      throw error;
    }
  }

  /**
   * Get jurisdiction by code
   */
  getJurisdiction(code: string): JurisdictionRules | undefined {
    return this.jurisdictions.get(code.toUpperCase());
  }

  /**
   * Get all supported jurisdictions
   */
  getAllJurisdictions(): JurisdictionRules[] {
    return Array.from(this.jurisdictions.values());
  }

  /**
   * Get jurisdictions by support level
   */
  getJurisdictionsBySupport(
    supportLevel: 'full' | 'partial' | 'limited'
  ): JurisdictionRules[] {
    return Array.from(this.jurisdictions.values())
      .filter(j => j.supportLevel === supportLevel);
  }

  /**
   * Check if jurisdiction is supported
   */
  isSupported(code: string): boolean {
    return this.jurisdictions.has(code.toUpperCase());
  }

  /**
   * Get registry URL for jurisdiction
   */
  getRegistryUrl(code: string): string | undefined {
    const jurisdiction = this.jurisdictions.get(code.toUpperCase());
    return jurisdiction?.registryUrl;
  }

  /**
   * Validate jurisdiction code format
   */
  validateJurisdictionCode(code: string): {
    isValid: boolean;
    normalized?: string;
    error?: string;
  } {
    // Check if code is 2-letter ISO format
    if (!/^[A-Z]{2}$/i.test(code)) {
      return {
        isValid: false,
        error: 'Jurisdiction code must be 2-letter ISO format (e.g., US, UK, CA)'
      };
    }

    const normalized = code.toUpperCase();

    return {
      isValid: true,
      normalized
    };
  }

  /**
   * Get jurisdiction-specific loan limits
   */
  getJurisdictionLoanLimits(code: string): {
    minLoanAmount: number;
    maxLoanAmount: number;
    maxLTV: number;
    currency: string;
  } {
    const jurisdiction = this.jurisdictions.get(code.toUpperCase());

    // Default limits
    const defaults = {
      minLoanAmount: 10000,
      maxLoanAmount: 10000000,
      maxLTV: 0.7,
      currency: 'USD'
    };

    if (!jurisdiction) {
      return defaults;
    }

    // Jurisdiction-specific limits
    switch (jurisdiction.code) {
      case 'US':
        return {
          minLoanAmount: 10000,
          maxLoanAmount: 50000000,
          maxLTV: 0.75,
          currency: 'USD'
        };
      case 'UK':
        return {
          minLoanAmount: 10000,
          maxLoanAmount: 40000000,
          maxLTV: 0.70,
          currency: 'GBP'
        };
      case 'SG':
        return {
          minLoanAmount: 15000,
          maxLoanAmount: 30000000,
          maxLTV: 0.75,
          currency: 'SGD'
        };
      default:
        return defaults;
    }
  }
}
