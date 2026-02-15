/**
 * Policy Integration Service
 * 
 * Integrates on-chain policy validators with off-chain business logic.
 * Provides a bridge between Sui Move contracts and TypeScript services.
 */

import { logger } from '../../utils/logger';
import {
  PolicyEnforcementService,
  PolicyType,
  PolicyValidatorConfig,
  ValidationContext,
  ValidationResult,
  ValidationRuleType,
  CapabilityInfo,
} from './policy-enforcement-service';

/**
 * Policy Integration Service
 * 
 * Coordinates policy validation across on-chain and off-chain layers
 */
export class PolicyIntegrationService {
  private enforcementService: PolicyEnforcementService;

  constructor(enforcementService: PolicyEnforcementService) {
    this.enforcementService = enforcementService;
    this.initializeSystemPolicies();
  }

  /**
   * Initialize system-wide policies
   */
  private initializeSystemPolicies(): void {
    // Authentication Policy
    this.enforcementService.registerPolicy('authentication_policy', {
      policyType: PolicyType.AUTHENTICATION,
      policyName: 'Authentication Policy',
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
          priority: 8,
        },
        {
          ruleType: ValidationRuleType.FRAUD_CHECK,
          parameters: {},
          errorMessage: 'Fraud signals detected',
          isRequired: true,
          priority: 9,
        },
      ],
      capabilityRequirements: [],
      isActive: true,
      version: 1,
    });

    // Borrowing Policy
    this.enforcementService.registerPolicy('borrowing_policy', {
      policyType: PolicyType.BORROWING,
      policyName: 'Borrowing Policy',
      validationRules: [
        {
          ruleType: ValidationRuleType.SESSION_VALID,
          parameters: {},
          errorMessage: 'Valid session required for borrowing',
          isRequired: true,
          priority: 10,
        },
        {
          ruleType: ValidationRuleType.FRAUD_CHECK,
          parameters: {},
          errorMessage: 'Cannot borrow with active fraud signals',
          isRequired: true,
          priority: 10,
        },
        {
          ruleType: ValidationRuleType.SPENDING_LIMIT,
          parameters: {},
          errorMessage: 'Spending limit exceeded',
          isRequired: true,
          priority: 8,
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
    });

    // Withdrawal Policy
    this.enforcementService.registerPolicy('withdrawal_policy', {
      policyType: PolicyType.WITHDRAWAL,
      policyName: 'Withdrawal Policy',
      validationRules: [
        {
          ruleType: ValidationRuleType.SESSION_VALID,
          parameters: {},
          errorMessage: 'Valid session required for withdrawal',
          isRequired: true,
          priority: 10,
        },
        {
          ruleType: ValidationRuleType.DEVICE_BINDING,
          parameters: {},
          errorMessage: 'Trusted device required for withdrawal',
          isRequired: true,
          priority: 9,
        },
        {
          ruleType: ValidationRuleType.FRAUD_CHECK,
          parameters: {},
          errorMessage: 'Cannot withdraw with active fraud signals',
          isRequired: true,
          priority: 10,
        },
      ],
      capabilityRequirements: [
        {
          capabilityType: 'withdrawal',
          minimumLevel: 1,
          expiryCheck: true,
          revocationCheck: true,
        },
      ],
      isActive: true,
      version: 1,
    });

    // Asset Upload Policy
    this.enforcementService.registerPolicy('asset_upload_policy', {
      policyType: PolicyType.ASSET_UPLOAD,
      policyName: 'Asset Upload Policy',
      validationRules: [
        {
          ruleType: ValidationRuleType.SESSION_VALID,
          parameters: {},
          errorMessage: 'Valid session required for asset upload',
          isRequired: true,
          priority: 10,
        },
        {
          ruleType: ValidationRuleType.FRAUD_CHECK,
          parameters: {},
          errorMessage: 'Cannot upload assets with active fraud signals',
          isRequired: true,
          priority: 10,
        },
      ],
      capabilityRequirements: [],
      isActive: true,
      version: 1,
    });

    // Recovery Policy
    this.enforcementService.registerPolicy('recovery_policy', {
      policyType: PolicyType.RECOVERY,
      policyName: 'Recovery Policy',
      validationRules: [
        {
          ruleType: ValidationRuleType.TIME_RESTRICTION,
          parameters: { minDelay: 3600000 }, // 1 hour
          errorMessage: 'Recovery delay period not met',
          isRequired: true,
          priority: 10,
        },
      ],
      capabilityRequirements: [],
      isActive: true,
      version: 1,
    });

    // Admin Policy
    this.enforcementService.registerPolicy('admin_policy', {
      policyType: PolicyType.ADMIN,
      policyName: 'Admin Policy',
      validationRules: [
        {
          ruleType: ValidationRuleType.SESSION_VALID,
          parameters: {},
          errorMessage: 'Valid admin session required',
          isRequired: true,
          priority: 10,
        },
        {
          ruleType: ValidationRuleType.MULTI_FACTOR,
          parameters: {},
          errorMessage: 'Multi-factor authentication required for admin actions',
          isRequired: true,
          priority: 10,
        },
      ],
      capabilityRequirements: [
        {
          capabilityType: 'admin',
          minimumLevel: 5,
          expiryCheck: true,
          revocationCheck: true,
        },
      ],
      isActive: true,
      version: 1,
    });

    logger.info('System policies initialized');
  }

  /**
   * Validate action with policy enforcement
   */
  async validateAction(context: ValidationContext): Promise<ValidationResult> {
    try {
      return await this.enforcementService.validateAction(context);
    } catch (error) {
      logger.error('Policy validation failed', { error, context });
      throw error;
    }
  }

  /**
   * Enforce policy for authentication actions
   */
  async enforceAuthenticationPolicy(
    userAccountId: string,
    sessionToken: string,
    deviceId: string,
    fraudSignals: string[] = []
  ): Promise<ValidationResult> {
    const context = this.enforcementService.createValidationContext(
      userAccountId,
      sessionToken,
      deviceId,
      'user.login',
      {},
      [],
      fraudSignals
    );

    return await this.validateAction(context);
  }

  /**
   * Enforce policy for borrowing actions
   */
  async enforceBorrowingPolicy(
    userAccountId: string,
    sessionToken: string,
    deviceId: string,
    capabilities: CapabilityInfo[],
    loanAmount: number,
    fraudSignals: string[] = []
  ): Promise<ValidationResult> {
    const context = this.enforcementService.createValidationContext(
      userAccountId,
      sessionToken,
      deviceId,
      'loan.create',
      { loanAmount },
      capabilities,
      fraudSignals
    );

    return await this.validateAction(context);
  }

  /**
   * Enforce policy for withdrawal actions
   */
  async enforceWithdrawalPolicy(
    userAccountId: string,
    sessionToken: string,
    deviceId: string,
    capabilities: CapabilityInfo[],
    withdrawalAmount: number,
    withdrawalMethod: string,
    fraudSignals: string[] = []
  ): Promise<ValidationResult> {
    const actionType = `withdrawal.${withdrawalMethod}`;
    const context = this.enforcementService.createValidationContext(
      userAccountId,
      sessionToken,
      deviceId,
      actionType,
      { withdrawalAmount, withdrawalMethod },
      capabilities,
      fraudSignals
    );

    return await this.validateAction(context);
  }

  /**
   * Enforce policy for asset upload actions
   */
  async enforceAssetUploadPolicy(
    userAccountId: string,
    sessionToken: string,
    deviceId: string,
    assetType: string,
    fraudSignals: string[] = []
  ): Promise<ValidationResult> {
    const context = this.enforcementService.createValidationContext(
      userAccountId,
      sessionToken,
      deviceId,
      'asset.upload',
      { assetType },
      [],
      fraudSignals
    );

    return await this.validateAction(context);
  }

  /**
   * Enforce policy for admin actions
   */
  async enforceAdminPolicy(
    adminAccountId: string,
    sessionToken: string,
    deviceId: string,
    capabilities: CapabilityInfo[],
    adminAction: string,
    fraudSignals: string[] = []
  ): Promise<ValidationResult> {
    const context = this.enforcementService.createValidationContext(
      adminAccountId,
      sessionToken,
      deviceId,
      `admin.${adminAction}`,
      { adminAction },
      capabilities,
      fraudSignals
    );

    return await this.validateAction(context);
  }

  /**
   * Update a policy configuration
   */
  updatePolicy(policyName: string, config: PolicyValidatorConfig): void {
    this.enforcementService.updatePolicy(policyName, config);
    logger.info(`Policy updated: ${policyName}`, { version: config.version });
  }

  /**
   * Get policy for action
   */
  getPolicyForAction(actionType: string): PolicyValidatorConfig | undefined {
    return this.enforcementService.getPolicyForAction(actionType);
  }

  /**
   * Check if action requires validation
   */
  requiresValidation(actionType: string): boolean {
    return this.enforcementService.requiresValidation(actionType);
  }
}

// Export singleton instance
export const policyIntegrationService = new PolicyIntegrationService(
  new PolicyEnforcementService()
);
