/**
 * Policy Enforcement Middleware
 * 
 * Middleware for enforcing policies across API routes
 */

import { Request, Response, NextFunction } from 'express';
import { policyIntegrationService } from '../services/policy/policy-integration-service';
import { CapabilityInfo } from '../services/policy/policy-enforcement-service';
import { logger } from '../utils/logger';

/**
 * Extended request interface with policy context
 */
export interface PolicyRequest extends Request {
  policyContext?: {
    userAccountId: string;
    sessionToken: string;
    deviceId: string;
    capabilities: CapabilityInfo[];
    fraudSignals: string[];
  };
}

/**
 * Policy enforcement middleware
 * 
 * Validates requests against applicable policies before allowing them to proceed
 */
export const policyEnforcementMiddleware = (actionType: string) => {
  return async (req: PolicyRequest, res: Response, next: NextFunction) => {
    try {
      // Check if action requires policy validation
      if (!policyIntegrationService.requiresValidation(actionType)) {
        return next();
      }

      // Extract policy context from request
      const policyContext = req.policyContext || extractPolicyContext(req);

      if (!policyContext) {
        logger.warn('Policy context not found in request', { actionType });
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      // Create validation context
      const validationContext = {
        userAccountId: policyContext.userAccountId,
        sessionToken: policyContext.sessionToken,
        deviceId: policyContext.deviceId,
        actionType,
        actionParameters: req.body || {},
        timestamp: Date.now(),
        capabilities: policyContext.capabilities || [],
        fraudSignals: policyContext.fraudSignals || [],
      };

      // Validate action
      const validationResult = await policyIntegrationService.validateAction(validationContext);

      if (!validationResult.isValid) {
        logger.warn('Policy validation failed', {
          actionType,
          userAccountId: policyContext.userAccountId,
          failedRules: validationResult.failedRules,
          validationScore: validationResult.validationScore,
        });

        return res.status(403).json({
          success: false,
          error: 'Policy validation failed',
          details: {
            failedRules: validationResult.failedRules,
            warnings: validationResult.warnings,
            requiredActions: validationResult.requiredActions,
            validationScore: validationResult.validationScore,
          },
        });
      }

      // Log successful validation
      logger.info('Policy validation successful', {
        actionType,
        userAccountId: policyContext.userAccountId,
        validationScore: validationResult.validationScore,
      });

      // Attach validation result to request for downstream use
      (req as any).validationResult = validationResult;

      next();
    } catch (error) {
      logger.error('Policy enforcement middleware error', { error, actionType });
      return res.status(500).json({
        success: false,
        error: 'Policy enforcement error',
      });
    }
  };
};

/**
 * Extract policy context from request
 */
function extractPolicyContext(req: Request): {
  userAccountId: string;
  sessionToken: string;
  deviceId: string;
  capabilities: CapabilityInfo[];
  fraudSignals: string[];
} | null {
  // Extract from headers or session
  const sessionToken = req.headers.authorization?.replace('Bearer ', '') || '';
  const deviceId = req.headers['x-device-id'] as string || '';
  const userAccountId = (req as any).user?.accountId || '';

  if (!sessionToken || !userAccountId) {
    return null;
  }

  // Extract capabilities from user session (would be populated by auth middleware)
  const capabilities: CapabilityInfo[] = (req as any).user?.capabilities || [];

  // Extract fraud signals (would be populated by fraud detection middleware)
  const fraudSignals: string[] = (req as any).fraudSignals || [];

  return {
    userAccountId,
    sessionToken,
    deviceId,
    capabilities,
    fraudSignals,
  };
}

/**
 * Middleware to enforce authentication policy
 */
export const enforceAuthenticationPolicy = policyEnforcementMiddleware('user.login');

/**
 * Middleware to enforce borrowing policy
 */
export const enforceBorrowingPolicy = policyEnforcementMiddleware('loan.create');

/**
 * Middleware to enforce withdrawal policy
 */
export const enforceWithdrawalPolicy = (method: string) => 
  policyEnforcementMiddleware(`withdrawal.${method}`);

/**
 * Middleware to enforce asset upload policy
 */
export const enforceAssetUploadPolicy = policyEnforcementMiddleware('asset.upload');

/**
 * Middleware to enforce admin policy
 */
export const enforceAdminPolicy = (action: string) => 
  policyEnforcementMiddleware(`admin.${action}`);
