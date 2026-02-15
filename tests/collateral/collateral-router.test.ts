/**
 * Collateral Router Tests
 * 
 * Tests for collateral routing between RWA and Crypto engines
 * 
 * Requirements: 10.2
 */

import {
  CollateralRouterService,
  CollateralType,
  AssetType,
  RiskLevel,
  type LoanRequest,
  type CollateralAsset
} from '../../src/services/collateral';

describe('CollateralRouterService', () => {
  beforeEach(() => {
    // Reset metrics before each test
    CollateralRouterService.resetMetrics();
  });

  describe('Asset Type Detection', () => {
    it('should detect RWA collateral type', async () => {
      const request: LoanRequest = {
        requestId: 'req_001',
        userId: 'user_001',
        collateralAssets: [
          {
            assetId: 'asset_001',
            assetType: AssetType.REAL_ESTATE,
            value: 100000,
            currency: 'USD'
          }
        ],
        requestedAmount: 50000,
        currency: 'USD',
        timestamp: new Date()
      };

      const decision = await CollateralRouterService.routeLoanRequest(request);

      expect(decision.collateralType).toBe(CollateralType.RWA);
      expect(decision.targetEngine).toBe('rwa');
      expect(decision.rwaAssets).toHaveLength(1);
      expect(decision.cryptoAssets).toHaveLength(0);
    });

    it('should detect Crypto collateral type', async () => {
      const request: LoanRequest = {
        requestId: 'req_002',
        userId: 'user_002',
        collateralAssets: [
          {
            assetId: 'asset_002',
            assetType: AssetType.SUI,
            value: 10000,
            currency: 'USD'
          }
        ],
        requestedAmount: 3000,
        currency: 'USD',
        timestamp: new Date()
      };

      const decision = await CollateralRouterService.routeLoanRequest(request);

      expect(decision.collateralType).toBe(CollateralType.CRYPTO);
      expect(decision.targetEngine).toBe('crypto');
      expect(decision.rwaAssets).toHaveLength(0);
      expect(decision.cryptoAssets).toHaveLength(1);
    });

    it('should detect Mixed collateral type', async () => {
      const request: LoanRequest = {
        requestId: 'req_003',
        userId: 'user_003',
        collateralAssets: [
          {
            assetId: 'asset_003',
            assetType: AssetType.REAL_ESTATE,
            value: 100000,
            currency: 'USD'
          },
          {
            assetId: 'asset_004',
            assetType: AssetType.SUI,
            value: 10000,
            currency: 'USD'
          }
        ],
        requestedAmount: 50000,
        currency: 'USD',
        timestamp: new Date()
      };

      const decision = await CollateralRouterService.routeLoanRequest(request);

      expect(decision.collateralType).toBe(CollateralType.MIXED);
      expect(decision.targetEngine).toBe('both');
      expect(decision.rwaAssets).toHaveLength(1);
      expect(decision.cryptoAssets).toHaveLength(1);
    });
  });

  describe('Asset Separation', () => {
    it('should correctly separate RWA and Crypto assets', async () => {
      const request: LoanRequest = {
        requestId: 'req_004',
        userId: 'user_004',
        collateralAssets: [
          {
            assetId: 'asset_005',
            assetType: AssetType.VEHICLE,
            value: 30000,
            currency: 'USD'
          },
          {
            assetId: 'asset_006',
            assetType: AssetType.USDC,
            value: 5000,
            currency: 'USD'
          },
          {
            assetId: 'asset_007',
            assetType: AssetType.EQUIPMENT,
            value: 20000,
            currency: 'USD'
          }
        ],
        requestedAmount: 25000,
        currency: 'USD',
        timestamp: new Date()
      };

      const decision = await CollateralRouterService.routeLoanRequest(request);

      expect(decision.rwaAssets).toHaveLength(2);
      expect(decision.cryptoAssets).toHaveLength(1);
      expect(decision.rwaAssets[0].assetType).toBe(AssetType.VEHICLE);
      expect(decision.rwaAssets[1].assetType).toBe(AssetType.EQUIPMENT);
      expect(decision.cryptoAssets[0].assetType).toBe(AssetType.USDC);
    });
  });

  describe('Risk Assessment', () => {
    it('should assess low risk for high-value RWA', async () => {
      const request: LoanRequest = {
        requestId: 'req_005',
        userId: 'user_005',
        collateralAssets: [
          {
            assetId: 'asset_008',
            assetType: AssetType.REAL_ESTATE,
            value: 200000,
            currency: 'USD'
          }
        ],
        requestedAmount: 100000,
        currency: 'USD',
        timestamp: new Date()
      };

      const decision = await CollateralRouterService.routeLoanRequest(request);

      expect(decision.riskAssessment.rwaRisk).toBe(RiskLevel.LOW);
      expect(decision.riskAssessment.overallRisk).toBe(RiskLevel.LOW);
    });

    it('should assess high risk for low-value RWA', async () => {
      const request: LoanRequest = {
        requestId: 'req_006',
        userId: 'user_006',
        collateralAssets: [
          {
            assetId: 'asset_009',
            assetType: AssetType.VEHICLE,
            value: 5000,
            currency: 'USD'
          }
        ],
        requestedAmount: 3000,
        currency: 'USD',
        timestamp: new Date()
      };

      const decision = await CollateralRouterService.routeLoanRequest(request);

      expect(decision.riskAssessment.rwaRisk).toBe(RiskLevel.HIGH);
      expect(decision.riskAssessment.overallRisk).toBe(RiskLevel.HIGH);
    });

    it('should assess low risk for stablecoins', async () => {
      const request: LoanRequest = {
        requestId: 'req_007',
        userId: 'user_007',
        collateralAssets: [
          {
            assetId: 'asset_010',
            assetType: AssetType.USDC,
            value: 10000,
            currency: 'USD'
          }
        ],
        requestedAmount: 3000,
        currency: 'USD',
        timestamp: new Date()
      };

      const decision = await CollateralRouterService.routeLoanRequest(request);

      expect(decision.riskAssessment.cryptoRisk).toBe(RiskLevel.LOW);
      expect(decision.riskAssessment.overallRisk).toBe(RiskLevel.LOW);
    });

    it('should assess medium risk for major crypto', async () => {
      const request: LoanRequest = {
        requestId: 'req_008',
        userId: 'user_008',
        collateralAssets: [
          {
            assetId: 'asset_011',
            assetType: AssetType.SUI,
            value: 10000,
            currency: 'USD'
          }
        ],
        requestedAmount: 3000,
        currency: 'USD',
        timestamp: new Date()
      };

      const decision = await CollateralRouterService.routeLoanRequest(request);

      expect(decision.riskAssessment.cryptoRisk).toBe(RiskLevel.MEDIUM);
      expect(decision.riskAssessment.overallRisk).toBe(RiskLevel.MEDIUM);
    });
  });

  describe('Engine Routing', () => {
    it('should route RWA request to RWA engine', async () => {
      const request: LoanRequest = {
        requestId: 'req_009',
        userId: 'user_009',
        collateralAssets: [
          {
            assetId: 'asset_012',
            assetType: AssetType.REAL_ESTATE,
            value: 100000,
            currency: 'USD'
          }
        ],
        requestedAmount: 50000,
        currency: 'USD',
        timestamp: new Date()
      };

      const decision = await CollateralRouterService.routeLoanRequest(request);
      const responses = await CollateralRouterService.executeRouting(request, decision);

      expect(responses).toHaveLength(1);
      expect(responses[0].engineType).toBe('rwa');
      expect(responses[0].success).toBe(true);
    });

    it('should route Crypto request to Crypto engine', async () => {
      const request: LoanRequest = {
        requestId: 'req_010',
        userId: 'user_010',
        collateralAssets: [
          {
            assetId: 'asset_013',
            assetType: AssetType.SUI,
            value: 10000,
            currency: 'USD'
          }
        ],
        requestedAmount: 3000,
        currency: 'USD',
        timestamp: new Date()
      };

      const decision = await CollateralRouterService.routeLoanRequest(request);
      const responses = await CollateralRouterService.executeRouting(request, decision);

      expect(responses).toHaveLength(1);
      expect(responses[0].engineType).toBe('crypto');
      expect(responses[0].success).toBe(true);
    });

    it('should route Mixed request to both engines', async () => {
      const request: LoanRequest = {
        requestId: 'req_011',
        userId: 'user_011',
        collateralAssets: [
          {
            assetId: 'asset_014',
            assetType: AssetType.REAL_ESTATE,
            value: 100000,
            currency: 'USD'
          },
          {
            assetId: 'asset_015',
            assetType: AssetType.SUI,
            value: 10000,
            currency: 'USD'
          }
        ],
        requestedAmount: 50000,
        currency: 'USD',
        timestamp: new Date()
      };

      const decision = await CollateralRouterService.routeLoanRequest(request);
      const responses = await CollateralRouterService.executeRouting(request, decision);

      expect(responses).toHaveLength(2);
      expect(responses.some(r => r.engineType === 'rwa')).toBe(true);
      expect(responses.some(r => r.engineType === 'crypto')).toBe(true);
    });
  });

  describe('Metrics Tracking', () => {
    it('should track routing metrics', async () => {
      const rwaRequest: LoanRequest = {
        requestId: 'req_012',
        userId: 'user_012',
        collateralAssets: [
          {
            assetId: 'asset_016',
            assetType: AssetType.REAL_ESTATE,
            value: 100000,
            currency: 'USD'
          }
        ],
        requestedAmount: 50000,
        currency: 'USD',
        timestamp: new Date()
      };

      const cryptoRequest: LoanRequest = {
        requestId: 'req_013',
        userId: 'user_013',
        collateralAssets: [
          {
            assetId: 'asset_017',
            assetType: AssetType.SUI,
            value: 10000,
            currency: 'USD'
          }
        ],
        requestedAmount: 3000,
        currency: 'USD',
        timestamp: new Date()
      };

      await CollateralRouterService.routeLoanRequest(rwaRequest);
      await CollateralRouterService.routeLoanRequest(cryptoRequest);

      const metrics = CollateralRouterService.getMetrics();

      expect(metrics.totalRequests).toBe(2);
      expect(metrics.rwaRouted).toBe(1);
      expect(metrics.cryptoRouted).toBe(1);
      expect(metrics.averageProcessingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Validation', () => {
    it('should validate collateral assets', () => {
      const validAssets: CollateralAsset[] = [
        {
          assetId: 'asset_018',
          assetType: AssetType.REAL_ESTATE,
          value: 100000,
          currency: 'USD'
        }
      ];

      const validation = CollateralRouterService.validateCollateralAssets(validAssets);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid assets', () => {
      const invalidAssets: CollateralAsset[] = [
        {
          assetId: '',
          assetType: AssetType.REAL_ESTATE,
          value: -1000,
          currency: ''
        }
      ];

      const validation = CollateralRouterService.validateCollateralAssets(invalidAssets);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should detect empty asset list', () => {
      const validation = CollateralRouterService.validateCollateralAssets([]);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('No collateral assets provided');
    });
  });

  describe('Routing Recommendation', () => {
    it('should provide routing recommendation', async () => {
      const request: LoanRequest = {
        requestId: 'req_014',
        userId: 'user_014',
        collateralAssets: [
          {
            assetId: 'asset_019',
            assetType: AssetType.REAL_ESTATE,
            value: 100000,
            currency: 'USD'
          }
        ],
        requestedAmount: 50000,
        currency: 'USD',
        timestamp: new Date()
      };

      const recommendation = await CollateralRouterService.getRoutingRecommendation(request);

      expect(recommendation.recommendation).toBeDefined();
      expect(recommendation.estimatedApprovalAmount).toBeGreaterThan(0);
      expect(recommendation.estimatedProcessingTime).toBeGreaterThan(0);
    });
  });

  describe('Engine Health', () => {
    it('should check engine health', async () => {
      const health = await CollateralRouterService.checkEngineHealth();

      expect(health.rwa).toBeDefined();
      expect(health.crypto).toBeDefined();
    });

    it('should update engine health', () => {
      CollateralRouterService.updateEngineHealth('rwa', 'degraded');

      const metrics = CollateralRouterService.getMetrics();

      expect(metrics.engineHealth.rwa).toBe('degraded');
    });
  });
});
