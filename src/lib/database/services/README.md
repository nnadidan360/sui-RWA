# Database as Secondary Lookup System

This directory implements the database as a secondary lookup system with real-time synchronization with the Casper blockchain, as specified in task 16.2 of the Astake specification.

## Overview

The secondary lookup system provides:

- **Database caching layer for blockchain data** - Fast access to frequently requested data
- **Real-time synchronization with on-chain state** - Ensures data consistency with blockchain
- **Conflict resolution prioritizing on-chain data** - Blockchain is always the source of truth
- **Automated reconciliation and audit processes** - Maintains data integrity and detects issues

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │    │  Secondary      │    │   Blockchain    │
│     Layer       │◄──►│  Lookup         │◄──►│   (Primary)     │
│                 │    │  Service        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Database      │
                       │  (Secondary)    │
                       │                 │
                       └─────────────────┘
```

## Key Components

### 1. Secondary Lookup Service (`secondary-lookup-service.ts`)

The main service that implements the secondary lookup pattern:

- **Primary Source**: Always tries blockchain first
- **Secondary Source**: Falls back to database when blockchain unavailable
- **Caching Layer**: Intelligent caching with configurable TTL
- **Background Updates**: Updates database in background for consistency

```typescript
// Example usage
const asset = await secondaryLookupService.getAssetData('asset_123', {
  preferCache: false,        // Always try blockchain first
  fallbackToDatabase: true,  // Use database if blockchain fails
  maxAge: 300000            // 5 minute cache TTL
});
```

### 2. Blockchain Sync Service (`blockchain-sync-service.ts`)

Handles real-time synchronization with the Casper blockchain:

- **Real Blockchain Integration**: Replaces mock implementations with actual Casper RPC calls
- **Conflict Detection**: Identifies discrepancies between blockchain and database
- **Automated Resolution**: Resolves conflicts by prioritizing on-chain data
- **Incremental Sync**: Efficient synchronization of only changed data

```typescript
// Service automatically syncs every 30 seconds
await blockchainSyncService.startSync();

// Manual sync when needed
await blockchainSyncService.forceSync();
```

### 3. Integrated Data Service (`integrated-data-service.ts`)

Provides a unified interface for all data operations:

- **Service Orchestration**: Coordinates all database and blockchain services
- **Health Monitoring**: Comprehensive service health and metrics
- **Configuration Management**: Centralized configuration for all services
- **Error Handling**: Graceful degradation during service failures

```typescript
// Initialize all services
await integratedDataService.initialize();

// Get data with intelligent sourcing
const asset = await integratedDataService.getAsset('asset_123');
const balance = await integratedDataService.getUserBalance('0x123...');
```

### 4. Reconciliation Service (`reconciliation-service.ts`)

Automated data integrity and reconciliation:

- **Data Integrity Checks**: Validates data consistency across collections
- **Referential Integrity**: Ensures relationships between collections are valid
- **Automated Fixes**: Resolves common data integrity issues automatically
- **Audit Reporting**: Generates comprehensive reconciliation reports

## Data Flow

### 1. Read Operations (Secondary Lookup Pattern)

```
Application Request
       │
       ▼
┌─────────────────┐
│  Check Cache    │──── Cache Hit ────► Return Cached Data
└─────────────────┘
       │ Cache Miss
       ▼
┌─────────────────┐
│ Query Blockchain│──── Success ────► Cache & Return Data
└─────────────────┘                          │
       │ Failure                             ▼
       ▼                            ┌─────────────────┐
┌─────────────────┐                 │ Update Database │
│ Query Database  │──── Success ──► │  (Background)   │
└─────────────────┘                 └─────────────────┘
       │ Failure
       ▼
   Return Error
```

### 2. Write Operations (Blockchain Priority)

```
Application Write
       │
       ▼
┌─────────────────┐
│ Write to        │──── Success ────► Update Database
│ Blockchain      │                   (Background)
└─────────────────┘                          │
       │ Failure                             ▼
       ▼                            ┌─────────────────┐
   Return Error                     │ Invalidate Cache│
                                    └─────────────────┘
```

### 3. Synchronization Process

```
Periodic Sync (30s)
       │
       ▼
┌─────────────────┐
│ Get Changed     │
│ Data from       │
│ Blockchain      │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ Compare with    │
│ Database        │
└─────────────────┘
       │
       ▼
┌─────────────────┐    ┌─────────────────┐
│ Detect          │───►│ Resolve         │
│ Conflicts       │    │ Conflicts       │
└─────────────────┘    └─────────────────┘
       │                       │
       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Update          │    │ Invalidate      │
│ Database        │    │ Cache           │
└─────────────────┘    └─────────────────┘
```

## Real Blockchain Integration

The system integrates with actual Casper blockchain through:

### Asset Token Information
```typescript
// Real implementation replaces mock data
const assetInfo = await casperService.getAssetTokenInfo(tokenId);
// Returns: { tokenId, owner, assetValue, verified, contractAddress, blockNumber }
```

### Account Balances
```typescript
// Real Casper balance queries
const balance = await casperService.getAccountBalance(walletAddress);
// Returns: balance in CSPR
```

### Transaction Status
```typescript
// Real deploy information from Casper network
const deployInfo = await casperClient.getDeployInfo(deployHash);
// Returns: execution results, status, gas costs, etc.
```

### Staking Metrics
```typescript
// Real staking data from contracts
const stakingMetrics = await casperService.getStakingMetrics(walletAddress);
// Returns: totalStaked, rewards, exchangeRate, etc.
```

## Conflict Resolution

The system handles conflicts between blockchain and database data:

### 1. Conflict Detection
- Compares blockchain data with database data
- Identifies discrepancies in ownership, valuations, status, etc.
- Records conflicts with detailed information

### 2. Resolution Strategy
- **On-chain Priority**: Blockchain data always takes precedence
- **Automatic Resolution**: Common conflicts resolved automatically
- **Manual Review**: Complex conflicts flagged for manual review
- **Audit Trail**: All resolutions logged for compliance

### 3. Example Conflict Resolution
```typescript
// Detected conflict: Asset owner mismatch
const conflict = {
  type: 'asset',
  identifier: 'asset_123',
  onChainData: { owner: '0xabc...' },
  offChainData: { owner: '0xdef...' },
  conflictFields: ['owner']
};

// Automatic resolution: Update database with blockchain data
await Asset.updateOne(
  { tokenId: 'asset_123' },
  { owner: '0xabc...', updatedAt: new Date() }
);
```

## Performance Optimization

### 1. Intelligent Caching
- **Configurable TTL**: Different cache durations for different data types
- **LRU Eviction**: Automatic cleanup of old cache entries
- **Pattern Invalidation**: Bulk cache invalidation by pattern matching
- **Background Updates**: Database updated without blocking requests

### 2. Batch Operations
- **Batch Processing**: Multiple requests processed efficiently
- **Rate Limiting**: Prevents overwhelming blockchain with requests
- **Parallel Processing**: Concurrent requests where possible
- **Circuit Breakers**: Automatic fallback during high failure rates

### 3. Connection Management
- **Connection Pooling**: Efficient database connection reuse
- **Failover Support**: Multiple RPC endpoints with automatic failover
- **Health Monitoring**: Continuous monitoring of service health
- **Graceful Degradation**: Maintains functionality during partial failures

## Monitoring and Observability

### 1. Service Health
```typescript
const health = await integratedDataService.getServiceHealth();
// Returns: overall health, component status, performance metrics
```

### 2. Cache Statistics
```typescript
const stats = secondaryLookupService.getCacheStats();
// Returns: hit rate, cache size, query counts, performance metrics
```

### 3. Conflict Monitoring
```typescript
const conflicts = blockchainSyncService.getUnresolvedConflicts();
// Returns: list of unresolved conflicts requiring attention
```

### 4. Reconciliation Reports
```typescript
const report = await reconciliationService.forceReconciliation();
// Returns: data integrity issues, resolved conflicts, recommendations
```

## Configuration

### Service Configuration
```typescript
const config = {
  enableRealTimeSync: true,
  enableReconciliation: true,
  cachePreferences: {
    defaultTtl: 300000,      // 5 minutes
    preferCache: true,
    fallbackToDatabase: true
  },
  syncIntervals: {
    blockchain: 30000,       // 30 seconds
    reconciliation: 3600000  // 1 hour
  }
};
```

### Cache Configuration
```typescript
const cacheConfig = {
  defaultCacheTtl: 300000,   // 5 minutes default
  maxCacheSize: 10000,       // Maximum cache entries
  cleanupInterval: 300000    // Cache cleanup every 5 minutes
};
```

## Usage Examples

### Basic Asset Lookup
```typescript
// Get asset with blockchain priority
const asset = await secondaryLookupService.getAssetData('asset_123');

// Force refresh from blockchain
const freshAsset = await secondaryLookupService.getAssetData('asset_123', {
  forceRefresh: true
});

// Database fallback only
const cachedAsset = await secondaryLookupService.getAssetData('asset_123', {
  preferCache: true,
  fallbackToDatabase: true
});
```

### Batch Operations
```typescript
// Efficiently get multiple assets
const tokenIds = ['asset_1', 'asset_2', 'asset_3'];
const results = await secondaryLookupService.batchGetAssets(tokenIds);
```

### User Data Refresh
```typescript
// Refresh all user data from blockchain
await secondaryLookupService.refreshUserData('0x123...');

// Or use integrated service
await integratedDataService.refreshUserData('0x123...');
```

### Service Management
```typescript
// Initialize all services
await integratedDataService.initialize();

// Get service health
const health = await integratedDataService.getServiceHealth();

// Manual conflict resolution
await integratedDataService.resolveConflicts();

// Shutdown services
await integratedDataService.shutdown();
```

## Error Handling

The system provides robust error handling:

### 1. Blockchain Failures
- Automatic fallback to database
- Retry mechanisms with exponential backoff
- Circuit breakers to prevent cascade failures
- Graceful degradation of functionality

### 2. Database Failures
- Connection pooling and retry logic
- Read-only mode during database issues
- Data consistency checks and recovery
- Automatic reconnection attempts

### 3. Cache Failures
- Bypass cache and query directly
- Cache rebuilding from primary sources
- Memory management and cleanup
- Performance monitoring and alerting

## Testing

### Unit Tests
- Individual service functionality
- Cache behavior and invalidation
- Conflict detection and resolution
- Error handling and edge cases

### Integration Tests
- End-to-end data flow
- Service interaction and coordination
- Blockchain integration testing
- Performance and load testing

### Demonstration
Run the demonstration to see the system in action:
```bash
npm run demo:secondary-lookup
```

## Deployment Considerations

### 1. Environment Configuration
- Configure Casper RPC endpoints
- Set up MongoDB connection strings
- Configure cache sizes and TTLs
- Set sync intervals based on requirements

### 2. Monitoring Setup
- Set up health check endpoints
- Configure alerting for conflicts
- Monitor cache hit rates and performance
- Track blockchain connectivity status

### 3. Scaling Considerations
- Horizontal scaling of cache layer
- Database read replicas for performance
- Load balancing of blockchain requests
- Distributed conflict resolution

## Compliance and Auditing

### 1. Audit Trails
- All data modifications logged
- Conflict resolutions tracked
- Service health events recorded
- Performance metrics archived

### 2. Data Integrity
- Regular integrity checks
- Automated reconciliation reports
- Conflict resolution documentation
- Compliance reporting capabilities

## Future Enhancements

### 1. Advanced Caching
- Distributed caching with Redis
- Cache warming strategies
- Predictive cache preloading
- Cache analytics and optimization

### 2. Enhanced Monitoring
- Real-time dashboards
- Predictive alerting
- Performance optimization recommendations
- Automated scaling based on load

### 3. Machine Learning Integration
- Conflict prediction and prevention
- Cache optimization using ML
- Anomaly detection in data patterns
- Automated performance tuning

---

This implementation successfully completes task 16.2 by providing a comprehensive database as secondary lookup system with real blockchain integration, intelligent caching, conflict resolution, and automated reconciliation processes.