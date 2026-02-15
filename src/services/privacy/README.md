# Privacy Architecture Services

This module implements the privacy architecture for Credit OS, ensuring strict separation between on-chain transparency and off-chain privacy.

## Overview

The privacy architecture is built on four core principles:

1. **Data Classification**: Automatic separation of data into on-chain and off-chain categories
2. **Pseudonymous Identifiers**: Cryptographically secure IDs that cannot be linked to real identities
3. **Privacy-Preserving Audit Trails**: Complete auditability without exposing personal data
4. **Identity Isolation**: Strict separation between real-world and on-chain identities

## Requirements

Implements requirements:
- **9.1**: Never place identity, credit scores, or personal information on blockchain
- **9.2**: Store only commitments, capabilities, asset hashes, and jurisdiction codes on-chain
- **9.4**: Use pseudonymous on-chain objects that cannot be linked to real-world identities
- **9.5**: Maintain separate on-chain facts and off-chain personal data with clear boundaries

## Services

### DataClassificationService

Automatically classifies data into on-chain and off-chain categories based on privacy rules.

```typescript
import { DataClassificationService } from './privacy';

// Classify user data
const classified = DataClassificationService.classifyData({
  email: 'user@example.com',           // OFF_CHAIN_PRIVATE
  internalUserId: 'usr_123',           // ON_CHAIN_PSEUDONYMOUS
  creditScore: 750,                    // OFF_CHAIN_PRIVATE
  userAccountObjectId: '0x123...',     // ON_CHAIN_PSEUDONYMOUS
  loanAmount: 10000                    // ON_CHAIN_PUBLIC
});

console.log(classified.onChainData);   // { internalUserId, userAccountObjectId, loanAmount }
console.log(classified.offChainData);  // { email, creditScore }

// Validate on-chain data
const validation = DataClassificationService.validateOnChainData({
  email: 'user@example.com'  // VIOLATION!
});
// validation.valid = false
// validation.violations = ["Field 'email' cannot be stored on-chain"]
```

**Key Features:**
- Automatic data classification based on privacy rules
- Validation to prevent PII on blockchain
- Configurable retention periods
- Encryption requirements per field type

### PseudonymousIdService

Generates cryptographically secure pseudonymous identifiers that cannot be linked to real identities.

```typescript
import { PseudonymousIdService } from './privacy';

// Generate random pseudonymous ID
const userId = PseudonymousIdService.generatePseudonymousId('user');
// Returns: "usr_5KJh8F3mN9pQ2rT7vX4wY6zB1cD8eG"

// Generate deterministic ID (same input = same output)
const deterministicId = PseudonymousIdService.generateDeterministicId(
  'real-user-123',
  'user',
  'secret-key'
);
// Always returns same ID for same inputs

// Generate session-specific ID (changes per session)
const sessionId = PseudonymousIdService.generateSessionPseudonymousId(
  'real-user-123',
  'session-456',
  'secret-key'
);
// Returns different ID for each session

// Generate capability-scoped ID (different per capability)
const capabilityId = PseudonymousIdService.generateCapabilityScopedId(
  'real-user-123',
  'borrowing',
  'secret-key'
);
// Returns different ID for each capability type

// Validate pseudonymous ID
const validation = PseudonymousIdService.validatePseudonymousId(userId);
// { valid: true, type: 'user' }
```

**Key Features:**
- Cryptographically secure random generation
- Deterministic generation for consistent mapping
- Session-specific IDs to prevent tracking
- Capability-scoped IDs to prevent correlation
- Base58 encoding (no ambiguous characters)

### AuditTrailService

Maintains privacy-preserving audit trails that separate on-chain facts from off-chain personal data.

```typescript
import { AuditTrailService, AuditEventType } from './privacy';

// Create audit event
const event = AuditTrailService.createAuditEvent(
  AuditEventType.LOAN_APPROVED,
  'real-user-123',
  {
    targetRealId: 'loan-456',
    onChainData: {
      transactionHash: '0xabc...',
      blockNumber: 12345,
      objectId: '0xdef...'
    },
    offChainData: {
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
      details: {
        loanAmount: 10000,
        approvedBy: 'admin-789'
      }
    }
  }
);

// Get on-chain portion (safe for blockchain)
const onChainData = AuditTrailService.getOnChainAuditData(event);
// Contains: eventId, eventType, timestamp, pseudonymous IDs, eventHash
// Does NOT contain: real IDs, IP addresses, personal data

// Get off-chain portion (requires authorization)
const offChainData = AuditTrailService.getOffChainAuditData(
  event,
  'admin-789',
  'compliance_audit'
);
// Returns personal data only if authorized

// Verify event integrity
const isValid = AuditTrailService.verifyEventHash(event);
// true if event hasn't been tampered with

// Create privacy-preserving report
const report = AuditTrailService.createPrivacyPreservingReport(
  [event],
  false  // Don't include details
);
// Returns anonymized summary
```

**Key Features:**
- Automatic separation of on-chain and off-chain data
- Cryptographic event hashing for integrity
- Access logging for off-chain data
- Configurable retention periods
- Privacy-preserving reporting

### IdentityIsolationService

Ensures strict separation between real-world and on-chain identities.

```typescript
import { IdentityIsolationService } from './privacy';

// Create isolated identity
const isolated = IdentityIsolationService.createIsolatedIdentity(
  'real-user-123',
  {
    email: 'user@example.com',
    phoneNumber: '+1234567890',
    name: 'John Doe',
    kycData: { verified: true }
  }
);

// isolated.realIdentity - stored off-chain, encrypted
// isolated.pseudonymousIdentity - stored on-chain
// isolated.mapping - secure mapping between them

// Resolve pseudonymous ID (requires authorization)
const realId = IdentityIsolationService.resolvePseudonymousId(
  isolated.pseudonymousIdentity.userAccountObjectId,
  'admin-789',
  'fraud_investigation',
  isolated
);
// Returns real ID only if authorized

// Validate isolation
const validation = IdentityIsolationService.validateIsolation(
  {
    email: 'user@example.com',
    userAccountObjectId: '0x123...'
  },
  'on_chain'
);
// validation.valid = false (email cannot be on-chain)

// Sanitize for on-chain storage
const sanitized = IdentityIsolationService.sanitizeForOnChain({
  email: 'user@example.com',
  userAccountObjectId: '0x123...',
  loanAmount: 10000
});
// sanitized.sanitized = { userAccountObjectId, loanAmount }
// sanitized.removed = ['email']

// Create capability-scoped identity
const capability = IdentityIsolationService.createCapabilityScopedIdentity(
  'real-user-123',
  'borrowing'
);
// Different pseudonymous ID for each capability

// Create session identity
const session = IdentityIsolationService.createSessionIdentity(
  'real-user-123',
  'session-456'
);
// Different pseudonymous ID for each session

// Encrypt/decrypt identity data
const encrypted = IdentityIsolationService.encryptIdentityData('sensitive-data');
const decrypted = IdentityIsolationService.decryptIdentityData(encrypted);

// Audit isolation compliance
const audit = IdentityIsolationService.auditIsolationCompliance(isolated);
// { compliant: true, issues: [], recommendations: [] }
```

**Key Features:**
- Strict separation of real and pseudonymous identities
- Secure mapping with access logging
- Automatic data sanitization
- Capability-scoped identities
- Session-specific identities
- Encryption for sensitive data
- Compliance auditing

## Architecture

### Data Flow

```
User Action
    ↓
Identity Isolation Service
    ↓
    ├─→ Real Identity (Off-Chain, Encrypted)
    │   - Email, phone, name
    │   - Credit scores
    │   - KYC data
    │
    └─→ Pseudonymous Identity (On-Chain)
        - UserAccountObject ID
        - Capability IDs
        - Attestation IDs
```

### Privacy Layers

1. **Classification Layer**: Automatically separates data
2. **Pseudonymization Layer**: Generates unlinkable IDs
3. **Audit Layer**: Logs access with privacy preservation
4. **Isolation Layer**: Enforces separation policies

## Best Practices

### 1. Always Classify Data Before Storage

```typescript
const classified = DataClassificationService.classifyData(userData);

// Store on-chain
await storeOnChain(classified.onChainData);

// Store off-chain (encrypted)
await storeOffChain(classified.offChainData);
```

### 2. Use Pseudonymous IDs for On-Chain Operations

```typescript
// WRONG: Using real user ID on-chain
const loanObject = {
  userId: 'real-user-123',  // ❌ Exposes identity
  amount: 10000
};

// RIGHT: Using pseudonymous ID
const loanObject = {
  userId: PseudonymousIdService.generateDeterministicId(
    'real-user-123',
    'user',
    SECRET_KEY
  ),  // ✅ Privacy-preserving
  amount: 10000
};
```

### 3. Log All Access to Personal Data

```typescript
const event = AuditTrailService.createAuditEvent(
  AuditEventType.DATA_ACCESSED,
  requestorId,
  {
    targetRealId: userId,
    offChainData: {
      purpose: 'compliance_audit',
      dataAccessed: ['email', 'creditScore']
    }
  }
);
```

### 4. Validate Before On-Chain Storage

```typescript
const validation = DataClassificationService.validateOnChainData(data);

if (!validation.valid) {
  throw new Error(`Cannot store on-chain: ${validation.violations.join(', ')}`);
}

await storeOnChain(data);
```

### 5. Use Capability-Scoped IDs

```typescript
// Different pseudonymous ID for each capability
const borrowingId = IdentityIsolationService.createCapabilityScopedIdentity(
  userId,
  'borrowing'
);

const withdrawalId = IdentityIsolationService.createCapabilityScopedIdentity(
  userId,
  'withdrawal'
);

// Cannot correlate borrowing and withdrawal activities
```

## Security Considerations

1. **Secret Key Management**: Store encryption and mapping keys securely (use environment variables, key management services)
2. **Access Control**: Implement proper RBAC for resolving pseudonymous IDs
3. **Audit Logging**: Log all access to personal data
4. **Data Retention**: Implement automatic deletion based on retention policies
5. **Encryption**: Always encrypt sensitive off-chain data

## Compliance

This privacy architecture helps comply with:

- **GDPR**: Right to be forgotten, data minimization, purpose limitation
- **CCPA**: Consumer privacy rights, data transparency
- **Financial Regulations**: 7-year retention for financial records
- **KYC/AML**: Secure storage of identity verification data

## Testing

See `tests/privacy/` for comprehensive test suites including:
- Data classification tests
- Pseudonymous ID generation tests
- Audit trail integrity tests
- Identity isolation validation tests

## Environment Variables

Required environment variables:

```bash
# Identity encryption key (32+ characters)
IDENTITY_ENCRYPTION_KEY=your-secure-encryption-key-here

# Mapping secret key (32+ characters)
MAPPING_SECRET_KEY=your-secure-mapping-secret-here

# Audit secret key (32+ characters)
AUDIT_SECRET_KEY=your-secure-audit-secret-here
```

## Integration Example

```typescript
import {
  DataClassificationService,
  PseudonymousIdService,
  AuditTrailService,
  IdentityIsolationService,
  AuditEventType
} from './services/privacy';

// 1. Create isolated identity
const isolated = IdentityIsolationService.createIsolatedIdentity(
  userId,
  { email, phoneNumber, name }
);

// 2. Create loan with privacy preservation
const loanData = {
  borrowerId: userId,
  amount: 10000,
  interestRate: 5,
  email: email  // Will be filtered out
};

// 3. Classify data
const classified = DataClassificationService.classifyData(loanData);

// 4. Store on-chain (only safe data)
await blockchain.createLoan({
  borrowerId: isolated.pseudonymousIdentity.userAccountObjectId,
  ...classified.onChainData
});

// 5. Store off-chain (personal data)
await database.storeLoan({
  realBorrowerId: userId,
  ...classified.offChainData
});

// 6. Create audit trail
const event = AuditTrailService.createAuditEvent(
  AuditEventType.LOAN_APPROVED,
  userId,
  {
    onChainData: {
      transactionHash: txHash,
      blockNumber: blockNum
    },
    offChainData: {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }
  }
);

// 7. Store audit event
await database.storeAuditEvent(event);
```

## Future Enhancements

- Zero-knowledge proofs for enhanced privacy
- Homomorphic encryption for computation on encrypted data
- Differential privacy for aggregate statistics
- Multi-party computation for sensitive operations
