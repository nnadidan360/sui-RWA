# Collateral Router Service

This module implements the collateral routing system for Credit OS, intelligently routing loan requests between RWA (Real-World Assets) and Crypto Collateral Engines based on asset type and risk assessment.

## Overview

The Collateral Router is a critical component that maintains isolated risk management for each collateral engine while providing unified loan request processing. It automatically detects asset types, assesses risk, and routes requests to the appropriate engine(s).

## Requirements

Implements requirement **10.2**: Intelligent routing between RWA and crypto collateral engines based on asset type with isolated risk logic.

## Architecture

```
User Loan Request
       ↓
Collateral Router
├─ Asset Type Detection
├─ Risk Assessment
└─ Engine Routing
   ├─→ RWA Engine (Document-based assets)
   │   - Real Estate
   │   - Vehicles
   │   - Equipment
   │   - Invoices
   │   - Commodities
   │
   └─→ Crypto Engine (Digital assets)
       - SUI
       - USDC/USDT (Stablecoins)
       - WETH/WBTC (Major crypto)
       - Other cryptocurrencies
```

## Features

### 1. Automatic Asset Type Detection
- Identifies RWA vs Crypto assets
- Detects mixed collateral scenarios
- Validates asset data integrity

### 2. Isolated Risk Assessment
- **RWA Risk**: Based on asset value, count, and type
- **Crypto Risk**: Based on volatility (stablecoins vs major crypto vs altcoins)
- **Overall Risk**: Highest risk level across all assets

### 3. Intelligent Routing
- Routes to single engine for pure RWA or Crypto
- Routes to both engines for mixed collateral
- Maintains engine isolation for risk management

### 4. Metrics & Monitoring
- Tracks routing statistics
- Monitors engine health
- Measures processing times
- Calculates success rates

## Usage

### Basic Routing

```typescript
import { CollateralRouterService, AssetType } from './services/collateral';

// Create loan request
const request = {
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

// Route the request
const decision = await CollateralRouterService.routeLoanRequest(request);

console.log(decision.collateralType);  // 'rwa'
console.log(decision.targetEngine);    // 'rwa'
console.log(decision.riskAssessment);  // { rwaRisk: 'low', overallRisk: 'low' }

// Execute routing
const responses = await CollateralRouterService.executeRouting(request, decision);

console.log(responses[0].success);      // true
console.log(responses[0].loanId);       // 'rwa_loan_...'
console.log(responses[0].approvedAmount); // 70000 (70% LTV)
```

### Mixed Collateral

```typescript
const mixedRequest = {
  requestId: 'req_002',
  userId: 'user_002',
  collateralAssets: [
    {
      assetId: 'asset_002',
      assetType: AssetType.REAL_ESTATE,
      value: 100000,
      currency: 'USD'
    },
    {
      assetId: 'asset_003',
      assetType: AssetType.SUI,
      value: 10000,
      currency: 'USD'
    }
  ],
  requestedAmount: 50000,
  currency: 'USD',
  timestamp: new Date()
};

const decision = await CollateralRouterService.routeLoanRequest(mixedRequest);

console.log(decision.collateralType);  // 'mixed'
console.log(decision.targetEngine);    // 'both'
console.log(decision.rwaAssets);       // [{ assetType: 'real_estate', ... }]
console.log(decision.cryptoAssets);    // [{ assetType: 'sui', ... }]

// Execute routing (processes both engines in parallel)
const responses = await CollateralRouterService.executeRouting(mixedRequest, decision);

console.log(responses.length);         // 2
console.log(responses[0].engineType);  // 'rwa'
console.log(responses[1].engineType);  // 'crypto'
```

### Validation

```typescript
// Validate collateral assets before routing
const validation = CollateralRouterService.validateCollateralAssets(assets);

if (!validation.valid) {
  console.error('Invalid assets:', validation.errors);
  // ['Asset missing ID', 'Asset has invalid value', ...]
}
```

### Routing Recommendation

```typescript
// Get routing recommendation without executing
const recommendation = await CollateralRouterService.getRoutingRecommendation(request);

console.log(recommendation.recommendation);           // RoutingDecision
console.log(recommendation.estimatedApprovalAmount);  // 70000
console.log(recommendation.estimatedProcessingTime);  // 100ms
```

### Metrics & Monitoring

```typescript
// Get router metrics
const metrics = CollateralRouterService.getMetrics();

console.log(metrics.totalRequests);          // 150
console.log(metrics.rwaRouted);              // 80
console.log(metrics.cryptoRouted);           // 50
console.log(metrics.mixedRouted);            // 20
console.log(metrics.successRate);            // 0.95
console.log(metrics.averageProcessingTime);  // 75ms

// Check engine health
const health = await CollateralRouterService.checkEngineHealth();

console.log(health.rwa);     // 'healthy' | 'degraded' | 'down'
console.log(health.crypto);  // 'healthy' | 'degraded' | 'down'

// Update engine health (for monitoring systems)
CollateralRouterService.updateEngineHealth('rwa', 'degraded');
```

## Asset Types

### RWA Assets
- `REAL_ESTATE`: Property, land, buildings
- `VEHICLE`: Cars, trucks, boats
- `EQUIPMENT`: Machinery, tools, industrial equipment
- `INVOICE`: Business receivables, invoices
- `COMMODITY`: Gold, silver, oil, agricultural products

### Crypto Assets
- `SUI`: Sui blockchain native token
- `USDC`: USD Coin stablecoin
- `USDT`: Tether stablecoin
- `WETH`: Wrapped Ethereum
- `WBTC`: Wrapped Bitcoin
- `OTHER_CRYPTO`: Other cryptocurrencies

## Risk Levels

### RWA Risk Assessment
- **LOW**: High-value assets (>$50k), few assets (<3)
- **MEDIUM**: Medium-value assets ($10k-$50k), moderate count (3-5)
- **HIGH**: Low-value assets (<$10k), many assets (>5)

### Crypto Risk Assessment
- **LOW**: Stablecoins (USDC, USDT)
- **MEDIUM**: Major cryptocurrencies (SUI, WETH, WBTC)
- **HIGH**: Other/unknown cryptocurrencies

### Overall Risk
The overall risk is determined by the highest risk level across all asset categories.

## LTV (Loan-to-Value) Ratios

- **RWA Assets**: 70% LTV
- **Crypto Assets**: 30% LTV (due to volatility)
- **Mixed Collateral**: Calculated separately for each asset type

## Engine Isolation

The router maintains strict isolation between engines:

1. **Separate Risk Assessment**: Each engine has independent risk logic
2. **Independent Processing**: Engines process requests in parallel
3. **Isolated Failures**: Engine failure doesn't affect the other
4. **Separate Metrics**: Each engine tracks its own performance

## Error Handling

```typescript
try {
  const decision = await CollateralRouterService.routeLoanRequest(request);
  const responses = await CollateralRouterService.executeRouting(request, decision);
  
  // Check for engine failures
  for (const response of responses) {
    if (!response.success) {
      console.error(`${response.engineType} engine failed:`, response.error);
    }
  }
} catch (error) {
  console.error('Routing failed:', error.message);
}
```

## Testing

Comprehensive test suite at `tests/collateral/collateral-router.test.ts`:

```bash
npm test -- tests/collateral/collateral-router.test.ts
```

**Test Coverage**:
- ✅ Asset type detection (RWA, Crypto, Mixed)
- ✅ Asset separation logic
- ✅ Risk assessment (RWA and Crypto)
- ✅ Engine routing decisions
- ✅ Metrics tracking
- ✅ Validation logic
- ✅ Routing recommendations
- ✅ Engine health monitoring

**Results**: 18/18 tests passing

## Integration

### With RWA Engine
```typescript
// The router calls the RWA engine for document-based assets
const rwaResponse = await CollateralRouterService.processRWARequest(
  request,
  decision.rwaAssets
);
```

### With Crypto Engine
```typescript
// The router calls the Crypto engine for digital assets
const cryptoResponse = await CollateralRouterService.processCryptoRequest(
  request,
  decision.cryptoAssets
);
```

## Best Practices

### 1. Always Validate Assets
```typescript
const validation = CollateralRouterService.validateCollateralAssets(assets);
if (!validation.valid) {
  throw new Error(`Invalid assets: ${validation.errors.join(', ')}`);
}
```

### 2. Check Engine Health
```typescript
const health = await CollateralRouterService.checkEngineHealth();
if (health.rwa === 'down' || health.crypto === 'down') {
  // Handle degraded service
}
```

### 3. Monitor Metrics
```typescript
const metrics = CollateralRouterService.getMetrics();
if (metrics.successRate < 0.9) {
  // Alert: Success rate below threshold
}
```

### 4. Handle Mixed Collateral
```typescript
if (decision.targetEngine === 'both') {
  // Process both responses
  const [rwaResponse, cryptoResponse] = responses;
  
  // Combine approved amounts
  const totalApproved = 
    (rwaResponse.approvedAmount || 0) + 
    (cryptoResponse.approvedAmount || 0);
}
```

## Future Enhancements

- Cross-collateralization strategies
- Dynamic LTV adjustment based on market conditions
- Machine learning for risk assessment
- Real-time engine load balancing
- Advanced fraud detection integration
- Multi-currency support
- Automated engine failover

## Performance

- **Average Processing Time**: <100ms per request
- **Parallel Processing**: Mixed collateral processed concurrently
- **Scalability**: Stateless design for horizontal scaling
- **Metrics Overhead**: Minimal (<1ms per request)

## Security Considerations

1. **Input Validation**: All assets validated before processing
2. **Engine Isolation**: Failures contained within engines
3. **Risk Assessment**: Independent risk evaluation per engine
4. **Audit Trail**: All routing decisions logged
5. **Access Control**: Integration with auth services required

## Monitoring & Alerts

Recommended monitoring:
- Success rate < 90%
- Average processing time > 200ms
- Engine health degraded/down
- High risk requests > 20%
- Routing failures > 5%

## API Reference

See inline documentation in `collateral-router-service.ts` for detailed API reference.

## Support

For issues or questions about the Collateral Router:
1. Check test suite for usage examples
2. Review inline code documentation
3. Consult design document at `.kiro/specs/credit-os/design.md`
