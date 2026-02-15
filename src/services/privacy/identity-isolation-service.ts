/**
 * Identity Isolation Service
 * 
 * Ensures that on-chain objects and transactions cannot be linked to
 * real-world identities without access to off-chain mapping.
 * 
 * Requirements: 9.1, 9.2, 9.4, 9.5
 */

import { PseudonymousIdService } from './pseudonymous-id-service';
import { DataClassificationService } from './data-classification-service';
import * as crypto from 'crypto';

export interface IsolatedIdentity {
  // Off-chain (encrypted storage)
  realIdentity: {
    userId: string;
    email?: string;
    phoneNumber?: string;
    name?: string;
    kycData?: Record<string, any>;
  };
  
  // On-chain (public)
  pseudonymousIdentity: {
    userAccountObjectId: string;
    capabilityIds: string[];
    attestationIds: string[];
  };
  
  // Mapping (encrypted, access-controlled)
  mapping: {
    mappingId: string;
    createdAt: Date;
    lastAccessedAt?: Date;
    accessLog: Array<{
      accessedBy: string;
      accessedAt: Date;
      purpose: string;
      approved: boolean;
    }>;
  };
}

export interface IdentityIsolationPolicy {
  allowCrossReference: boolean;
  requiresConsent: boolean;
  auditAllAccess: boolean;
  encryptionRequired: boolean;
  retentionPeriodDays: number;
}

export interface IsolationViolation {
  violationType: 'pii_on_chain' | 'identity_linkage' | 'unauthorized_access' | 'consent_missing';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  affectedData: string[];
}

/**
 * Identity Isolation Service
 * Maintains strict separation between on-chain and off-chain identities
 */
export class IdentityIsolationService {
  private static readonly ENCRYPTION_KEY = process.env.IDENTITY_ENCRYPTION_KEY || 'default-key-change-in-production';
  private static readonly MAPPING_SECRET = process.env.MAPPING_SECRET_KEY || 'default-mapping-secret';

  /**
   * Create an isolated identity with proper separation
   */
  static createIsolatedIdentity(
    realUserId: string,
    userData: {
      email?: string;
      phoneNumber?: string;
      name?: string;
      kycData?: Record<string, any>;
    }
  ): IsolatedIdentity {
    // Generate pseudonymous on-chain identifier
    const userAccountObjectId = PseudonymousIdService.generatePseudonymousId('user');
    
    // Create mapping ID (encrypted reference)
    const mappingId = this.createSecureMapping(realUserId, userAccountObjectId);
    
    return {
      realIdentity: {
        userId: realUserId,
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        name: userData.name,
        kycData: userData.kycData
      },
      pseudonymousIdentity: {
        userAccountObjectId,
        capabilityIds: [],
        attestationIds: []
      },
      mapping: {
        mappingId,
        createdAt: new Date(),
        accessLog: []
      }
    };
  }

  /**
   * Create a secure mapping between real and pseudonymous IDs
   */
  private static createSecureMapping(realId: string, pseudonymousId: string): string {
    const hmac = crypto.createHmac('sha256', this.MAPPING_SECRET);
    hmac.update(realId);
    hmac.update(pseudonymousId);
    hmac.update(Date.now().toString());
    return hmac.digest('hex');
  }

  /**
   * Resolve pseudonymous ID to real ID (requires authorization)
   */
  static resolvePseudonymousId(
    pseudonymousId: string,
    requestorId: string,
    purpose: string,
    isolatedIdentity: IsolatedIdentity
  ): string | null {
    // Log access attempt
    isolatedIdentity.mapping.accessLog.push({
      accessedBy: requestorId,
      accessedAt: new Date(),
      purpose,
      approved: false
    });
    
    // Check authorization (simplified - should use proper RBAC)
    if (!this.isAuthorizedToResolve(requestorId, purpose)) {
      return null;
    }
    
    // Mark as approved
    isolatedIdentity.mapping.accessLog[isolatedIdentity.mapping.accessLog.length - 1].approved = true;
    isolatedIdentity.mapping.lastAccessedAt = new Date();
    
    return isolatedIdentity.realIdentity.userId;
  }

  /**
   * Check if requestor is authorized to resolve identity
   */
  private static isAuthorizedToResolve(requestorId: string, purpose: string): boolean {
    // Simplified authorization check
    // In production, this should check against proper RBAC policies
    const validPurposes = [
      'fraud_investigation',
      'compliance_audit',
      'legal_requirement',
      'user_support',
      'recovery_process'
    ];
    
    return validPurposes.includes(purpose);
  }

  /**
   * Validate that data doesn't violate isolation policy
   */
  static validateIsolation(
    data: Record<string, any>,
    context: 'on_chain' | 'off_chain'
  ): {
    valid: boolean;
    violations: IsolationViolation[];
  } {
    const violations: IsolationViolation[] = [];
    
    if (context === 'on_chain') {
      // Check for PII in on-chain data
      const piiFields = [
        'email', 'phoneNumber', 'firstName', 'lastName', 'ssn',
        'dateOfBirth', 'address', 'creditScore', 'internalScore'
      ];
      
      for (const field of piiFields) {
        if (data[field] !== undefined) {
          violations.push({
            violationType: 'pii_on_chain',
            severity: 'critical',
            description: `PII field '${field}' found in on-chain data`,
            detectedAt: new Date(),
            affectedData: [field]
          });
        }
      }
      
      // Check for identity linkage patterns
      if (data.email && data.userAccountObjectId) {
        violations.push({
          violationType: 'identity_linkage',
          severity: 'high',
          description: 'Email and on-chain ID found together',
          detectedAt: new Date(),
          affectedData: ['email', 'userAccountObjectId']
        });
      }
    }
    
    return {
      valid: violations.length === 0,
      violations
    };
  }

  /**
   * Sanitize data for on-chain storage
   */
  static sanitizeForOnChain(data: Record<string, any>): {
    sanitized: Record<string, any>;
    removed: string[];
  } {
    const classified = DataClassificationService.classifyData(data);
    const removed: string[] = [];
    
    // Only include data that can be on-chain
    for (const key of Object.keys(data)) {
      if (!DataClassificationService.canBeOnChain(key)) {
        removed.push(key);
      }
    }
    
    return {
      sanitized: classified.onChainData,
      removed
    };
  }

  /**
   * Create capability-scoped identity
   * Different pseudonymous ID for each capability to prevent correlation
   */
  static createCapabilityScopedIdentity(
    realUserId: string,
    capabilityType: string
  ): {
    capabilityId: string;
    scopedPseudonymousId: string;
  } {
    const capabilityId = PseudonymousIdService.generateCapabilityScopedId(
      realUserId,
      capabilityType,
      this.MAPPING_SECRET
    );
    
    const scopedPseudonymousId = PseudonymousIdService.generateDeterministicId(
      `${realUserId}:${capabilityType}`,
      'capability',
      this.MAPPING_SECRET
    );
    
    return {
      capabilityId,
      scopedPseudonymousId
    };
  }

  /**
   * Create session-specific identity
   * Changes with each session to prevent tracking
   */
  static createSessionIdentity(
    realUserId: string,
    sessionId: string
  ): {
    sessionPseudonymousId: string;
    expiresAt: Date;
  } {
    const sessionPseudonymousId = PseudonymousIdService.generateSessionPseudonymousId(
      realUserId,
      sessionId,
      this.MAPPING_SECRET
    );
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session
    
    return {
      sessionPseudonymousId,
      expiresAt
    };
  }

  /**
   * Encrypt sensitive identity data
   */
  static encryptIdentityData(data: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt sensitive identity data
   */
  static decryptIdentityData(encryptedData: string): string | null {
    try {
      const algorithm = 'aes-256-gcm';
      const key = crypto.scryptSync(this.ENCRYPTION_KEY, 'salt', 32);
      
      const parts = encryptedData.split(':');
      if (parts.length !== 3) return null;
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create privacy-preserving transaction data
   */
  static createPrivacyPreservingTransaction(
    realUserId: string,
    transactionData: Record<string, any>
  ): {
    onChainData: Record<string, any>;
    offChainData: Record<string, any>;
    pseudonymousId: string;
  } {
    // Generate pseudonymous ID for transaction
    const pseudonymousId = PseudonymousIdService.generateDeterministicId(
      realUserId,
      'user',
      this.MAPPING_SECRET
    );
    
    // Classify and separate data
    const classified = DataClassificationService.classifyData(transactionData);
    
    return {
      onChainData: {
        ...classified.onChainData,
        actorId: pseudonymousId
      },
      offChainData: {
        ...classified.offChainData,
        realUserId
      },
      pseudonymousId
    };
  }

  /**
   * Audit identity isolation compliance
   */
  static auditIsolationCompliance(
    isolatedIdentity: IsolatedIdentity
  ): {
    compliant: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check if real identity data is properly isolated
    if (!isolatedIdentity.realIdentity.userId) {
      issues.push('Missing real user ID in isolated identity');
    }
    
    // Check if pseudonymous identity is properly generated
    if (!isolatedIdentity.pseudonymousIdentity.userAccountObjectId) {
      issues.push('Missing pseudonymous user account object ID');
    }
    
    // Check if mapping is secure
    if (!isolatedIdentity.mapping.mappingId) {
      issues.push('Missing secure mapping ID');
    }
    
    // Check access log
    if (isolatedIdentity.mapping.accessLog.length === 0) {
      recommendations.push('No access log entries - ensure logging is enabled');
    }
    
    // Check for unauthorized access attempts
    const unauthorizedAccess = isolatedIdentity.mapping.accessLog.filter(
      log => !log.approved
    );
    if (unauthorizedAccess.length > 0) {
      issues.push(`${unauthorizedAccess.length} unauthorized access attempts detected`);
    }
    
    return {
      compliant: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Get isolation policy for data type
   */
  static getIsolationPolicy(dataType: string): IdentityIsolationPolicy {
    const policies: Record<string, IdentityIsolationPolicy> = {
      'pii': {
        allowCrossReference: false,
        requiresConsent: true,
        auditAllAccess: true,
        encryptionRequired: true,
        retentionPeriodDays: 2555 // 7 years
      },
      'financial': {
        allowCrossReference: false,
        requiresConsent: false,
        auditAllAccess: true,
        encryptionRequired: true,
        retentionPeriodDays: 2555
      },
      'pseudonymous': {
        allowCrossReference: true,
        requiresConsent: false,
        auditAllAccess: false,
        encryptionRequired: false,
        retentionPeriodDays: 365
      },
      'public': {
        allowCrossReference: true,
        requiresConsent: false,
        auditAllAccess: false,
        encryptionRequired: false,
        retentionPeriodDays: 365
      }
    };
    
    return policies[dataType] || policies['pii']; // Default to strictest policy
  }
}
