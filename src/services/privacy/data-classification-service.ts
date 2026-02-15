/**
 * Data Classification Service
 * 
 * Implements data classification system to separate on-chain and off-chain data
 * according to privacy requirements.
 * 
 * Requirements: 9.1, 9.2
 */

export enum DataClassification {
  ON_CHAIN_PUBLIC = 'on_chain_public',
  ON_CHAIN_PSEUDONYMOUS = 'on_chain_pseudonymous',
  OFF_CHAIN_ENCRYPTED = 'off_chain_encrypted',
  OFF_CHAIN_PRIVATE = 'off_chain_private'
}

export enum DataSensitivity {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted'
}

export interface DataClassificationRule {
  fieldName: string;
  classification: DataClassification;
  sensitivity: DataSensitivity;
  canBeOnChain: boolean;
  requiresEncryption: boolean;
  retentionPeriodDays?: number;
}

export interface ClassifiedData {
  onChainData: Record<string, any>;
  offChainData: Record<string, any>;
  metadata: {
    classification: DataClassification;
    sensitivity: DataSensitivity;
    timestamp: Date;
  };
}

/**
 * Data Classification Service
 * Separates data into on-chain and off-chain categories based on privacy rules
 */
export class DataClassificationService {
  private static classificationRules: Map<string, DataClassificationRule> = new Map([
    // Identity data - NEVER on-chain
    ['email', {
      fieldName: 'email',
      classification: DataClassification.OFF_CHAIN_PRIVATE,
      sensitivity: DataSensitivity.CONFIDENTIAL,
      canBeOnChain: false,
      requiresEncryption: true,
      retentionPeriodDays: 2555 // 7 years for compliance
    }],
    ['phoneNumber', {
      fieldName: 'phoneNumber',
      classification: DataClassification.OFF_CHAIN_PRIVATE,
      sensitivity: DataSensitivity.CONFIDENTIAL,
      canBeOnChain: false,
      requiresEncryption: true,
      retentionPeriodDays: 2555
    }],
    ['firstName', {
      fieldName: 'firstName',
      classification: DataClassification.OFF_CHAIN_PRIVATE,
      sensitivity: DataSensitivity.CONFIDENTIAL,
      canBeOnChain: false,
      requiresEncryption: true
    }],
    ['lastName', {
      fieldName: 'lastName',
      classification: DataClassification.OFF_CHAIN_PRIVATE,
      sensitivity: DataSensitivity.CONFIDENTIAL,
      canBeOnChain: false,
      requiresEncryption: true
    }],
    ['dateOfBirth', {
      fieldName: 'dateOfBirth',
      classification: DataClassification.OFF_CHAIN_PRIVATE,
      sensitivity: DataSensitivity.RESTRICTED,
      canBeOnChain: false,
      requiresEncryption: true
    }],
    ['ssn', {
      fieldName: 'ssn',
      classification: DataClassification.OFF_CHAIN_PRIVATE,
      sensitivity: DataSensitivity.RESTRICTED,
      canBeOnChain: false,
      requiresEncryption: true,
      retentionPeriodDays: 2555
    }],
    
    // Credit data - NEVER on-chain
    ['creditScore', {
      fieldName: 'creditScore',
      classification: DataClassification.OFF_CHAIN_PRIVATE,
      sensitivity: DataSensitivity.RESTRICTED,
      canBeOnChain: false,
      requiresEncryption: true
    }],
    ['internalScore', {
      fieldName: 'internalScore',
      classification: DataClassification.OFF_CHAIN_PRIVATE,
      sensitivity: DataSensitivity.RESTRICTED,
      canBeOnChain: false,
      requiresEncryption: true
    }],
    ['riskBand', {
      fieldName: 'riskBand',
      classification: DataClassification.OFF_CHAIN_PRIVATE,
      sensitivity: DataSensitivity.CONFIDENTIAL,
      canBeOnChain: false,
      requiresEncryption: true
    }],
    
    // Pseudonymous identifiers - CAN be on-chain
    ['internalUserId', {
      fieldName: 'internalUserId',
      classification: DataClassification.ON_CHAIN_PSEUDONYMOUS,
      sensitivity: DataSensitivity.INTERNAL,
      canBeOnChain: true,
      requiresEncryption: false
    }],
    ['userAccountObjectId', {
      fieldName: 'userAccountObjectId',
      classification: DataClassification.ON_CHAIN_PSEUDONYMOUS,
      sensitivity: DataSensitivity.PUBLIC,
      canBeOnChain: true,
      requiresEncryption: false
    }],
    
    // Asset data - Hashes on-chain, details off-chain
    ['documentHash', {
      fieldName: 'documentHash',
      classification: DataClassification.ON_CHAIN_PUBLIC,
      sensitivity: DataSensitivity.PUBLIC,
      canBeOnChain: true,
      requiresEncryption: false
    }],
    ['assetIdHash', {
      fieldName: 'assetIdHash',
      classification: DataClassification.ON_CHAIN_PUBLIC,
      sensitivity: DataSensitivity.PUBLIC,
      canBeOnChain: true,
      requiresEncryption: false
    }],
    ['jurisdictionCode', {
      fieldName: 'jurisdictionCode',
      classification: DataClassification.ON_CHAIN_PUBLIC,
      sensitivity: DataSensitivity.PUBLIC,
      canBeOnChain: true,
      requiresEncryption: false
    }],
    
    // Financial commitments - CAN be on-chain
    ['loanAmount', {
      fieldName: 'loanAmount',
      classification: DataClassification.ON_CHAIN_PUBLIC,
      sensitivity: DataSensitivity.PUBLIC,
      canBeOnChain: true,
      requiresEncryption: false
    }],
    ['interestRate', {
      fieldName: 'interestRate',
      classification: DataClassification.ON_CHAIN_PUBLIC,
      sensitivity: DataSensitivity.PUBLIC,
      canBeOnChain: true,
      requiresEncryption: false
    }],
    ['loanStatus', {
      fieldName: 'loanStatus',
      classification: DataClassification.ON_CHAIN_PUBLIC,
      sensitivity: DataSensitivity.PUBLIC,
      canBeOnChain: true,
      requiresEncryption: false
    }],
    
    // Capabilities - CAN be on-chain
    ['capabilityId', {
      fieldName: 'capabilityId',
      classification: DataClassification.ON_CHAIN_PSEUDONYMOUS,
      sensitivity: DataSensitivity.INTERNAL,
      canBeOnChain: true,
      requiresEncryption: false
    }],
    ['maxBorrowAmount', {
      fieldName: 'maxBorrowAmount',
      classification: DataClassification.ON_CHAIN_PUBLIC,
      sensitivity: DataSensitivity.PUBLIC,
      canBeOnChain: true,
      requiresEncryption: false
    }]
  ]);

  /**
   * Classify data into on-chain and off-chain categories
   */
  static classifyData(data: Record<string, any>): ClassifiedData {
    const onChainData: Record<string, any> = {};
    const offChainData: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      const rule = this.classificationRules.get(key);
      
      if (!rule) {
        // Default: off-chain for unknown fields
        offChainData[key] = value;
        continue;
      }
      
      if (rule.canBeOnChain) {
        onChainData[key] = value;
      } else {
        offChainData[key] = value;
      }
    }
    
    return {
      onChainData,
      offChainData,
      metadata: {
        classification: DataClassification.ON_CHAIN_PSEUDONYMOUS,
        sensitivity: DataSensitivity.INTERNAL,
        timestamp: new Date()
      }
    };
  }

  /**
   * Check if a field can be stored on-chain
   */
  static canBeOnChain(fieldName: string): boolean {
    const rule = this.classificationRules.get(fieldName);
    return rule?.canBeOnChain ?? false;
  }

  /**
   * Check if a field requires encryption
   */
  static requiresEncryption(fieldName: string): boolean {
    const rule = this.classificationRules.get(fieldName);
    return rule?.requiresEncryption ?? true; // Default to encrypted
  }

  /**
   * Get data sensitivity level
   */
  static getSensitivity(fieldName: string): DataSensitivity {
    const rule = this.classificationRules.get(fieldName);
    return rule?.sensitivity ?? DataSensitivity.CONFIDENTIAL;
  }

  /**
   * Get data classification
   */
  static getClassification(fieldName: string): DataClassification {
    const rule = this.classificationRules.get(fieldName);
    return rule?.classification ?? DataClassification.OFF_CHAIN_PRIVATE;
  }

  /**
   * Validate that data doesn't contain PII in on-chain portion
   */
  static validateOnChainData(data: Record<string, any>): {
    valid: boolean;
    violations: string[];
  } {
    const violations: string[] = [];
    
    for (const key of Object.keys(data)) {
      if (!this.canBeOnChain(key)) {
        violations.push(`Field '${key}' cannot be stored on-chain`);
      }
    }
    
    return {
      valid: violations.length === 0,
      violations
    };
  }

  /**
   * Get retention period for a field
   */
  static getRetentionPeriod(fieldName: string): number | undefined {
    const rule = this.classificationRules.get(fieldName);
    return rule?.retentionPeriodDays;
  }

  /**
   * Add custom classification rule
   */
  static addClassificationRule(rule: DataClassificationRule): void {
    this.classificationRules.set(rule.fieldName, rule);
  }

  /**
   * Get all classification rules
   */
  static getAllRules(): Map<string, DataClassificationRule> {
    return new Map(this.classificationRules);
  }
}
