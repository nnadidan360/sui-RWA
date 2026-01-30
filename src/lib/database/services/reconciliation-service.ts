/**
 * Automated Reconciliation Service
 * 
 * Provides automated reconciliation and audit processes:
 * - Periodic data consistency checks
 * - Automated conflict detection and resolution
 * - Audit trail generation and monitoring
 * - Data integrity validation
 */

import { connectToDatabase } from '../connection';
import { Asset, User, Transaction, Wallet } from '../models/index';
import { blockchainSyncService, type SyncConflict } from './blockchain-sync-service';
import { databaseCacheService } from './database-cache-service';

export interface ReconciliationReport {
  timestamp: Date;
  totalRecords: {
    assets: number;
    users: number;
    transactions: number;
    wallets: number;
  };
  inconsistencies: {
    type: string;
    count: number;
    details: any[];
  }[];
  resolved: number;
  unresolved: number;
  recommendations: string[];
}

export interface DataIntegrityIssue {
  type: 'missing_reference' | 'orphaned_record' | 'data_mismatch' | 'constraint_violation';
  collection: string;
  recordId: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
  resolved: boolean;
  resolutionAction?: string;
}

export class ReconciliationService {
  private reconciliationInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastReconciliation: Date = new Date(0);
  private integrityIssues: Map<string, DataIntegrityIssue> = new Map();

  constructor(
    private reconciliationIntervalMs: number = 3600000, // 1 hour
    private batchSize: number = 1000
  ) {}

  /**
   * Start the automated reconciliation service
   */
  async startReconciliation(): Promise<void> {
    if (this.isRunning) {
      console.log('Reconciliation service is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting automated reconciliation service...');

    // Initial reconciliation
    await this.performFullReconciliation();

    // Set up periodic reconciliation
    this.reconciliationInterval = setInterval(async () => {
      try {
        await this.performFullReconciliation();
      } catch (error) {
        console.error('Error during automated reconciliation:', error);
      }
    }, this.reconciliationIntervalMs);

    console.log(`Reconciliation service started with ${this.reconciliationIntervalMs}ms interval`);
  }

  /**
   * Stop the automated reconciliation service
   */
  async stopReconciliation(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.reconciliationInterval) {
      clearInterval(this.reconciliationInterval);
      this.reconciliationInterval = null;
    }

    console.log('Automated reconciliation service stopped');
  }

  /**
   * Perform full reconciliation of all data
   */
  async performFullReconciliation(): Promise<ReconciliationReport> {
    console.log('Starting full data reconciliation...');
    
    try {
      await connectToDatabase();

      const report: ReconciliationReport = {
        timestamp: new Date(),
        totalRecords: {
          assets: 0,
          users: 0,
          transactions: 0,
          wallets: 0
        },
        inconsistencies: [],
        resolved: 0,
        unresolved: 0,
        recommendations: []
      };

      // Count total records
      report.totalRecords.assets = await Asset.countDocuments();
      report.totalRecords.users = await User.countDocuments();
      report.totalRecords.transactions = await Transaction.countDocuments();
      report.totalRecords.wallets = await Wallet.countDocuments();

      // Check data integrity
      await this.checkAssetIntegrity(report);
      await this.checkUserIntegrity(report);
      await this.checkTransactionIntegrity(report);
      await this.checkWalletIntegrity(report);

      // Check referential integrity
      await this.checkReferentialIntegrity(report);

      // Resolve issues
      await this.resolveIntegrityIssues(report);

      // Generate recommendations
      this.generateRecommendations(report);

      this.lastReconciliation = new Date();
      console.log('Full data reconciliation completed');

      return report;
    } catch (error) {
      console.error('Error during full reconciliation:', error);
      throw error;
    }
  }

  /**
   * Check asset data integrity
   */
  private async checkAssetIntegrity(report: ReconciliationReport): Promise<void> {
    console.log('Checking asset data integrity...');

    const issues: any[] = [];
    let processed = 0;

    while (processed < report.totalRecords.assets) {
      const assets = await Asset.find({})
        .skip(processed)
        .limit(this.batchSize);

      for (const asset of assets) {
        // Check required fields
        if (!asset.tokenId || !asset.owner || !asset.assetType) {
          const issue: DataIntegrityIssue = {
            type: 'constraint_violation',
            collection: 'assets',
            recordId: asset._id.toString(),
            description: 'Missing required fields',
            severity: 'high',
            detectedAt: new Date(),
            resolved: false
          };
          this.integrityIssues.set(`asset_${asset._id}`, issue);
          issues.push(issue);
        }

        // Check valuation consistency
        if (asset.financialData?.currentValue !== asset.metadata?.valuation?.amount) {
          const issue: DataIntegrityIssue = {
            type: 'data_mismatch',
            collection: 'assets',
            recordId: asset._id.toString(),
            description: 'Valuation mismatch between financialData and metadata',
            severity: 'medium',
            detectedAt: new Date(),
            resolved: false
          };
          this.integrityIssues.set(`asset_valuation_${asset._id}`, issue);
          issues.push(issue);
        }

        // Check IPFS document integrity
        if (asset.metadata?.documents) {
          for (const doc of asset.metadata.documents) {
            if (!doc.ipfsHash || !doc.fileName) {
              const issue: DataIntegrityIssue = {
                type: 'constraint_violation',
                collection: 'assets',
                recordId: asset._id.toString(),
                description: 'Document missing IPFS hash or filename',
                severity: 'medium',
                detectedAt: new Date(),
                resolved: false
              };
              this.integrityIssues.set(`asset_doc_${asset._id}_${doc._id}`, issue);
              issues.push(issue);
            }
          }
        }
      }

      processed += assets.length;
    }

    if (issues.length > 0) {
      report.inconsistencies.push({
        type: 'asset_integrity',
        count: issues.length,
        details: issues
      });
    }
  }

  /**
   * Check user data integrity
   */
  private async checkUserIntegrity(report: ReconciliationReport): Promise<void> {
    console.log('Checking user data integrity...');

    const issues: any[] = [];
    let processed = 0;

    while (processed < report.totalRecords.users) {
      const users = await User.find({})
        .skip(processed)
        .limit(this.batchSize);

      for (const user of users) {
        // Check required fields
        if (!user.walletAddress) {
          const issue: DataIntegrityIssue = {
            type: 'constraint_violation',
            collection: 'users',
            recordId: user._id.toString(),
            description: 'Missing wallet address',
            severity: 'critical',
            detectedAt: new Date(),
            resolved: false
          };
          this.integrityIssues.set(`user_${user._id}`, issue);
          issues.push(issue);
        }

        // Check connected wallets consistency
        if (user.connectedWallets) {
          const primaryWalletInConnected = user.connectedWallets.some(
            (wallet: any) => wallet.address === user.walletAddress
          );
          
          if (!primaryWalletInConnected) {
            const issue: DataIntegrityIssue = {
              type: 'data_mismatch',
              collection: 'users',
              recordId: user._id.toString(),
              description: 'Primary wallet not found in connected wallets',
              severity: 'medium',
              detectedAt: new Date(),
              resolved: false
            };
            this.integrityIssues.set(`user_wallet_${user._id}`, issue);
            issues.push(issue);
          }
        }

        // Check email format if provided
        if (user.email && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(user.email)) {
          const issue: DataIntegrityIssue = {
            type: 'constraint_violation',
            collection: 'users',
            recordId: user._id.toString(),
            description: 'Invalid email format',
            severity: 'low',
            detectedAt: new Date(),
            resolved: false
          };
          this.integrityIssues.set(`user_email_${user._id}`, issue);
          issues.push(issue);
        }
      }

      processed += users.length;
    }

    if (issues.length > 0) {
      report.inconsistencies.push({
        type: 'user_integrity',
        count: issues.length,
        details: issues
      });
    }
  }

  /**
   * Check transaction data integrity
   */
  private async checkTransactionIntegrity(report: ReconciliationReport): Promise<void> {
    console.log('Checking transaction data integrity...');

    const issues: any[] = [];
    let processed = 0;

    while (processed < report.totalRecords.transactions) {
      const transactions = await Transaction.find({})
        .skip(processed)
        .limit(this.batchSize);

      for (const transaction of transactions) {
        // Check required fields
        if (!transaction.transactionId || !transaction.type || !transaction.initiator) {
          const issue: DataIntegrityIssue = {
            type: 'constraint_violation',
            collection: 'transactions',
            recordId: transaction._id.toString(),
            description: 'Missing required transaction fields',
            severity: 'high',
            detectedAt: new Date(),
            resolved: false
          };
          this.integrityIssues.set(`transaction_${transaction._id}`, issue);
          issues.push(issue);
        }

        // Check status consistency
        if (transaction.status === 'success' && !transaction.confirmedAt) {
          const issue: DataIntegrityIssue = {
            type: 'data_mismatch',
            collection: 'transactions',
            recordId: transaction._id.toString(),
            description: 'Successful transaction missing confirmation timestamp',
            severity: 'medium',
            detectedAt: new Date(),
            resolved: false
          };
          this.integrityIssues.set(`transaction_status_${transaction._id}`, issue);
          issues.push(issue);
        }

        // Check amount consistency
        if (transaction.amount && transaction.amount < 0) {
          const issue: DataIntegrityIssue = {
            type: 'constraint_violation',
            collection: 'transactions',
            recordId: transaction._id.toString(),
            description: 'Negative transaction amount',
            severity: 'high',
            detectedAt: new Date(),
            resolved: false
          };
          this.integrityIssues.set(`transaction_amount_${transaction._id}`, issue);
          issues.push(issue);
        }
      }

      processed += transactions.length;
    }

    if (issues.length > 0) {
      report.inconsistencies.push({
        type: 'transaction_integrity',
        count: issues.length,
        details: issues
      });
    }
  }

  /**
   * Check wallet data integrity
   */
  private async checkWalletIntegrity(report: ReconciliationReport): Promise<void> {
    console.log('Checking wallet data integrity...');

    const issues: any[] = [];
    let processed = 0;

    while (processed < report.totalRecords.wallets) {
      const wallets = await Wallet.find({})
        .skip(processed)
        .limit(this.batchSize);

      for (const wallet of wallets) {
        // Check required fields
        if (!wallet.address || !wallet.walletType || !wallet.userId) {
          const issue: DataIntegrityIssue = {
            type: 'constraint_violation',
            collection: 'wallets',
            recordId: wallet._id.toString(),
            description: 'Missing required wallet fields',
            severity: 'high',
            detectedAt: new Date(),
            resolved: false
          };
          this.integrityIssues.set(`wallet_${wallet._id}`, issue);
          issues.push(issue);
        }

        // Check statistics consistency
        if (wallet.statistics) {
          if (wallet.statistics.totalTransactions > 0 && wallet.statistics.totalVolume === 0) {
            const issue: DataIntegrityIssue = {
              type: 'data_mismatch',
              collection: 'wallets',
              recordId: wallet._id.toString(),
              description: 'Wallet has transactions but zero volume',
              severity: 'low',
              detectedAt: new Date(),
              resolved: false
            };
            this.integrityIssues.set(`wallet_stats_${wallet._id}`, issue);
            issues.push(issue);
          }
        }
      }

      processed += wallets.length;
    }

    if (issues.length > 0) {
      report.inconsistencies.push({
        type: 'wallet_integrity',
        count: issues.length,
        details: issues
      });
    }
  }

  /**
   * Check referential integrity between collections
   */
  private async checkReferentialIntegrity(report: ReconciliationReport): Promise<void> {
    console.log('Checking referential integrity...');

    const issues: any[] = [];

    // Check asset ownership references
    const assets = await Asset.find({}, { owner: 1, tokenId: 1 }).limit(this.batchSize);
    for (const asset of assets) {
      const user = await User.findOne({
        $or: [
          { walletAddress: asset.owner },
          { 'connectedWallets.address': asset.owner }
        ]
      });

      if (!user) {
        const issue: DataIntegrityIssue = {
          type: 'missing_reference',
          collection: 'assets',
          recordId: asset._id.toString(),
          description: `Asset owner ${asset.owner} not found in users collection`,
          severity: 'high',
          detectedAt: new Date(),
          resolved: false
        };
        this.integrityIssues.set(`asset_owner_${asset._id}`, issue);
        issues.push(issue);
      }
    }

    // Check transaction initiator references
    const transactions = await Transaction.find({}, { initiator: 1, transactionId: 1 }).limit(this.batchSize);
    for (const transaction of transactions) {
      const user = await User.findOne({
        $or: [
          { walletAddress: transaction.initiator },
          { 'connectedWallets.address': transaction.initiator }
        ]
      });

      if (!user) {
        const issue: DataIntegrityIssue = {
          type: 'missing_reference',
          collection: 'transactions',
          recordId: transaction._id.toString(),
          description: `Transaction initiator ${transaction.initiator} not found in users collection`,
          severity: 'medium',
          detectedAt: new Date(),
          resolved: false
        };
        this.integrityIssues.set(`transaction_initiator_${transaction._id}`, issue);
        issues.push(issue);
      }
    }

    if (issues.length > 0) {
      report.inconsistencies.push({
        type: 'referential_integrity',
        count: issues.length,
        details: issues
      });
    }
  }

  /**
   * Resolve integrity issues automatically where possible
   */
  private async resolveIntegrityIssues(report: ReconciliationReport): Promise<void> {
    console.log('Resolving integrity issues...');

    let resolved = 0;
    let unresolved = 0;

    for (const [key, issue] of this.integrityIssues) {
      if (issue.resolved) {
        continue;
      }

      try {
        const wasResolved = await this.resolveIssue(issue);
        if (wasResolved) {
          issue.resolved = true;
          issue.resolutionAction = 'automated_fix';
          resolved++;
        } else {
          unresolved++;
        }
      } catch (error) {
        console.error(`Error resolving issue ${key}:`, error);
        unresolved++;
      }
    }

    report.resolved = resolved;
    report.unresolved = unresolved;
  }

  /**
   * Attempt to resolve a specific integrity issue
   */
  private async resolveIssue(issue: DataIntegrityIssue): Promise<boolean> {
    switch (issue.type) {
      case 'data_mismatch':
        return await this.resolveDataMismatch(issue);
      case 'constraint_violation':
        return await this.resolveConstraintViolation(issue);
      case 'missing_reference':
        return await this.resolveMissingReference(issue);
      default:
        return false;
    }
  }

  private async resolveDataMismatch(issue: DataIntegrityIssue): Promise<boolean> {
    // For data mismatches, we typically need manual review
    // But some can be resolved automatically
    if (issue.description.includes('valuation mismatch')) {
      // Sync with blockchain data
      await blockchainSyncService.forceSync();
      return true;
    }
    return false;
  }

  private async resolveConstraintViolation(issue: DataIntegrityIssue): Promise<boolean> {
    // Most constraint violations require manual intervention
    // But some can be fixed automatically
    if (issue.description.includes('Negative transaction amount')) {
      // This is likely a data corruption issue that needs manual review
      return false;
    }
    return false;
  }

  private async resolveMissingReference(issue: DataIntegrityIssue): Promise<boolean> {
    // Missing references usually can't be resolved automatically
    // They require investigation and manual data correction
    return false;
  }

  /**
   * Generate recommendations based on reconciliation results
   */
  private generateRecommendations(report: ReconciliationReport): void {
    const recommendations: string[] = [];

    // Check cache performance
    const cacheStats = databaseCacheService.getCacheStats();
    if (cacheStats.hitRate < 0.8) {
      recommendations.push('Consider increasing cache TTL or size to improve hit rate');
    }

    // Check sync conflicts
    const conflicts = blockchainSyncService.getUnresolvedConflicts();
    if (conflicts.length > 0) {
      recommendations.push(`Review ${conflicts.length} unresolved blockchain sync conflicts`);
    }

    // Check data integrity issues
    const criticalIssues = Array.from(this.integrityIssues.values())
      .filter(issue => !issue.resolved && issue.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push(`Immediately address ${criticalIssues.length} critical data integrity issues`);
    }

    // Check database performance
    if (report.totalRecords.assets > 10000) {
      recommendations.push('Consider implementing database sharding for better performance');
    }

    report.recommendations = recommendations;
  }

  /**
   * Public methods for monitoring and management
   */
  public getIntegrityIssues(): DataIntegrityIssue[] {
    return Array.from(this.integrityIssues.values());
  }

  public getUnresolvedIssues(): DataIntegrityIssue[] {
    return Array.from(this.integrityIssues.values()).filter(issue => !issue.resolved);
  }

  public async forceReconciliation(): Promise<ReconciliationReport> {
    return await this.performFullReconciliation();
  }

  public getLastReconciliationTime(): Date {
    return this.lastReconciliation;
  }

  public isServiceRunning(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const reconciliationService = new ReconciliationService();