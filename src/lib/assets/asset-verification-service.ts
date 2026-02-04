import { DocumentMetadata } from './document-upload-service';

export interface AssetVerificationResult {
  confidenceScore: number;
  verificationStatus: 'verified' | 'pending' | 'rejected' | 'manual_review';
  verificationDetails: VerificationDetails;
  jurisdictionCompliance: JurisdictionCompliance;
  registryChecks: RegistryCheckResult[];
}

export interface VerificationDetails {
  documentQuality: number;
  metadataCompleteness: number;
  registryMatch: number;
  jurisdictionCompliance: number;
  duplicateCheck: boolean;
  manualOverride?: {
    applied: boolean;
    reason: string;
    approvedBy: string;
    approvedAt: Date;
  };
}

export interface JurisdictionCompliance {
  jurisdiction: string;
  compliant: boolean;
  requiredDocuments: string[];
  providedDocuments: string[];
  missingDocuments: string[];
  additionalRequirements?: string[];
}

export interface RegistryCheckResult {
  registryName: string;
  available: boolean;
  matched: boolean;
  confidence: number;
  details?: Record<string, any>;
  error?: string;
}

export interface AssetDetails {
  assetType: 'real_estate' | 'vehicle' | 'equipment' | 'intellectual_property' | 'other';
  jurisdiction: string;
  documentHash: string;
  metadata: DocumentMetadata;
  extractedData?: Record<string, any>;
}

export class AssetVerificationService {
  private readonly CONFIDENCE_THRESHOLDS = {
    AUTO_APPROVE: 85,
    MANUAL_REVIEW: 60,
    AUTO_REJECT: 30
  };

  private readonly JURISDICTION_RULES = {
    'US': {
      real_estate: ['deed', 'title_insurance', 'property_tax_record'],
      vehicle: ['title', 'registration', 'insurance'],
      equipment: ['purchase_receipt', 'warranty', 'appraisal'],
      intellectual_property: ['patent_certificate', 'trademark_registration', 'copyright_notice']
    },
    'UK': {
      real_estate: ['land_registry', 'property_deed', 'council_tax_record'],
      vehicle: ['v5c_logbook', 'mot_certificate', 'insurance_certificate'],
      equipment: ['purchase_invoice', 'warranty_certificate', 'valuation_report']
    },
    'CA': {
      real_estate: ['property_deed', 'land_title', 'property_assessment'],
      vehicle: ['vehicle_registration', 'ownership_certificate', 'insurance_proof'],
      equipment: ['purchase_receipt', 'warranty_document', 'appraisal_report']
    }
  };

  /**
   * Verify asset and calculate confidence score
   */
  async verifyAsset(assetDetails: AssetDetails): Promise<AssetVerificationResult> {
    // Run all verification checks in parallel
    const [
      documentQuality,
      metadataCompleteness,
      registryChecks,
      jurisdictionCompliance,
      duplicateCheck
    ] = await Promise.all([
      this.assessDocumentQuality(assetDetails),
      this.assessMetadataCompleteness(assetDetails),
      this.performRegistryChecks(assetDetails),
      this.checkJurisdictionCompliance(assetDetails),
      this.checkForDuplicates(assetDetails.documentHash)
    ]);

    // Calculate registry match score
    const registryMatch = this.calculateRegistryMatchScore(registryChecks);

    // Calculate overall confidence score
    const confidenceScore = this.calculateConfidenceScore({
      documentQuality,
      metadataCompleteness,
      registryMatch,
      jurisdictionCompliance: jurisdictionCompliance.compliant ? 100 : 50,
      duplicateCheck: !duplicateCheck
    });

    // Determine verification status
    const verificationStatus = this.determineVerificationStatus(confidenceScore, jurisdictionCompliance);

    return {
      confidenceScore,
      verificationStatus,
      verificationDetails: {
        documentQuality,
        metadataCompleteness,
        registryMatch,
        jurisdictionCompliance: jurisdictionCompliance.compliant ? 100 : 50,
        duplicateCheck: !duplicateCheck
      },
      jurisdictionCompliance,
      registryChecks
    };
  }

  /**
   * Assess document quality based on file characteristics
   */
  private async assessDocumentQuality(assetDetails: AssetDetails): Promise<number> {
    let score = 0;
    const metadata = assetDetails.metadata;

    // File size check (not too small, not too large)
    if (metadata.size > 10000 && metadata.size < 10 * 1024 * 1024) {
      score += 25;
    } else if (metadata.size > 1000) {
      score += 15;
    }

    // File type appropriateness
    const appropriateTypes = this.getAppropriateFileTypes(assetDetails.assetType);
    if (appropriateTypes.includes(metadata.mimeType)) {
      score += 25;
    }

    // Metadata extraction success
    if (metadata.extractedData && Object.keys(metadata.extractedData).length > 0) {
      score += 25;
    }

    // File integrity (no extraction errors)
    if (!metadata.extractedData?.extractionError) {
      score += 25;
    }

    return Math.min(score, 100);
  }

  /**
   * Assess completeness of extracted metadata
   */
  private async assessMetadataCompleteness(assetDetails: AssetDetails): Promise<number> {
    let score = 0;
    const extractedData = assetDetails.extractedData || {};

    // Basic metadata presence
    if (Object.keys(extractedData).length > 0) {
      score += 30;
    }

    // Asset type specific metadata
    switch (assetDetails.assetType) {
      case 'real_estate':
        if (this.hasRealEstateMetadata(extractedData)) score += 40;
        break;
      case 'vehicle':
        if (this.hasVehicleMetadata(extractedData)) score += 40;
        break;
      case 'equipment':
        if (this.hasEquipmentMetadata(extractedData)) score += 40;
        break;
      default:
        score += 20; // Generic bonus for having any metadata
    }

    // Rich metadata bonus
    if (Object.keys(extractedData).length > 5) {
      score += 30;
    }

    return Math.min(score, 100);
  }

  /**
   * Perform registry checks where available
   */
  private async performRegistryChecks(assetDetails: AssetDetails): Promise<RegistryCheckResult[]> {
    const results: RegistryCheckResult[] = [];

    switch (assetDetails.assetType) {
      case 'real_estate':
        results.push(...await this.checkRealEstateRegistries(assetDetails));
        break;
      case 'vehicle':
        results.push(...await this.checkVehicleRegistries(assetDetails));
        break;
      case 'intellectual_property':
        results.push(...await this.checkIPRegistries(assetDetails));
        break;
      default:
        // No specific registries for other asset types
        results.push({
          registryName: 'generic',
          available: false,
          matched: false,
          confidence: 0,
          details: { message: 'No specific registries available for this asset type' }
        });
    }

    return results;
  }

  /**
   * Check jurisdiction-specific compliance requirements
   */
  private async checkJurisdictionCompliance(assetDetails: AssetDetails): Promise<JurisdictionCompliance> {
    const jurisdiction = assetDetails.jurisdiction.toUpperCase();
    const assetType = assetDetails.assetType;
    
    const rules = this.JURISDICTION_RULES[jurisdiction as keyof typeof this.JURISDICTION_RULES];
    
    if (!rules) {
      return {
        jurisdiction,
        compliant: false,
        requiredDocuments: [],
        providedDocuments: [],
        missingDocuments: [],
        additionalRequirements: [`Jurisdiction ${jurisdiction} not supported`]
      };
    }

    const requiredDocuments = rules[assetType] || [];
    const providedDocuments = this.identifyProvidedDocuments(assetDetails);
    const missingDocuments = requiredDocuments.filter(doc => !providedDocuments.includes(doc));

    return {
      jurisdiction,
      compliant: missingDocuments.length === 0,
      requiredDocuments,
      providedDocuments,
      missingDocuments,
      additionalRequirements: this.getAdditionalRequirements(jurisdiction, assetType)
    };
  }

  /**
   * Check for duplicate documents using hash
   */
  private async checkForDuplicates(documentHash: string): Promise<boolean> {
    // This would integrate with the document upload service
    // For now, return false (no duplicates found)
    return false;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidenceScore(scores: {
    documentQuality: number;
    metadataCompleteness: number;
    registryMatch: number;
    jurisdictionCompliance: number;
    duplicateCheck: boolean;
  }): number {
    const weights = {
      documentQuality: 0.2,
      metadataCompleteness: 0.2,
      registryMatch: 0.3,
      jurisdictionCompliance: 0.25,
      duplicateCheck: 0.05
    };

    let weightedScore = 0;
    weightedScore += scores.documentQuality * weights.documentQuality;
    weightedScore += scores.metadataCompleteness * weights.metadataCompleteness;
    weightedScore += scores.registryMatch * weights.registryMatch;
    weightedScore += scores.jurisdictionCompliance * weights.jurisdictionCompliance;
    weightedScore += (scores.duplicateCheck ? 100 : 0) * weights.duplicateCheck;

    return Math.round(weightedScore);
  }

  /**
   * Determine verification status based on confidence score
   */
  private determineVerificationStatus(
    confidenceScore: number, 
    jurisdictionCompliance: JurisdictionCompliance
  ): 'verified' | 'pending' | 'rejected' | 'manual_review' {
    if (!jurisdictionCompliance.compliant) {
      return 'manual_review';
    }

    if (confidenceScore >= this.CONFIDENCE_THRESHOLDS.AUTO_APPROVE) {
      return 'verified';
    } else if (confidenceScore >= this.CONFIDENCE_THRESHOLDS.MANUAL_REVIEW) {
      return 'manual_review';
    } else if (confidenceScore >= this.CONFIDENCE_THRESHOLDS.AUTO_REJECT) {
      return 'pending';
    } else {
      return 'rejected';
    }
  }

  /**
   * Apply manual override to verification result
   */
  async applyManualOverride(
    verificationResult: AssetVerificationResult,
    override: {
      newStatus: 'verified' | 'rejected';
      reason: string;
      approvedBy: string;
    }
  ): Promise<AssetVerificationResult> {
    return {
      ...verificationResult,
      verificationStatus: override.newStatus,
      verificationDetails: {
        ...verificationResult.verificationDetails,
        manualOverride: {
          applied: true,
          reason: override.reason,
          approvedBy: override.approvedBy,
          approvedAt: new Date()
        }
      }
    };
  }

  // Helper methods

  private getAppropriateFileTypes(assetType: string): string[] {
    const typeMap = {
      real_estate: ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'],
      vehicle: ['application/pdf', 'image/jpeg', 'image/png'],
      equipment: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'],
      intellectual_property: ['application/pdf', 'text/plain'],
      other: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain']
    };
    return typeMap[assetType as keyof typeof typeMap] || typeMap.other;
  }

  private hasRealEstateMetadata(data: Record<string, any>): boolean {
    // Check for real estate specific metadata
    return !!(data.pdfInfo || data.imageInfo) && Object.keys(data).length > 1;
  }

  private hasVehicleMetadata(data: Record<string, any>): boolean {
    // Check for vehicle specific metadata
    return !!(data.pdfInfo || data.imageInfo) && Object.keys(data).length > 1;
  }

  private hasEquipmentMetadata(data: Record<string, any>): boolean {
    // Check for equipment specific metadata
    return Object.keys(data).length > 0;
  }

  private calculateRegistryMatchScore(registryChecks: RegistryCheckResult[]): number {
    if (registryChecks.length === 0) return 50; // Neutral score if no registries available

    const availableChecks = registryChecks.filter(check => check.available);
    if (availableChecks.length === 0) return 50;

    const totalConfidence = availableChecks.reduce((sum, check) => sum + check.confidence, 0);
    return Math.round(totalConfidence / availableChecks.length);
  }

  private identifyProvidedDocuments(assetDetails: AssetDetails): string[] {
    // Analyze filename and metadata to identify document types
    const filename = assetDetails.metadata.filename.toLowerCase();
    const identified: string[] = [];

    // Simple keyword matching - in production would use more sophisticated analysis
    if (filename.includes('deed') || filename.includes('title')) {
      identified.push('deed', 'title');
    }
    if (filename.includes('insurance')) {
      identified.push('insurance');
    }
    if (filename.includes('registration')) {
      identified.push('registration');
    }
    if (filename.includes('receipt') || filename.includes('invoice')) {
      identified.push('purchase_receipt');
    }

    return identified;
  }

  private getAdditionalRequirements(jurisdiction: string, assetType: string): string[] {
    // Return jurisdiction-specific additional requirements
    const requirements: string[] = [];
    
    if (jurisdiction === 'US' && assetType === 'real_estate') {
      requirements.push('Property must be located in supported states');
      requirements.push('Property value must be verified within 90 days');
    }
    
    return requirements;
  }

  // Registry check implementations (placeholders)

  private async checkRealEstateRegistries(assetDetails: AssetDetails): Promise<RegistryCheckResult[]> {
    // Placeholder - would integrate with actual property registries
    return [{
      registryName: 'property_registry',
      available: false,
      matched: false,
      confidence: 0,
      details: { message: 'Registry integration not yet implemented' }
    }];
  }

  private async checkVehicleRegistries(assetDetails: AssetDetails): Promise<RegistryCheckResult[]> {
    // Placeholder - would integrate with DMV/DVLA systems
    return [{
      registryName: 'vehicle_registry',
      available: false,
      matched: false,
      confidence: 0,
      details: { message: 'Registry integration not yet implemented' }
    }];
  }

  private async checkIPRegistries(assetDetails: AssetDetails): Promise<RegistryCheckResult[]> {
    // Placeholder - would integrate with USPTO, EUIPO, etc.
    return [{
      registryName: 'ip_registry',
      available: false,
      matched: false,
      confidence: 0,
      details: { message: 'Registry integration not yet implemented' }
    }];
  }
}