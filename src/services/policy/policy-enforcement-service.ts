/**
 * Policy Enforcement Service
 * 
 * Provides policy validation and enforcement across all system layers.
 * Integrates with on-chain policy validators and off-chain business logic.
 */

import { logger } from '../../utils/logger';

/**
 * Policy types matching on-chain constants
 */
export enum PolicyType {
  AUTHENTICATION = 0,
  BORROWING = 1,
  WITHDRAWAL = 2,
  ASSET_UPLOAD = 3,
  RECOVERY = 4,
  ADMIN = 5,
}

/**
 * Validation rule types
 */
export enum ValidationRuleType {
  CAPABILITY_REQUIRED = 0,
  SESSION_VALID = 1,
  SPENDING_LIMIT = 2,
  TIME_RESTRICTION = 3,
  DEVICE_BINDING = 4,
  FRAUD_CHECK = 5,
  MULTI_FACTOR = 6,
}

/**
 * Capability status
 */
export enum CapabilityStatus {
  ACTIVE = 0,
  EXPIRED = 1,
  REVOKED = 2,
  SUSPENDED = 3,
}

/**
 * Capability information for validation
 */
export interface CapabilityInfo {
  capabilityId: string;
  capabilityType: string;
  level: number;
  expiresAt: number;
  status: CapabilityStatus;
  grantedAt: number;
  lastUsed: number;
}

/**
 * Validation context
 */
export interface ValidationContext {
  userAccountId: string;
  sessionToken: string;
  deviceId: string;
  actionType: string;
  actionParameters: any;
  timestamp: number;
  capabilities: CapabilityInfo[];
  fraudSignals: string[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  failedRules: string[];
  warnings: string[];
  requiredActions: string[];
  validationScore: number;
}

/**
 * Policy validator configuration
 */
export interface PolicyValidatorConfig {
  policyType: PolicyType;
  policyName: string;
  validationRules: ValidationRule[];
  capabilityRequirements: CapabilityRequirement[];
  isActive: boolean;
  version: number;
}

/**
 * Validation rule
 */
export interface ValidationRule {
  ruleType: ValidationRuleType;
  parameters: any;
  errorMessage: string;
  isRequired: boolean;
  priority: number;
}

/**
 * Capability requirement
 */
export interface CapabilityRequirement {
  capabilityType: string;
  minimumLevel: number;
  expiryCheck: boolean;
  revocationCheck: boolean;
}

/**
 * Policy Enforcement Service
 */
export class PolicyEnforcementService {
  private policyCache: Map<string, PolicyValidatorConfig> = new Map();
  private actionPolicyMap: Map<string, string> = new Map();

  constructor() {
    this.initializeDefaultPolicies();
  }

  /**
   * Initialize default policies for common actions
   */
  private initializeDefaultPolicies(): void {
    // Authentication actions
    this.actionPolicyMap.set('user.login', 'authentication_policy');
    this.actionPolicyMap.set('user.register', 'authentication_policy');
    this.actionPolicyMap.set('session.create', 'authentication_policy');
    
    // Borrowing actions
    this.actionPolicyMap.set('loan.create', 'borrowing_policy');
    this.actionPolicyMap.set('loan.repay', 'borrowing_policy');
    this.actionPolicyMap.set('capability.use', 'borrowing_policy');
    
    // Withdrawal actions
    this.actionPolicyMap.set('withdrawal.crypto', 'withdrawal_policy');
    this.actionPolicyMap.set('withdrawal.card', 'withdrawal_policy');
    this.actionPolicyMap.set('withdrawal.usdsui', 'withdrawal_policy');
    
    // Asset upload actions
    this.actionPolicyMap.set('asset.upload', 'asset_upload_policy');
    this.actionPolicyMap.set('asset.verify', 'asset_upload_policy');
    
    // Recovery actions
    this.actionPolicyMap.set('account.recover', 'recovery_policy');
    this.actionPolicyMap.set('account.reset', 'recovery_policy');
    
    // Admin actions
    this.actionPolicyMap.set('admin.freeze_account', 'admin_policy');
    this.actionPolicyMap.set('admin.revoke_capability', 'admin_policy');
    this.actionPolicyMap.set('admin.update_policy', 'admin_policy');

    logger.info('Default policy mappings initialized');
  }

  /**
   * Validate an action against applicable policies
   */
  async validateAction(context: ValidationContext): Promise<ValidationResult> {
    try {
      const policyName = this.actionPolicyMap.get(context.actionType);
      
      if (!policyName) {
        logger.warn(`No policy found for action type: ${context.actionType}`);
        return {
          isValid: true,
          failedRules: [],
          warnings: [`No policy configured for action: ${context.actionType}`],
          requiredActions: [],
          validationScore: 100,
        };
      }

      const policy = this.policyCache.get(policyName);
      
      if (!policy) {
        logger.error(`Policy not found in cache: ${policyName}`);
        throw new Error(`Policy not found: ${policyName}`);
      }

      if (!policy.isActive) {
        logger.warn(`Policy is inactive: ${policyName}`);
        return {
          isValid: false,
          failedRules: ['Policy is inactive'],
          warnings: [],
          requiredActions: ['Contact administrator'],
          validationScore: 0,
        };
      }

      // Perform validation
      const result = await this.performValidation(policy, context);
      
      logger.info('Policy validation completed', {
        actionType: context.actionType,
        policyName,
        isValid: result.isValid,
        validationScore: result.validationScore,
      });

      return result;
    } catch (error) {
      logger.error('Policy validation error', { error, context });
      throw error;
    }
  }

  /**
   * Perform validation against policy rules
   */
  private async performValidation(
    policy: PolicyValidatorConfig,
    context: ValidationContext
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      failedRules: [],
      warnings: [],
      requiredActions: [],
      validationScore: 100,
    };

    // Validate capability requirements
    this.validateCapabilityRequirements(policy, context, result);

    // Validate individual rules
    this.validateRules(policy, context, result);

    return result;
  }

  /**
   * Validate capability requirements
   */
  private validateCapabilityRequirements(
    policy: PolicyValidatorConfig,
    context: ValidationContext,
    result: ValidationResult
  ): void {
    for (const requirement of policy.capabilityRequirements) {
      let capabilityFound = false;
      let capabilityValid = false;

      for (const capability of context.capabilities) {
        if (capability.capabilityType === requirement.capabilityType) {
          capabilityFound = true;

          // Check capability level
          if (capability.level >= requirement.minimumLevel) {
            // Check expiry if required
            if (requirement.expiryCheck && capability.expiresAt <= context.timestamp) {
              result.failedRules.push(`Capability expired: ${requirement.capabilityType}`);
              result.validationScore -= 20;
            } else if (requirement.revocationCheck && capability.status !== CapabilityStatus.ACTIVE) {
              result.failedRules.push(`Capability revoked or suspended: ${requirement.capabilityType}`);
              result.validationScore -= 25;
            } else {
              capabilityValid = true;
            }
          } else {
            result.failedRules.push(`Insufficient capability level: ${requirement.capabilityType}`);
            result.validationScore -= 15;
          }
          break;
        }
      }

      if (!capabilityFound) {
        result.failedRules.push(`Required capability not found: ${requirement.capabilityType}`);
        result.validationScore -= 30;
        result.isValid = false;
      } else if (!capabilityValid) {
        result.isValid = false;
      }
    }
  }

  /**
   * Validate individual rules
   */
  private validateRules(
    policy: PolicyValidatorConfig,
    context: ValidationContext,
    result: ValidationResult
  ): void {
    // Sort rules by priority (higher priority first)
    const sortedRules = [...policy.validationRules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const ruleResult = this.validateSingleRule(rule, context);

      if (!ruleResult) {
        if (rule.isRequired) {
          result.isValid = false;
          result.failedRules.push(rule.errorMessage);
          result.validationScore -= rule.priority * 5;
        } else {
          result.warnings.push(rule.errorMessage);
          result.validationScore -= 5;
        }
      }
    }

    // Ensure validation score doesn't go below 0
    result.validationScore = Math.max(0, result.validationScore);
  }

  /**
   * Validate a single rule
   */
  private validateSingleRule(rule: ValidationRule, context: ValidationContext): boolean {
    switch (rule.ruleType) {
      case ValidationRuleType.SESSION_VALID:
        return context.sessionToken && context.sessionToken.length > 0;

      case ValidationRuleType.DEVICE_BINDING:
        return context.deviceId && context.deviceId.length > 0;

      case ValidationRuleType.FRAUD_CHECK:
        return context.fraudSignals.length === 0;

      case ValidationRuleType.TIME_RESTRICTION:
        // Could be enhanced with specific time windows from parameters
        return context.timestamp > 0;

      case ValidationRuleType.SPENDING_LIMIT:
        // Would need to check against actual spending limits from parameters
        return true;

      case ValidationRuleType.MULTI_FACTOR:
        // Would need to check if multiple auth methods were used
        return true;

      default:
        logger.warn(`Unknown rule type: ${rule.ruleType}`);
        return true;
    }
  }

  /**
   * Register a policy validator
   */
  registerPolicy(policyName: string, config: PolicyValidatorConfig): void {
    this.policyCache.set(policyName, config);
    logger.info(`Policy registered: ${policyName}`, { version: config.version });
  }

  /**
   * Update a policy validator
   */
  updatePolicy(policyName: string, config: PolicyValidatorConfig): void {
    const existingPolicy = this.policyCache.get(policyName);
    
    if (existingPolicy) {
      config.version = existingPolicy.version + 1;
    }
    
    this.policyCache.set(policyName, config);
    logger.info(`Policy updated: ${policyName}`, { version: config.version });
  }

  /**
   * Map an action type to a policy
   */
  mapActionToPolicy(actionType: string, policyName: string): void {
    this.actionPolicyMap.set(actionType, policyName);
    logger.info(`Action mapped to policy`, { actionType, policyName });
  }

  /**
   * Get policy for action type
   */
  getPolicyForAction(actionType: string): PolicyValidatorConfig | undefined {
    const policyName = this.actionPolicyMap.get(actionType);
    return policyName ? this.policyCache.get(policyName) : undefined;
  }

  /**
   * Check if action requires policy validation
   */
  requiresValidation(actionType: string): boolean {
    return this.actionPolicyMap.has(actionType);
  }

  /**
   * Create a validation context
   */
  createValidationContext(
    userAccountId: string,
    sessionToken: string,
    deviceId: string,
    actionType: string,
    actionParameters: any,
    capabilities: CapabilityInfo[],
    fraudSignals: string[] = []
  ): ValidationContext {
    return {
      userAccountId,
      sessionToken,
      deviceId,
      actionType,
      actionParameters,
      timestamp: Date.now(),
      capabilities,
      fraudSignals,
    };
  }
}

// Export singleton instance
export const policyEnforcementService = new PolicyEnforcementService();
