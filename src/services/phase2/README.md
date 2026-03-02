# Phase 2: Dividend Distribution System

## Overview

The Dividend Distribution System automates income collection and distribution for fractional asset token holders. It handles rental payments, royalties, and other income streams, calculating pro-rata distributions and providing tax reporting integration.

## Components

### 1. Dividend Distribution Service
**File**: `dividend-distribution-service.ts`

Core service for managing dividend pools and distributions:
- Create and manage dividend pools
- Deposit income to pools
- Create distributions with pro-rata calculations
- Process dividend claims
- Track distribution history

### 2. Income Collection Service
**File**: `income-collection-service.ts`

Automated collection of income from various sources:
- Rental payment collection via bank integration
- Royalty collection from streaming services (Spotify, Apple Music)
- Patent royalty collection
- Scheduled automated collection
- Payment validation and processing

### 3. Tax Reporting Service
**File**: `tax-reporting-service.ts`

Tax reporting and compliance:
- Generate annual tax reports
- Form 1099-DIV generation (US)
- Form 1042-S for non-residents
- Monthly and token-level breakdowns
- CSV and PDF export
- Exchange rate tracking for fiat conversion

## Smart Contracts

### Dividend Pool Contract
**File**: `contracts/sources/phase2/dividend_pool.move`

On-chain dividend management:
- Pool creation and management
- Dividend deposits
- Distribution creation
- Claim processing
- Balance tracking

## Database Models

### DividendPreference
Stores holder preferences:
- Reinvestment settings
- Tax reporting preferences
- Notification settings
- Historical totals

### DividendClaim
Tracks claim history:
- Claim details and status
- Transaction information
- Tax year and fiat values
- Reinvestment tracking

## API Endpoints

### Pool Management
- `POST /api/phase2/dividends/pools` - Create dividend pool
- `GET /api/phase2/dividends/pools/:poolId` - Get pool info
- `POST /api/phase2/dividends/pools/:poolId/deposit` - Deposit dividends
- `POST /api/phase2/dividends/pools/:poolId/distribute` - Create distribution

### Claiming
- `POST /api/phase2/dividends/claim` - Claim dividends
- `GET /api/phase2/dividends/holders/:holder/claimable` - Get claimable amounts

### Tax Reporting
- `GET /api/phase2/dividends/tax-report/:holder` - Generate tax report

### Reinvestment
- `POST /api/phase2/dividends/reinvestment` - Enable auto-reinvestment

### Income Collection
- `POST /api/phase2/dividends/rental-income` - Record rental payment

## Features

### Automated Income Collection
- Bank account integration for rental payments
- Royalty service integration (Spotify, ASCAP, BMI)
- Scheduled collection based on frequency
- Payment validation and reconciliation

### Pro-Rata Distribution
- Automatic calculation based on token holdings
- Fair distribution to all holders
- Minimum distribution thresholds
- Claim period management (30 days)

### Tax Reporting
- Annual tax reports by holder
- US Form 1099-DIV generation
- Monthly and token-level breakdowns
- Exchange rate tracking
- CSV and PDF export

### Reinvestment Options
- Automatic dividend reinvestment
- Configurable reinvestment percentage (0-100%)
- Purchase additional tokens with dividends
- Compound yield optimization

## Usage Examples

### Create Dividend Pool
```typescript
const poolId = await dividendService.createDividendPool(
  tokenId,
  signerAddress
);
```

### Deposit Rental Income
```typescript
await dividendService.depositDividend(
  poolId,
  '1000000000', // 1 SUI
  'rental',
  signerAddress
);
```

### Create Distribution
```typescript
const distribution = await dividendService.createDistribution(
  poolId,
  '100000', // Total token supply
  signerAddress
);
```

### Claim Dividends
```typescript
await dividendService.claimDividend(
  poolId,
  distributionId,
  claimId,
  signerAddress
);
```

### Generate Tax Report
```typescript
const report = await taxService.generateTaxReport(
  holderAddress,
  2024
);
```

### Enable Reinvestment
```typescript
await dividendService.enableReinvestment(
  holderAddress,
  tokenId,
  50 // 50% reinvestment
);
```

## Integration Points

### Bank Integration
- Plaid API for bank account linking
- Webhook notifications for payments
- Automated reconciliation

### Royalty Services
- Spotify API for streaming royalties
- ASCAP/BMI for music performance royalties
- Patent office APIs for patent royalties

### Exchange Rate APIs
- CoinGecko for crypto prices
- Forex APIs for fiat conversion
- Historical rate tracking

## Security Considerations

- Encrypted storage of bank credentials
- Secure API key management
- Transaction signing validation
- Claim deadline enforcement
- Double-claim prevention

## Testing

Property-based tests validate:
- Pro-rata calculation accuracy
- Distribution fairness
- Claim uniqueness
- Tax calculation correctness

## Future Enhancements

- Multi-currency support
- Advanced reinvestment strategies
- Yield optimization algorithms
- Cross-chain dividend distribution
- Institutional reporting features

## Requirements Validation

**Validates Requirements**: 13.5, 15.1

**Property 17**: Dividend Distribution Accuracy
- For any distribution, the sum of all holder claims should equal the total distribution amount
- Pro-rata calculations should be proportional to token holdings
- No holder should receive more than their fair share
