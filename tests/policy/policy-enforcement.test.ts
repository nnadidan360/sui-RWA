/**
 * Policy Enforcement Service Tests
 */

import {
  PolicyEnforcementService,
  PolicyType,
  ValidationRuleType,
  CapabilityStatus,
  ValidationContext,
  PolicyValidatorConfig,
} from '../../src/services/policy/policy-enforcement-service';

describe('PolicyEnforcementService', () => {
  let service: PolicyEnforcementService;

  beforeEach(() => {
    service = new PolicyEnforcementService();
  });

  describe('Policy Registration', () => {
    it('should register a new policy', () => {
      const policyConfig: PolicyValidatorConfig = {
        policyType: PolicyType.BORROWING,
        policyName: 'Test Borrowing Policy',
        validationRules: [],
        capabilityRequirements: [],
        isActive: true,
        version: 1,
      };

      service.registerPolicy('test_policy', policyConfig);
      const retrieved = service.getPolicyForAction('loan.create');
      
      // Should not find it yet since we haven't mapped the action
      expect(retrieved).toBeUndefined();
    });

    it('should map action to policy', () => {
      const policyConfig: PolicyValidatorConfig = {
        policyType: PolicyType.BORROWING,
        policyName: 'Test Borrowing Policy',
        validationRules: [],
        capabilityRequirements: [],
        isActive: true,
        version: 1,
      };

      service.registerPolicy('test_policy', policyConfig);
      service.mapActionToPolicy('test.action', 'test_policy');
      
      const retrieved = service.getPolicyForAction('test.action');
      expect(retrieved).toBeDefined();
      expect(retrieved?.policyName).toBe('Test Borrowing Policy');
    });

    it('should update policy version on update', () => {
      const policyConfig: PolicyValidatorConfig = {
        policyType: PolicyType.BORROWING,
        policyName: 'Test Policy',
        validationRules: [],
        capabilityRequirements: [],
        isActive: true,
        version: 1,
      };

      service.registerPolicy('test_policy', policyConfig);
      service.updatePolicy('test_policy', policyConfig);
      
      service.mapActionToPolicy('test.action', 'test_policy');
      const retrieved = service.getPolicyForAction('test.action');
      
      expect(retrieved?.version).toBe(2);
    });
  });

  describe('Validation Context', () => {
    it('should create validation context', () => {
      const context = service.createValidationContext(
        'user123',
        'session-token',
        'device-id',
        'loan.create',
        { amount: 1000 },
        [],
        []
      );

      expect(context.userAccountId).toBe('user123');
      expect(context.sessionToken).toBe('session-token');
      expect(context.deviceId).toBe('device-id');
      expect(context.actionType).toBe('loan.create');
      expect(context.timestamp).toBeGreaterThan(0);
    });
  });

  describe('Session Validation', () => {
    it('should pass validation with valid session', async () => {
      const policyConfig: PolicyValidatorConfig = {
        policyType: PolicyType.AUTHENTICATION,
        policyName: 'Auth Policy',
        validationRules: [
          {
            ruleType: ValidationRuleType.SESSION_VALID,
            parameters: {},
            errorMessage: 'Valid session required',
            isRequired: true,
            priority: 10,
          },
        ],
        capabilityRequirements: [],
        isActive: true,
        version: 1,
      };

      service.registerPolicy('auth_policy', policyConfig);
      service.mapActionToPolicy('user.login', 'auth_policy');

      const context = service.createValidationContext(
        'user123',
        'valid-session-token',
        'device-id',
        'user.login',
        {},
        [],
        []
      );

      const result = await service.validateAction(context);
      
      expect(result.isValid).toBe(true);
      expect(result.failedRules).toHaveLength(0);
      expect(result.validationScore).toBe(100);
    });

    it('should fail validation with empty session', async () => {
      const policyConfig: PolicyValidatorConfig = {
        policyType: PolicyType.AUTHENTICATION,
        policyName: 'Auth Policy',
        validationRules: [
          {
            ruleType: ValidationRuleType.SESSION_VALID,
            parameters: {},
            errorMessage: 'Valid session required',
            isRequired: true,
            priority: 10,
          },
        ],
        capabilityRequirements: [],
        isActive: true,
        version: 1,
      };

      service.registerPolicy('auth_policy', policyConfig);
      service.mapActionToPolicy('user.login', 'auth_policy');

      const context = service.createValidationContext(
        'user123',
        '', // Empty session token
        'device-id',
        'user.login',
        {},
        [],
        []
      );

      const result = await service.validateAction(context);
      
      expect(result.isValid).toBe(false);
      expect(result.failedRules).toHaveLength(1);
      expect(result.failedRules[0]).toBe('Valid session required');
      expect(result.validationScore).toBeLessThan(100);
    });
  });

  describe('Device Binding Validation', () => {
    it('should pass validation with device ID', async () => {
      const policyConfig: PolicyValidatorConfig = {
        policyType: PolicyType.WITHDRAWAL,
        policyName: 'Withdrawal Policy',
        validationRules: [
          {
            ruleType: ValidationRuleType.DEVICE_BINDING,
            parameters: {},
            errorMessage: 'Device binding required',
            isRequired: true,
            priority: 9,
          },
        ],
        capabilityRequirements: [],
        isActive: true,
        version: 1,
      };

      service.registerPolicy('withdrawal_policy', policyConfig);
      service.mapActionToPolicy('withdrawal.crypto', 'withdrawal_policy');

      const context = service.createValidationContext(
        'user123',
        'session-token',
        'device-123',
        'withdrawal.crypto',
        {},
        [],
        []
      );

      const result = await service.validateAction(context);
      
      expect(result.isValid).toBe(true);
      expect(result.failedRules).toHaveLength(0);
    });

    it('should fail validation without device ID', async () => {
      const policyConfig: PolicyValidatorConfig = {
        policyType: PolicyType.WITHDRAWAL,
        policyName: 'Withdrawal Policy',
        validationRules: [
          {
            ruleType: ValidationRuleType.DEVICE_BINDING,
            parameters: {},
            errorMessage: 'Device binding required',
            isRequired: true,
            priority: 9,
          },
        ],
        capabilityRequirements: [],
        isActive: true,
        version: 1,
      };

      service.registerPolicy('withdrawal_policy', policyConfig);
      service.mapActionToPolicy('withdrawal.crypto', 'withdrawal_policy');

      const context = service.createValidationContext(
        'user123',
        'session-token',
        '', // Empty device ID
        'withdrawal.crypto',
        {},
        [],
        []
      );

      const result = await service.validateAction(context);
      
      expect(result.isValid).toBe(false);
      expect(result.failedRules).toContain('Device binding required');
    });
  });

  describe('Fraud Check Validation', () => {
    it('should pass validation with no fraud signals', async () => {
      const policyConfig: PolicyValidatorConfig = {
        policyType: PolicyType.BORROWING,
        policyName: 'Borrowing Policy',
        validationRules: [
          {
            ruleType: ValidationRuleType.FRAUD_CHECK,
            parameters: {},
            errorMessage: 'Fraud signals detected',
            isRequired: true,
            priority: 10,
          },
        ],
        capabilityRequirements: [],
        isActive: true,
        version: 1,
      };

      service.registerPolicy('borrowing_policy', policyConfig);
      service.mapActionToPolicy('loan.create', 'borrowing_policy');

      const context = service.createValidationContext(
        'user123',
        'session-token',
        'device-id',
        'loan.create',
        {},
        [],
        [] // No fraud signals
      );

      const result = await service.validateAction(context);
      
      expect(result.isValid).toBe(true);
      expect(result.failedRules).toHaveLength(0);
    });

    it('should fail validation with fraud signals', async () => {
      const policyConfig: PolicyValidatorConfig = {
        policyType: PolicyType.BORROWING,
        policyName: 'Borrowing Policy',
        validationRules: [
          {
            ruleType: ValidationRuleType.FRAUD_CHECK,
            parameters: {},
            errorMessage: 'Fraud signals detected',
            isRequired: true,
            priority: 10,
          },
        ],
        capabilityRequirements: [],
        isActive: true,
        version: 1,
      };

      service.registerPolicy('borrowing_policy', policyConfig);
      service.mapActionToPolicy('loan.create', 'borrowing_policy');

      const context = service.createValidationContext(
        'user123',
        'session-token',
        'device-id',
        'loan.create',
        {},
        [],
        ['duplicate_device', 'velocity_exceeded'] // Fraud signals present
      );

      const result = await service.validateAction(context);
      
      expect(result.isValid).toBe(false);
      expect(result.failedRules).toContain('Fraud signals detected');
    });
  });

  describe('Capability Validation', () => {
    it('should pass validation with valid capability', async () => {
      const policyConfig: PolicyValidatorConfig = {
        policyType: PolicyType.BORROWING,
        policyName: 'Borrowing Policy',
        validationRules: [],
        capabilityRequirements: [
          {
            capabilityType: 'borrowing',
            minimumLevel: 1,
            expiryCheck: true,
            revocationCheck: true,
          },
        ],
        isActive: true,
        version: 1,
      };

      service.registerPolicy('borrowing_policy', policyConfig);
      service.mapActionToPolicy('loan.create', 'borrowing_policy');

      const context = service.createValidationContext(
        'user123',
        'session-token',
        'device-id',
        'loan.create',
        {},
        [
          {
            capabilityId: 'cap123',
            capabilityType: 'borrowing',
            level: 2,
            expiresAt: Date.now() + 86400000, // Expires in 24 hours
            status: CapabilityStatus.ACTIVE,
            grantedAt: Date.now() - 3600000,
            lastUsed: Date.now(),
          },
        ],
        []
      );

      const result = await service.validateAction(context);
      
      expect(result.isValid).toBe(true);
      expect(result.failedRules).toHaveLength(0);
    });

    it('should fail validation with expired capability', async () => {
      const policyConfig: PolicyValidatorConfig = {
        policyType: PolicyType.BORROWING,
        policyName: 'Borrowing Policy',
        validationRules: [],
        capabilityRequirements: [
          {
            capabilityType: 'borrowing',
            minimumLevel: 1,
            expiryCheck: true,
            revocationCheck: true,
          },
        ],
        isActive: true,
        version: 1,
      };

      service.registerPolicy('borrowing_policy', policyConfig);
      service.mapActionToPolicy('loan.create', 'borrowing_policy');

      const context = service.createValidationContext(
        'user123',
        'session-token',
        'device-id',
        'loan.create',
        {},
        [
          {
            capabilityId: 'cap123',
            capabilityType: 'borrowing',
            level: 2,
            expiresAt: Date.now() - 1000, // Already expired
            status: CapabilityStatus.ACTIVE,
            grantedAt: Date.now() - 86400000,
            lastUsed: Date.now() - 3600000,
          },
        ],
        []
      );

      const result = await service.validateAction(context);
      
      expect(result.isValid).toBe(false);
      expect(result.failedRules.some(rule => rule.includes('expired'))).toBe(true);
    });

    it('should fail validation with revoked capability', async () => {
      const policyConfig: PolicyValidatorConfig = {
        policyType: PolicyType.BORROWING,
        policyName: 'Borrowing Policy',
        validationRules: [],
        capabilityRequirements: [
          {
            capabilityType: 'borrowing',
            minimumLevel: 1,
            expiryCheck: true,
            revocationCheck: true,
          },
        ],
        isActive: true,
        version: 1,
      };

      service.registerPolicy('borrowing_policy', policyConfig);
      service.mapActionToPolicy('loan.create', 'borrowing_policy');

      const context = service.createValidationContext(
        'user123',
        'session-token',
        'device-id',
        'loan.create',
        {},
        [
          {
            capabilityId: 'cap123',
            capabilityType: 'borrowing',
            level: 2,
            expiresAt: Date.now() + 86400000,
            status: CapabilityStatus.REVOKED, // Revoked
            grantedAt: Date.now() - 86400000,
            lastUsed: Date.now() - 3600000,
          },
        ],
        []
      );

      const result = await service.validateAction(context);
      
      expect(result.isValid).toBe(false);
      expect(result.failedRules.some(rule => rule.includes('revoked'))).toBe(true);
    });

    it('should fail validation with insufficient capability level', async () => {
      const policyConfig: PolicyValidatorConfig = {
        policyType: PolicyType.BORROWING,
        policyName: 'Borrowing Policy',
        validationRules: [],
        capabilityRequirements: [
          {
            capabilityType: 'borrowing',
            minimumLevel: 5, // Requires level 5
            expiryCheck: true,
            revocationCheck: true,
          },
        ],
        isActive: true,
        version: 1,
      };

      service.registerPolicy('borrowing_policy', policyConfig);
      service.mapActionToPolicy('loan.create', 'borrowing_policy');

      const context = service.createValidationContext(
        'user123',
        'session-token',
        'device-id',
        'loan.create',
        {},
        [
          {
            capabilityId: 'cap123',
            capabilityType: 'borrowing',
            level: 2, // Only level 2
            expiresAt: Date.now() + 86400000,
            status: CapabilityStatus.ACTIVE,
            grantedAt: Date.now() - 86400000,
            lastUsed: Date.now(),
          },
        ],
        []
      );

      const result = await service.validateAction(context);
      
      expect(result.isValid).toBe(false);
      expect(result.failedRules.some(rule => rule.includes('Insufficient capability level'))).toBe(true);
    });

    it('should fail validation with missing capability', async () => {
      const policyConfig: PolicyValidatorConfig = {
        policyType: PolicyType.BORROWING,
        policyName: 'Borrowing Policy',
        validationRules: [],
        capabilityRequirements: [
          {
            capabilityType: 'borrowing',
            minimumLevel: 1,
            expiryCheck: true,
            revocationCheck: true,
          },
        ],
        isActive: true,
        version: 1,
      };

      service.registerPolicy('borrowing_policy', policyConfig);
      service.mapActionToPolicy('loan.create', 'borrowing_policy');

      const context = service.createValidationContext(
        'user123',
        'session-token',
        'device-id',
        'loan.create',
        {},
        [], // No capabilities
        []
      );

      const result = await service.validateAction(context);
      
      expect(result.isValid).toBe(false);
      expect(result.failedRules.some(rule => rule.includes('not found'))).toBe(true);
    });
  });

  describe('Multiple Rules Validation', () => {
    it('should validate multiple rules successfully', async () => {
      const policyConfig: PolicyValidatorConfig = {
        policyType: PolicyType.BORROWING,
        policyName: 'Comprehensive Policy',
        validationRules: [
          {
            ruleType: ValidationRuleType.SESSION_VALID,
            parameters: {},
            errorMessage: 'Valid session required',
            isRequired: true,
            priority: 10,
          },
          {
            ruleType: ValidationRuleType.DEVICE_BINDING,
            parameters: {},
            errorMessage: 'Device binding required',
            isRequired: true,
            priority: 9,
          },
          {
            ruleType: ValidationRuleType.FRAUD_CHECK,
            parameters: {},
            errorMessage: 'Fraud signals detected',
            isRequired: true,
            priority: 10,
          },
        ],
        capabilityRequirements: [
          {
            capabilityType: 'borrowing',
            minimumLevel: 1,
            expiryCheck: true,
            revocationCheck: true,
          },
        ],
        isActive: true,
        version: 1,
      };

      service.registerPolicy('comprehensive_policy', policyConfig);
      service.mapActionToPolicy('loan.create', 'comprehensive_policy');

      const context = service.createValidationContext(
        'user123',
        'valid-session',
        'device-123',
        'loan.create',
        {},
        [
          {
            capabilityId: 'cap123',
            capabilityType: 'borrowing',
            level: 2,
            expiresAt: Date.now() + 86400000,
            status: CapabilityStatus.ACTIVE,
            grantedAt: Date.now() - 3600000,
            lastUsed: Date.now(),
          },
        ],
        []
      );

      const result = await service.validateAction(context);
      
      expect(result.isValid).toBe(true);
      expect(result.failedRules).toHaveLength(0);
      expect(result.validationScore).toBe(100);
    });

    it('should fail validation if any required rule fails', async () => {
      const policyConfig: PolicyValidatorConfig = {
        policyType: PolicyType.BORROWING,
        policyName: 'Comprehensive Policy',
        validationRules: [
          {
            ruleType: ValidationRuleType.SESSION_VALID,
            parameters: {},
            errorMessage: 'Valid session required',
            isRequired: true,
            priority: 10,
          },
          {
            ruleType: ValidationRuleType.FRAUD_CHECK,
            parameters: {},
            errorMessage: 'Fraud signals detected',
            isRequired: true,
            priority: 10,
          },
        ],
        capabilityRequirements: [],
        isActive: true,
        version: 1,
      };

      service.registerPolicy('comprehensive_policy', policyConfig);
      service.mapActionToPolicy('loan.create', 'comprehensive_policy');

      const context = service.createValidationContext(
        'user123',
        'valid-session',
        'device-123',
        'loan.create',
        {},
        [],
        ['fraud_signal'] // Has fraud signal
      );

      const result = await service.validateAction(context);
      
      expect(result.isValid).toBe(false);
      expect(result.failedRules).toContain('Fraud signals detected');
    });
  });

  describe('Inactive Policy', () => {
    it('should allow action when no policy is configured', async () => {
      const context = service.createValidationContext(
        'user123',
        'session-token',
        'device-id',
        'unknown.action',
        {},
        [],
        []
      );

      const result = await service.validateAction(context);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('No policy configured for action: unknown.action');
    });
  });
});
