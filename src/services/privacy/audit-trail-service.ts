/**
 * Privacy-Preserving Audit Trail Service
 * 
 * Maintains audit trails that separate on-chain facts from off-chain personal data.
 * Ensures auditability while protecting user privacy.
 * 
 * Requirements: 9.3, 9.5
 */

import { PseudonymousIdService } from './pseudonymous-id-service';
import { DataClassificationService, DataSensitivity } from './data-classification-service';

export enum AuditEventType {
  // Authentication events
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  SESSION_CREATED = 'session_created',
  SESSION_EXPIRED = 'session_expired',
  
  // Asset events
  ASSET_UPLOADED = 'asset_uploaded',
  ASSET_VERIFIED = 'asset_verified',
  ASSET_REJECTED = 'asset_rejected',
  ATTESTATION_MINTED = 'attestation_minted',
  
  // Loan events
  LOAN_REQUESTED = 'loan_requested',
  LOAN_APPROVED = 'loan_approved',
  LOAN_DISBURSED = 'loan_disbursed',
  LOAN_REPAID = 'loan_repaid',
  LOAN_DEFAULTED = 'loan_defaulted',
  
  // Capability events
  CAPABILITY_ISSUED = 'capability_issued',
  CAPABILITY_REVOKED = 'capability_revoked',
  CAPABILITY_EXPIRED = 'capability_expired',
  
  // Crypto vault events
  VAULT_CREATED = 'vault_created',
  VAULT_DEPOSITED = 'vault_deposited',
  VAULT_WITHDRAWN = 'vault_withdrawn',
  VAULT_LIQUIDATED = 'vault_liquidated',
  
  // Fraud events
  FRAUD_DETECTED = 'fraud_detected',
  ACCOUNT_FROZEN = 'account_frozen',
  ACCOUNT_UNFROZEN = 'account_unfrozen',
  
  // Privacy events
  DATA_ACCESSED = 'data_accessed',
  DATA_EXPORTED = 'data_exported',
  DATA_DELETED = 'data_deleted',
  CONSENT_GRANTED = 'consent_granted',
  CONSENT_REVOKED = 'consent_revoked'
}

export interface AuditEvent {
  eventId: string;
  eventType: AuditEventType;
  timestamp: Date;
  
  // Pseudonymous identifiers (can be on-chain)
  actorPseudonymousId: string;
  targetPseudonymousId?: string;
  
  // On-chain data (facts and commitments)
  onChainData: {
    transactionHash?: string;
    blockNumber?: number;
    objectId?: string;
    eventHash: string; // Hash of the event for verification
  };
  
  // Off-chain data (personal and sensitive)
  offChainData: {
    actorRealId?: string; // Stored encrypted
    targetRealId?: string; // Stored encrypted
    ipAddress?: string;
    userAgent?: string;
    geolocation?: {
      country?: string;
      region?: string;
    };
    details: Record<string, any>;
  };
  
  // Metadata
  sensitivity: DataSensitivity;
  requiresConsent: boolean;
  retentionPeriodDays?: number;
}

export interface AuditTrailQuery {
  eventTypes?: AuditEventType[];
  pseudonymousId?: string;
  startDate?: Date;
  endDate?: Date;
  sensitivity?: DataSensitivity;
  includeOffChainData?: boolean; // Requires special permission
}

export interface AuditTrailSummary {
  totalEvents: number;
  eventsByType: Record<string, number>;
  dateRange: {
    earliest: Date;
    latest: Date;
  };
  uniqueActors: number;
}

/**
 * Privacy-Preserving Audit Trail Service
 */
export class AuditTrailService {
  private static readonly SECRET_KEY = process.env.AUDIT_SECRET_KEY || 'default-secret-key-change-in-production';

  /**
   * Create an audit event with proper data separation
   */
  static createAuditEvent(
    eventType: AuditEventType,
    actorRealId: string,
    data: {
      targetRealId?: string;
      onChainData?: Partial<AuditEvent['onChainData']>;
      offChainData?: Partial<AuditEvent['offChainData']>;
      sensitivity?: DataSensitivity;
      requiresConsent?: boolean;
    }
  ): AuditEvent {
    const eventId = PseudonymousIdService.generatePseudonymousId('session');
    const timestamp = new Date();
    
    // Generate pseudonymous IDs for actors
    const actorPseudonymousId = PseudonymousIdService.generateDeterministicId(
      actorRealId,
      'user',
      this.SECRET_KEY
    );
    
    const targetPseudonymousId = data.targetRealId
      ? PseudonymousIdService.generateDeterministicId(
          data.targetRealId,
          'user',
          this.SECRET_KEY
        )
      : undefined;
    
    // Create event hash for on-chain verification
    const eventHash = this.createEventHash({
      eventId,
      eventType,
      timestamp,
      actorPseudonymousId,
      targetPseudonymousId
    });
    
    return {
      eventId,
      eventType,
      timestamp,
      actorPseudonymousId,
      targetPseudonymousId,
      onChainData: {
        ...data.onChainData,
        eventHash
      },
      offChainData: {
        actorRealId,
        targetRealId: data.targetRealId,
        ...data.offChainData,
        details: data.offChainData?.details || {}
      },
      sensitivity: data.sensitivity || DataSensitivity.INTERNAL,
      requiresConsent: data.requiresConsent || false,
      retentionPeriodDays: this.getRetentionPeriod(eventType)
    };
  }

  /**
   * Create a hash of the event for on-chain verification
   */
  private static createEventHash(data: {
    eventId: string;
    eventType: AuditEventType;
    timestamp: Date;
    actorPseudonymousId: string;
    targetPseudonymousId?: string;
  }): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    
    hash.update(data.eventId);
    hash.update(data.eventType);
    hash.update(data.timestamp.toISOString());
    hash.update(data.actorPseudonymousId);
    if (data.targetPseudonymousId) {
      hash.update(data.targetPseudonymousId);
    }
    
    return hash.digest('hex');
  }

  /**
   * Verify event hash integrity
   */
  static verifyEventHash(event: AuditEvent): boolean {
    const expectedHash = this.createEventHash({
      eventId: event.eventId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      actorPseudonymousId: event.actorPseudonymousId,
      targetPseudonymousId: event.targetPseudonymousId
    });
    
    return event.onChainData.eventHash === expectedHash;
  }

  /**
   * Get on-chain portion of audit event (safe for blockchain)
   */
  static getOnChainAuditData(event: AuditEvent): {
    eventId: string;
    eventType: AuditEventType;
    timestamp: Date;
    actorPseudonymousId: string;
    targetPseudonymousId?: string;
    eventHash: string;
    transactionHash?: string;
    blockNumber?: number;
    objectId?: string;
  } {
    return {
      eventId: event.eventId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      actorPseudonymousId: event.actorPseudonymousId,
      targetPseudonymousId: event.targetPseudonymousId,
      eventHash: event.onChainData.eventHash,
      transactionHash: event.onChainData.transactionHash,
      blockNumber: event.onChainData.blockNumber,
      objectId: event.onChainData.objectId
    };
  }

  /**
   * Get off-chain portion of audit event (requires authorization)
   */
  static getOffChainAuditData(
    event: AuditEvent,
    requestorId: string,
    purpose: string
  ): AuditEvent['offChainData'] | null {
    // Log access to off-chain data
    this.logDataAccess(event.eventId, requestorId, purpose);
    
    // Check if requestor has permission (simplified - should check actual permissions)
    if (!this.hasPermissionToAccessOffChainData(requestorId, event.sensitivity)) {
      return null;
    }
    
    return event.offChainData;
  }

  /**
   * Check if requestor has permission to access off-chain data
   */
  private static hasPermissionToAccessOffChainData(
    requestorId: string,
    sensitivity: DataSensitivity
  ): boolean {
    // Simplified permission check
    // In production, this should check against actual role-based permissions
    return true; // Placeholder
  }

  /**
   * Log access to sensitive data
   */
  private static logDataAccess(
    eventId: string,
    accessorId: string,
    purpose: string
  ): void {
    // This would be stored in a separate audit log
    console.log(`Data access: Event ${eventId} accessed by ${accessorId} for ${purpose}`);
  }

  /**
   * Get retention period for event type
   */
  private static getRetentionPeriod(eventType: AuditEventType): number {
    const retentionMap: Record<AuditEventType, number> = {
      // Authentication: 90 days
      [AuditEventType.USER_LOGIN]: 90,
      [AuditEventType.USER_LOGOUT]: 90,
      [AuditEventType.SESSION_CREATED]: 90,
      [AuditEventType.SESSION_EXPIRED]: 90,
      
      // Financial: 7 years (2555 days) for compliance
      [AuditEventType.LOAN_REQUESTED]: 2555,
      [AuditEventType.LOAN_APPROVED]: 2555,
      [AuditEventType.LOAN_DISBURSED]: 2555,
      [AuditEventType.LOAN_REPAID]: 2555,
      [AuditEventType.LOAN_DEFAULTED]: 2555,
      
      // Asset: 7 years
      [AuditEventType.ASSET_UPLOADED]: 2555,
      [AuditEventType.ASSET_VERIFIED]: 2555,
      [AuditEventType.ASSET_REJECTED]: 2555,
      [AuditEventType.ATTESTATION_MINTED]: 2555,
      
      // Capability: 1 year
      [AuditEventType.CAPABILITY_ISSUED]: 365,
      [AuditEventType.CAPABILITY_REVOKED]: 365,
      [AuditEventType.CAPABILITY_EXPIRED]: 365,
      
      // Vault: 7 years
      [AuditEventType.VAULT_CREATED]: 2555,
      [AuditEventType.VAULT_DEPOSITED]: 2555,
      [AuditEventType.VAULT_WITHDRAWN]: 2555,
      [AuditEventType.VAULT_LIQUIDATED]: 2555,
      
      // Fraud: 10 years (3650 days)
      [AuditEventType.FRAUD_DETECTED]: 3650,
      [AuditEventType.ACCOUNT_FROZEN]: 3650,
      [AuditEventType.ACCOUNT_UNFROZEN]: 3650,
      
      // Privacy: 7 years for compliance
      [AuditEventType.DATA_ACCESSED]: 2555,
      [AuditEventType.DATA_EXPORTED]: 2555,
      [AuditEventType.DATA_DELETED]: 2555,
      [AuditEventType.CONSENT_GRANTED]: 2555,
      [AuditEventType.CONSENT_REVOKED]: 2555
    };
    
    return retentionMap[eventType] || 365; // Default 1 year
  }

  /**
   * Create audit trail summary (privacy-preserving)
   */
  static createAuditTrailSummary(events: AuditEvent[]): AuditTrailSummary {
    const eventsByType: Record<string, number> = {};
    const uniqueActors = new Set<string>();
    
    let earliest = new Date();
    let latest = new Date(0);
    
    for (const event of events) {
      // Count by type
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      
      // Track unique actors (pseudonymous)
      uniqueActors.add(event.actorPseudonymousId);
      
      // Track date range
      if (event.timestamp < earliest) earliest = event.timestamp;
      if (event.timestamp > latest) latest = event.timestamp;
    }
    
    return {
      totalEvents: events.length,
      eventsByType,
      dateRange: {
        earliest,
        latest
      },
      uniqueActors: uniqueActors.size
    };
  }

  /**
   * Filter events that should be expired based on retention policy
   */
  static getExpiredEvents(events: AuditEvent[]): AuditEvent[] {
    const now = new Date();
    
    return events.filter(event => {
      if (!event.retentionPeriodDays) return false;
      
      const expirationDate = new Date(event.timestamp);
      expirationDate.setDate(expirationDate.getDate() + event.retentionPeriodDays);
      
      return now > expirationDate;
    });
  }

  /**
   * Anonymize audit event (remove all linkable data)
   */
  static anonymizeAuditEvent(event: AuditEvent): Partial<AuditEvent> {
    return {
      eventId: event.eventId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      onChainData: {
        eventHash: event.onChainData.eventHash,
        transactionHash: event.onChainData.transactionHash,
        blockNumber: event.onChainData.blockNumber
      },
      sensitivity: event.sensitivity
    };
  }

  /**
   * Create privacy-preserving audit report
   */
  static createPrivacyPreservingReport(
    events: AuditEvent[],
    includeDetails: boolean = false
  ): {
    summary: AuditTrailSummary;
    events: Array<Partial<AuditEvent>>;
  } {
    const summary = this.createAuditTrailSummary(events);
    const reportEvents = includeDetails
      ? events.map(e => this.getOnChainAuditData(e))
      : events.map(e => this.anonymizeAuditEvent(e));
    
    return {
      summary,
      events: reportEvents
    };
  }
}
