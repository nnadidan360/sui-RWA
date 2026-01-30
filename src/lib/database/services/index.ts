/**
 * Database Services Index
 * 
 * Exports all database services for comprehensive off-chain data management
 */

export { assetWorkflowService, type WorkflowStage, type WorkflowProgress, type DocumentVersion } from './asset-workflow-service';
export { userAnalyticsService, type UserActivityMetrics, type ActivityInsight, type SearchFilters } from './user-analytics-service';
export { crossWalletCorrelationService, type WalletRelationship, type TransactionFlow, type CorrelationAnalysis } from './cross-wallet-correlation-service';
export { documentVersionControlService, type DocumentHistory, type VersionComparison } from './document-version-control-service';
export { comprehensiveDataManagementService, type ComprehensiveSearchFilters, type PlatformMetrics } from './comprehensive-data-management-service';

// Re-export existing services
export { enhancedDatabaseService } from './enhanced-database-service';
export { blockchainSyncService } from './blockchain-sync-service';
export { databaseCacheService } from './database-cache-service';
export { reconciliationService } from './reconciliation-service';
export { secondaryLookupService, type CacheEntry, type LookupOptions, type SyncStatus } from './secondary-lookup-service';