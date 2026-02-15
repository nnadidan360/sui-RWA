# Policy Validation Framework

## Overview

The Policy Validation Framework provides comprehensive policy enforcement across all Credit OS system layers. It integrates on-chain policy validators (Sui Move contracts) with off-chain business logic (TypeScript services) to ensure consistent security and compliance.

## Architecture

### Components

1. **On-Chain Policy Validator** (`policy_validator.move`)
   - Sui Move smart contract for on-chain policy validation
   - Stores policy configurations and validation rules
   - Provides capability-based permission checking
   - Supports policy versioning and updates

2. **Policy Enforcement Service** (`policy-enforcement-service.ts`)
   - Off-chain service for policy validation
   - Caches policy configurations for performance
   - Validates actions against applicable policies
   - Provides detailed validation results

3. **Policy Integration Service** (`policy-integration-service.ts`)
   - Bridges on-chain and off-chain policy enforcement
   - Initializes system-wide policies
   - Provides convenience methods for common policy checks
   - Coordinates policy updates across layers

4. **Policy Enforcement Middleware** (`policy-enforcement-middleware.ts`)
   - Express middleware for API route protection
   - Automatically validates requests against policies
   - Extracts policy context from requests
   - Returns detailed error messages for policy violations

## Policy Types

The framework supports six policy types:

- **AUTHENTICATION** (0): User login, registration, session management
- **BORROWING** (1): Loan creation, repayment, capability usage
- **WITHDRAWAL** (2): Crypto, card, and USDSui withdrawals
- **ASSET_UPLOAD** (3): RWA document uploads and verification
- **RECOVERY** (4): Account recovery and reset operations
- **ADMIN** (5): Administrative actions and system management

## Validation Rules

### Rule Types

- **CAPABILITY_REQUIRED** (0): Requires specific capability with minimum level
- **SESSION_VALID** (1): Requires valid, non-expired session
- **SPENDING_LIMIT** (2): Enforces spending limits
- **TIME_RESTRICTION** (3): Enforces time-based restrictions
- **DEVICE_BINDING** (4): Requires trusted device
- **FRAUD_CHECK** (5): Checks for fraud signals
- **MULTI_FACTOR** (6): Requires multi-factor authentication

### Rule Configuration

Each validation rule includes:
- `ruleType`: Type of validation to perform
- `parameters`: Rule-specific parameters
- `errorMessage`: Message shown when rule fails
- `isRequired`: Whether rule failure blocks action
- `priority`: Rule priority (higher checked first)

## Capability Requirements

Policies can require specific capabilities:

```typescript
{
  capabilityType: 'borrowing',
  minimumLevel: 1,
  expiryCheck: true,
  revocationCheck: true
}
```

## Usage

### Basic Policy Validation

```typescript
import { policyIntegrationService } from './services/policy';

// Validate borrowing action
const result = await policyIntegrationService.enforceBorrowingPolicy(
  userAccountId,
  sessionToken,
  deviceId,
  capabilities,
  loanAmount,
  fraudSignals
);

if (!result.isValid) {
  console.error('Policy validation failed:', result.failedRules);
}
```

### Using Middleware

```typescript
import { enforceBorrowingPolicy } from './middleware/policy-enforcement-middleware';

// Protect route with policy enforcement
router.post('/loans', enforceBorrowingPolicy, async (req, res) => {
  // Route handler - only executes if policy validation passes
});
```

### Custom Policy Registration

```typescript
import { policyEnforcementService, PolicyType, ValidationRuleType } from './services/policy';

// Register custom policy
policyEnforcementService.registerPolicy('custom_policy', {
  policyType: PolicyType.BORROWING,
  policyName: 'Custom Borrowing Policy',
  validationRules: [
    {
      ruleType: ValidationRuleType.SESSION_VALID,
      parameters: {},
      errorMessage: 'Valid session required',
      isRequired: true,
      priority: 10,
    },
  ],
  capabilityRequirements: [
    {
      capabilityType: 'borrowing',
      minimumLevel: 2,
      expiryCheck: true,
      revocationCheck: true,
    },
  ],
  isActive: true,
  version: 1,
});

// Map action to policy
policyEnforcementService.mapActionToPolicy('custom.action', 'custom_policy');
```

## Policy Updates and Versioning

### Updating Policies

Policies support versioning for safe updates:

```typescript
// Update existing policy
policyIntegrationService.updatePolicy('borrowing_policy', {
  policyType: PolicyType.BORROWING,
  policyName: 'Updated Borrowing Policy',
  validationRules: [...newRules],
  capabilityRequirements: [...newRequirements],
  isActive: true,
  version: 2, // Automatically incremented
});
```

### On-Chain Policy Updates

```move
// Update policy validator on-chain
public fun update_policy_validator(
    validator: &mut PolicyValidator,
    new_rules: vector<ValidationRule>,
    new_requirements: vector<CapabilityRequirement>,
    clock: &Clock,
    ctx: &mut TxContext
)
```

## Validation Results

Validation returns detailed results:

```typescript
interface ValidationResult {
  isValid: boolean;              // Overall validation status
  failedRules: string[];         // Rules that failed
  warnings: string[];            // Non-critical warnings
  requiredActions: string[];     // Actions user must take
  validationScore: number;       // Confidence score (0-100)
}
```

## Integration Points

### Layer Integration

1. **Identity & Consent Layer**: Authentication policy enforcement
2. **Credit & Fraud Engine**: Fraud signal integration
3. **Asset Intelligence Layer**: Asset upload policy enforcement
4. **Lending Engine**: Borrowing policy enforcement
5. **On-Chain Settlement Layer**: Capability validation
6. **Recovery & Enforcement**: Recovery policy enforcement

### Service Integration

```typescript
// Authentication Service
const authResult = await policyIntegrationService.enforceAuthenticationPolicy(
  userAccountId,
  sessionToken,
  deviceId,
  fraudSignals
);

// Lending Service
const loanResult = await policyIntegrationService.enforceBorrowingPolicy(
  userAccountId,
  sessionToken,
  deviceId,
  capabilities,
  loanAmount,
  fraudSignals
);

// Withdrawal Service
const withdrawalResult = await policyIntegrationService.enforceWithdrawalPolicy(
  userAccountId,
  sessionToken,
  deviceId,
  capabilities,
  withdrawalAmount,
  'crypto',
  fraudSignals
);
```

## Security Considerations

1. **Capability Validation**: Always check capability expiry and revocation status
2. **Fraud Signals**: Integrate with fraud detection system for real-time signals
3. **Session Validation**: Verify session tokens before policy validation
4. **Device Binding**: Enforce device binding for sensitive operations
5. **Multi-Factor**: Require MFA for high-risk actions

## Performance Optimization

1. **Policy Caching**: Policies are cached in memory for fast validation
2. **Rule Prioritization**: High-priority rules checked first
3. **Early Exit**: Validation stops on first critical failure
4. **Async Validation**: Non-blocking validation for better throughput

## Testing

### Unit Tests

```typescript
import { policyEnforcementService } from './policy-enforcement-service';

describe('Policy Enforcement', () => {
  it('should validate borrowing action', async () => {
    const context = policyEnforcementService.createValidationContext(
      'user123',
      'session-token',
      'device-id',
      'loan.create',
      { loanAmount: 1000 },
      [
        {
          capabilityId: 'cap123',
          capabilityType: 'borrowing',
          level: 1,
          expiresAt: Date.now() + 86400000,
          status: 0,
          grantedAt: Date.now(),
          lastUsed: Date.now(),
        },
      ],
      []
    );

    const result = await policyEnforcementService.validateAction(context);
    expect(result.isValid).toBe(true);
  });
});
```

## Monitoring and Logging

All policy validations are logged with:
- Action type
- User account ID
- Validation result
- Failed rules
- Validation score
- Timestamp

Failed validations emit events for monitoring and alerting.

## Future Enhancements

1. **Dynamic Rule Loading**: Load rules from database
2. **Policy Templates**: Pre-configured policy templates
3. **A/B Testing**: Test policy variations
4. **Machine Learning**: ML-based policy optimization
5. **Audit Trail**: Comprehensive policy change history
