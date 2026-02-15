/**
 * Privacy Services
 * 
 * Implements privacy architecture for Credit OS including:
 * - Data classification (on-chain vs off-chain)
 * - Pseudonymous identifier generation
 * - Privacy-preserving audit trails
 * - Identity isolation mechanisms
 * 
 * Requirements: 9.1, 9.2, 9.4, 9.5
 */

export {
  DataClassificationService,
  DataClassification,
  DataSensitivity,
  type DataClassificationRule,
  type ClassifiedData
} from './data-classification-service';

export {
  PseudonymousIdService,
  type PseudonymousIdentifier,
  type IdentifierMapping
} from './pseudonymous-id-service';

export {
  AuditTrailService,
  AuditEventType,
  type AuditEvent,
  type AuditTrailQuery,
  type AuditTrailSummary
} from './audit-trail-service';

export {
  IdentityIsolationService,
  type IsolatedIdentity,
  type IdentityIsolationPolicy,
  type IsolationViolation
} from './identity-isolation-service';
