import { ValidatorManagement } from '../validator-management';
import { ExternalWalletService } from '@/lib/wallet/external-wallet-service';

describe('ValidatorManagement - Basic Unit Tests', () => {
  let validatorManagement: ValidatorManagement;
  let externalWalletService: ExternalWalletService;

  beforeEach(async () => {
    // Create external wallet service
    externalWalletService = new ExternalWalletService({
      balanceThreshold: BigInt('1000000000'),
      transactionAgeThreshold: 3600,
      inactivityThreshold: 86400,
      emailRecipients: ['test@example.com'],
    });

    // Create validator management system
    validatorManagement = new ValidatorManagement(externalWalletService);
  });

  afterEach(() => {
    validatorManagement.stopMonitoring();
    externalWalletService.shutdown();
  });

  describe('Validator Selection', () => {
    test('should select optimal validators for staking', async () => {
      const totalAmount = BigInt('100000000000'); // 100 CSPR
      const selections = await validatorManagement.selectValidators(totalAmount, 3);

      expect(selections).toBeInstanceOf(Array);
      expect(selections.length).toBeGreaterThan(0);
      expect(selections.length).toBeLessThanOrEqual(3);

      // Verify selection properties
      selections.forEach(selection => {
        expect(selection.validator).toBeDefined();
        expect(selection.allocation).toBeGreaterThan(BigInt(0));
        expect(selection.expectedYield).toBeGreaterThan(0);
        expect(selection.riskScore).toBeGreaterThanOrEqual(0);
        expect(selection.reason).toBeDefined();
      });

      // Verify total allocation equals input amount
      const totalAllocated = selections.reduce((sum, sel) => sum + sel.allocation, BigInt(0));
      expect(totalAllocated).toBe(totalAmount);
    });

    test('should respect diversification limits', async () => {
      const totalAmount = BigInt('100000000000'); // 100 CSPR
      const diversificationTarget = 0.3; // 30% max per validator
      const selections = await validatorManagement.selectValidators(totalAmount, 5, diversificationTarget);

      const maxAllowed = totalAmount * BigInt(30) / BigInt(100); // 30% of total

      selections.forEach(selection => {
        expect(selection.allocation).toBeLessThanOrEqual(maxAllowed);
      });
    });

    test('should handle small amounts', async () => {
      const smallAmount = BigInt('1000000000'); // 1 CSPR
      const selections = await validatorManagement.selectValidators(smallAmount, 1);

      expect(selections).toHaveLength(1);
      expect(selections[0].allocation).toBe(smallAmount);
    });

    test('should handle large amounts with multiple validators', async () => {
      const largeAmount = BigInt('1000000000000'); // 1000 CSPR
      const selections = await validatorManagement.selectValidators(largeAmount, 5);

      expect(selections.length).toBeGreaterThan(1);
      
      // Should distribute across multiple validators
      const maxAllocation = selections.reduce((max, sel) => 
        sel.allocation > max ? sel.allocation : max, BigInt(0)
      );
      const maxPercentage = Number(maxAllocation * BigInt(100) / largeAmount) / 100;
      expect(maxPercentage).toBeLessThanOrEqual(0.25); // Should not exceed 25% per validator
    });
  });

  describe('Validator Metrics', () => {
    test('should retrieve validator metrics', async () => {
      const validatorAddress = 'validator_1';
      const metrics = await validatorManagement.getValidatorMetrics(validatorAddress);

      expect(metrics.validatorAddress).toBe(validatorAddress);
      expect(metrics.performance).toBeGreaterThanOrEqual(0);
      expect(metrics.commission).toBeGreaterThanOrEqual(0);
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.delegatedAmount).toBeGreaterThanOrEqual(BigInt(0));
      expect(metrics.rewardsGenerated).toBeGreaterThanOrEqual(BigInt(0));
      expect(metrics.slashingEvents).toBeGreaterThanOrEqual(0);
    });

    test('should cache validator metrics', async () => {
      const validatorAddress = 'validator_1';
      
      // First call
      const metrics1 = await validatorManagement.getValidatorMetrics(validatorAddress);
      
      // Second call should return cached result
      const metrics2 = await validatorManagement.getValidatorMetrics(validatorAddress);
      
      expect(metrics1).toEqual(metrics2);
    });

    test('should handle invalid validator address', async () => {
      await expect(
        validatorManagement.getValidatorMetrics('invalid_validator')
      ).rejects.toThrow('Failed to retrieve validator metrics');
    });
  });

  describe('Rebalancing Analysis', () => {
    test('should analyze current allocations and recommend rebalancing', async () => {
      const currentAllocations = [
        { validator: 'validator_1', amount: BigInt('50000000000') },
        { validator: 'validator_2', amount: BigInt('30000000000') },
        { validator: 'validator_3', amount: BigInt('20000000000') },
      ];
      const totalAmount = BigInt('100000000000');

      const recommendation = await validatorManagement.analyzeAndRecommendRebalancing(
        currentAllocations,
        totalAmount
      );

      expect(recommendation.currentAllocations).toEqual(currentAllocations);
      expect(recommendation.recommendedAllocations).toBeInstanceOf(Array);
      expect(recommendation.expectedImprovement).toBeDefined();
      expect(recommendation.estimatedCost).toBeGreaterThanOrEqual(BigInt(0));
      expect(['low', 'medium', 'high', 'critical']).toContain(recommendation.priority);

      // Verify improvement metrics
      expect(typeof recommendation.expectedImprovement.yieldIncrease).toBe('number');
      expect(typeof recommendation.expectedImprovement.riskReduction).toBe('number');
      expect(typeof recommendation.expectedImprovement.diversificationImprovement).toBe('number');
    });

    test('should identify over-concentration issues', async () => {
      const overConcentratedAllocations = [
        { validator: 'validator_1', amount: BigInt('80000000000') }, // 80% concentration
        { validator: 'validator_2', amount: BigInt('20000000000') },
      ];
      const totalAmount = BigInt('100000000000');

      const recommendation = await validatorManagement.analyzeAndRecommendRebalancing(
        overConcentratedAllocations,
        totalAmount
      );

      // Should recommend high or critical priority due to over-concentration
      expect(recommendation.priority).toMatch(/^(high|critical)$/);
      expect(recommendation.expectedImprovement.diversificationImprovement).toBeGreaterThan(0);
    });

    test('should handle empty current allocations', async () => {
      const emptyAllocations: { validator: string; amount: bigint }[] = [];
      const totalAmount = BigInt('100000000000');

      const recommendation = await validatorManagement.analyzeAndRecommendRebalancing(
        emptyAllocations,
        totalAmount
      );

      expect(recommendation.currentAllocations).toEqual(emptyAllocations);
      expect(recommendation.recommendedAllocations.length).toBeGreaterThan(0);
    });
  });

  describe('Validator Recommendations', () => {
    test('should provide validator recommendations', async () => {
      const amount = BigInt('50000000000'); // 50 CSPR
      const recommendations = await validatorManagement.getValidatorRecommendations(amount);

      expect(recommendations.primary).toBeInstanceOf(Array);
      expect(recommendations.alternatives).toBeInstanceOf(Array);
      expect(recommendations.riskAnalysis).toBeDefined();

      // Verify primary recommendations
      expect(recommendations.primary.length).toBeGreaterThan(0);
      expect(recommendations.primary.length).toBeLessThanOrEqual(3);

      // Verify risk analysis
      expect(recommendations.riskAnalysis.diversificationScore).toBeGreaterThanOrEqual(0);
      expect(recommendations.riskAnalysis.averageRisk).toBeGreaterThanOrEqual(0);
      expect(recommendations.riskAnalysis.expectedYield).toBeGreaterThan(0);
    });

    test('should provide different primary and alternative recommendations', async () => {
      const amount = BigInt('100000000000'); // 100 CSPR
      const recommendations = await validatorManagement.getValidatorRecommendations(amount);

      // Primary and alternatives should not overlap
      const primaryValidators = new Set(recommendations.primary.map(r => r.validator));
      const alternativeValidators = recommendations.alternatives.map(r => r.validator);

      alternativeValidators.forEach(altValidator => {
        expect(primaryValidators.has(altValidator)).toBe(false);
      });
    });
  });

  describe('Monitoring and Alerts', () => {
    test('should start and stop monitoring', () => {
      expect(() => validatorManagement.startMonitoring()).not.toThrow();
      expect(() => validatorManagement.stopMonitoring()).not.toThrow();
    });

    test('should handle multiple start/stop calls gracefully', () => {
      validatorManagement.startMonitoring();
      validatorManagement.startMonitoring(); // Should not throw
      
      validatorManagement.stopMonitoring();
      validatorManagement.stopMonitoring(); // Should not throw
    });

    test('should return empty alerts initially', () => {
      const alerts = validatorManagement.getActiveAlerts();
      expect(alerts).toBeInstanceOf(Array);
      expect(alerts).toHaveLength(0);
    });

    test('should handle alert acknowledgment', () => {
      // Try to acknowledge non-existent alert
      const result = validatorManagement.acknowledgeAlert('non_existent_alert');
      expect(result).toBe(false);
    });
  });

  describe('Configuration', () => {
    test('should accept custom configuration', () => {
      const customConfig = {
        performanceThreshold: 97.0,
        commissionThreshold: 8.0,
        uptimeThreshold: 99.0,
        monitoringInterval: 600,
      };

      const customValidatorManagement = new ValidatorManagement(
        externalWalletService,
        customConfig
      );

      expect(customValidatorManagement).toBeDefined();
    });

    test('should use default configuration when none provided', () => {
      const defaultValidatorManagement = new ValidatorManagement(externalWalletService);
      expect(defaultValidatorManagement).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle validator service errors gracefully', async () => {
      // Mock external service to throw error
      const originalGetValidators = externalWalletService.getValidators;
      externalWalletService.getValidators = jest.fn().mockRejectedValue(
        new Error('Network error')
      );

      await expect(
        validatorManagement.selectValidators(BigInt('10000000000'))
      ).rejects.toThrow('Validator selection failed');

      // Restore original method
      externalWalletService.getValidators = originalGetValidators;
    });

    test('should handle rebalancing analysis errors gracefully', async () => {
      // Mock external service to throw error
      const originalGetValidators = externalWalletService.getValidators;
      externalWalletService.getValidators = jest.fn().mockRejectedValue(
        new Error('Network error')
      );

      const currentAllocations = [
        { validator: 'validator_1', amount: BigInt('50000000000') },
      ];

      await expect(
        validatorManagement.analyzeAndRecommendRebalancing(
          currentAllocations,
          BigInt('50000000000')
        )
      ).rejects.toThrow('Rebalancing analysis failed');

      // Restore original method
      externalWalletService.getValidators = originalGetValidators;
    });

    test('should handle validator performance errors gracefully', async () => {
      // Mock external service to throw error
      const originalGetValidatorPerformance = externalWalletService.getValidatorPerformance;
      externalWalletService.getValidatorPerformance = jest.fn().mockRejectedValue(
        new Error('Validator not found')
      );

      await expect(
        validatorManagement.getValidatorMetrics('invalid_validator')
      ).rejects.toThrow('Failed to retrieve validator metrics');

      // Restore original method
      externalWalletService.getValidatorPerformance = originalGetValidatorPerformance;
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero amount allocation', async () => {
      await expect(
        validatorManagement.selectValidators(BigInt(0))
      ).rejects.toThrow();
    });

    test('should handle single validator selection', async () => {
      const amount = BigInt('10000000000');
      const selections = await validatorManagement.selectValidators(amount, 1);

      expect(selections).toHaveLength(1);
      expect(selections[0].allocation).toBe(amount);
    });

    test('should handle more validators requested than available', async () => {
      const amount = BigInt('10000000000');
      const selections = await validatorManagement.selectValidators(amount, 100); // Request more than available

      expect(selections.length).toBeLessThanOrEqual(10); // Should not exceed available validators
      
      const totalAllocated = selections.reduce((sum, sel) => sum + sel.allocation, BigInt(0));
      expect(totalAllocated).toBe(amount);
    });
  });
});