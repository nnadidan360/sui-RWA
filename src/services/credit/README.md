# Credit Bureau and Fraud Detection Services

This directory contains the internal credit bureau and fraud detection systems for Credit OS.

## Overview

The credit services implement a private credit history system and multi-layered fraud detection without affecting users' external credit scores. All credit decisions and fraud assessments are maintained internally and only shared externally with explicit user consent.

## Services

### Credit Engine Service (`credit-engine-service.ts`)

Internal credit bureau that maintains private credit history and computes eligibility profiles.

**Key Features:**
- Private credit scoring (0-1000 scale)
- Risk band classification (LOW, MEDIUM, HIGH)
- Eligibility computation based on multiple factors
- Consent-based external reporting
- Credit history tracking without external contamination

**Main Methods:**
- `computeEligibility(userId, assets)` - Calculate user's borrowing eligibility
- `updateCreditHistory(userId, event)` - Record credit events privately
- `checkExternalReportingConsent(userId)` - Verify user consent for external reporting
- `reportToExternalBureau(userId, reportData)` - Report to external bureaus (with consent only)

**Requirements:** 7.1, 7.2, 7.3, 7.4

### Fraud Detection Service (`fraud-detection-service.ts`)

Multi-layered fraud detection system that monitors user activity across all touchpoints.

**Key Features:**
- Device binding and fingerprinting
- Velocity checks for various actions
- Geo/IP consistency validation
- Behavioral pattern analysis
- Asset duplication detection
- Collusion pattern detection
- Automated account freezing and capability revocation

**Main Methods:**
- `detectFraud(userId, activity)` - Comprehensive fraud assessment
- `freezeAccount(userId, reason)` - Freeze user account for fraud
- `revokeCapabilities(userId, reason)` - Revoke user capabilities
- `generateDeviceFingerprint(components)` - Create device fingerprint hash

**Requirements:** 6.1, 6.2, 6.3, 6.4, 6.5

## Usage Examples

### Computing User Eligibility

```typescript
import { creditEngineService } from './services/credit';

const eligibility = await creditEngineService.computeEligibility(
  userId,
  userAssets
);

console.log(`Internal Score: ${eligibility.internalScore}`);
console.log(`Risk Band: ${eligibility.riskBand}`);
console.log(`Max Loan Amount: $${eligibility.maxLoanAmount}`);
```

### Detecting Fraud

```typescript
import { fraudDetectionService } from './services/credit';

const assessment = await fraudDetectionService.detectFraud(userId, {
  userId,
  activityType: 'asset_upload',
  deviceFingerprint: {
    deviceId: 'device_123',
    browserFingerprint: 'fp_abc',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...'
  },
  metadata: { documentHash: 'hash_xyz' },
  timestamp: new Date()
});

// Handle based on recommended action
if (assessment.recommendedAction === 'freeze') {
  await fraudDetectionService.freezeAccount(userId, 'Critical fraud detected');
}
```

## Privacy and Compliance

### Internal Credit Bureau Privacy

- All credit scores and history are maintained privately in MongoDB
- No external credit bureau reporting without explicit user consent
- Consent expires after 1 year and must be renewed
- Credit decisions never expose personal data on-chain

### Fraud Detection Privacy

- Fraud signals are stored privately and never exposed externally
- Account freezing does not affect external credit scores
- Device fingerprints are hashed for privacy
- Geolocation data is stored at country/region level only

## Integration Points

The services integrate with:
- User Model: creditProfile, fraudSignals, activityLog, deviceFingerprints
- Loan Service: Loan origination, repayment, defaults
- Asset Service: Document uploads, verification, duplication
- Capability Service: Account freezing, capability revocation
