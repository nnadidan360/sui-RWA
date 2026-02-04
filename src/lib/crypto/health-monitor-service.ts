import { CryptoVault, VaultStatus } from './crypto-vault-service';
import { LTVCalculatorService, HealthFactorResult } from './ltv-calculator-service';

export interface HealthAlert {
  vaultId: string;
  owner: string;
  alertType: 'warning' | 'critical' | 'liquidation' | 'recovery';
  currentLTV: number;
  threshold: number;
  timeToLiquidation?: number;
  recommendedActions: string[];
  createdAt: Date;
}

export interface MonitoringConfig {
  checkIntervalMs: number;
  priceUpdateIntervalMs: number;
  alertCooldownMs: number;
  enableEmailAlerts: boolean;
  enablePushNotifications: boolean;
  enableSMSAlerts: boolean;
}

export interface VaultMonitoringData {
  vault: CryptoVault;
  healthMetrics: HealthFactorResult;
  priceHistory: PricePoint[];
  alertHistory: HealthAlert[];
  lastChecked: Date;
  nextCheckDue: Date;
}

export interface PricePoint {
  timestamp: Date;
  price: number;
  source: string;
}

export class HealthMonitorService {
  private ltvCalculator: LTVCalculatorService;
  private monitoredVaults: Map<string, VaultMonitoringData> = new Map();
  private priceCache: Map<string, PricePoint[]> = new Map();
  private alertHistory: Map<string, HealthAlert[]> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  
  private readonly DEFAULT_CONFIG: MonitoringConfig = {
    checkIntervalMs: 60000, // 1 minute
    priceUpdateIntervalMs: 30000, // 30 seconds
    alertCooldownMs: 300000, // 5 minutes
    enableEmailAlerts: true,
    enablePushNotifications: true,
    enableSMSAlerts: false
  };

  constructor(ltvCalculator: LTVCalculatorService, config?: Partial<MonitoringConfig>) {
    this.ltvCalculator = ltvCalculator;
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  private config: MonitoringConfig;

  /**
   * Start monitoring vaults
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    this.monitoringInterval = setInterval(
      () => this.performHealthChecks(),
      this.config.checkIntervalMs
    );

    console.log(`Health monitoring started with ${this.config.checkIntervalMs}ms interval`);
  }

  /**
   * Stop monitoring vaults
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    console.log('Health monitoring stopped');
  }

  /**
   * Add vault to monitoring
   */
  async addVaultToMonitoring(vault: CryptoVault): Promise<void> {
    const healthMetrics = await this.calculateCurrentHealth(vault);
    
    const monitoringData: VaultMonitoringData = {
      vault,
      healthMetrics,
      priceHistory: await this.getPriceHistory(vault.collateralType, 24), // Last 24 hours
      alertHistory: this.alertHistory.get(vault.vaultId) || [],
      lastChecked: new Date(),
      nextCheckDue: new Date(Date.now() + this.config.checkIntervalMs)
    };

    this.monitoredVaults.set(vault.vaultId, monitoringData);
    console.log(`Added vault ${vault.vaultId} to monitoring`);
  }

  /**
   * Remove vault from monitoring
   */
  removeVaultFromMonitoring(vaultId: string): void {
    this.monitoredVaults.delete(vaultId);
    console.log(`Removed vault ${vaultId} from monitoring`);
  }

  /**
   * Get monitoring data for vault
   */
  getVaultMonitoringData(vaultId: string): VaultMonitoringData | undefined {
    return this.monitoredVaults.get(vaultId);
  }

  /**
   * Get all monitored vaults
   */
  getAllMonitoredVaults(): VaultMonitoringData[] {
    return Array.from(this.monitoredVaults.values());
  }

  /**
   * Get vaults by health status
   */
  getVaultsByStatus(status: 'healthy' | 'warning' | 'critical' | 'liquidation'): VaultMonitoringData[] {
    return this.getAllMonitoredVaults().filter(data => data.healthMetrics.status === status);
  }

  /**
   * Get recent alerts for vault
   */
  getVaultAlerts(vaultId: string, limit: number = 10): HealthAlert[] {
    const alerts = this.alertHistory.get(vaultId) || [];
    return alerts.slice(-limit).reverse(); // Most recent first
  }

  /**
   * Get all recent alerts across all vaults
   */
  getAllRecentAlerts(limit: number = 50): HealthAlert[] {
    const allAlerts: HealthAlert[] = [];
    
    for (const alerts of this.alertHistory.values()) {
      allAlerts.push(...alerts);
    }
    
    return allAlerts
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Perform health checks on all monitored vaults
   */
  private async performHealthChecks(): Promise<void> {
    const now = new Date();
    const checksPerformed = [];

    for (const [vaultId, data] of this.monitoredVaults.entries()) {
      if (now >= data.nextCheckDue) {
        try {
          await this.checkVaultHealth(vaultId);
          checksPerformed.push(vaultId);
        } catch (error) {
          console.error(`Error checking vault ${vaultId}:`, error);
        }
      }
    }

    if (checksPerformed.length > 0) {
      console.log(`Performed health checks on ${checksPerformed.length} vaults`);
    }
  }

  /**
   * Check health of specific vault
   */
  private async checkVaultHealth(vaultId: string): Promise<void> {
    const data = this.monitoredVaults.get(vaultId);
    if (!data) return;

    // Update vault data and recalculate health
    const updatedHealth = await this.calculateCurrentHealth(data.vault);
    const previousHealth = data.healthMetrics;

    // Update monitoring data
    data.healthMetrics = updatedHealth;
    data.lastChecked = new Date();
    data.nextCheckDue = new Date(Date.now() + this.config.checkIntervalMs);

    // Update price history
    const latestPrice = await this.getCurrentPrice(data.vault.collateralType);
    this.updatePriceHistory(data.vault.collateralType, latestPrice);
    data.priceHistory = await this.getPriceHistory(data.vault.collateralType, 24);

    // Check for status changes and generate alerts
    await this.checkForAlerts(data, previousHealth, updatedHealth);
  }

  /**
   * Check for alert conditions and generate alerts
   */
  private async checkForAlerts(
    data: VaultMonitoringData,
    previousHealth: HealthFactorResult,
    currentHealth: HealthFactorResult
  ): Promise<void> {
    const vault = data.vault;
    const alerts: HealthAlert[] = [];

    // Check for status deterioration
    if (this.isStatusWorse(currentHealth.status, previousHealth.status)) {
      const alert = this.createStatusAlert(vault, currentHealth);
      if (alert) {
        alerts.push(alert);
      }
    }

    // Check for status improvement (recovery)
    if (this.isStatusBetter(currentHealth.status, previousHealth.status)) {
      const alert = this.createRecoveryAlert(vault, currentHealth, previousHealth.status);
      if (alert) {
        alerts.push(alert);
      }
    }

    // Check for approaching liquidation
    if (currentHealth.status === 'critical' && currentHealth.bufferAmount > 0) {
      const timeToLiquidation = this.estimateTimeToLiquidation(vault, currentHealth);
      if (timeToLiquidation && timeToLiquidation < 24 * 60 * 60 * 1000) { // Less than 24 hours
        const alert = this.createLiquidationWarningAlert(vault, currentHealth, timeToLiquidation);
        alerts.push(alert);
      }
    }

    // Process and store alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  /**
   * Create status change alert
   */
  private createStatusAlert(vault: CryptoVault, health: HealthFactorResult): HealthAlert | null {
    if (!this.shouldCreateAlert(vault.vaultId, health.status)) {
      return null;
    }

    const recommendedActions = this.getRecommendedActions(health);

    return {
      vaultId: vault.vaultId,
      owner: vault.owner,
      alertType: health.status as 'warning' | 'critical' | 'liquidation',
      currentLTV: health.ltvRatio,
      threshold: this.getThresholdForStatus(health.status, vault.collateralType),
      recommendedActions,
      createdAt: new Date()
    };
  }

  /**
   * Create recovery alert
   */
  private createRecoveryAlert(
    vault: CryptoVault,
    currentHealth: HealthFactorResult,
    previousStatus: string
  ): HealthAlert | null {
    return {
      vaultId: vault.vaultId,
      owner: vault.owner,
      alertType: 'recovery',
      currentLTV: currentHealth.ltvRatio,
      threshold: this.getThresholdForStatus(previousStatus, vault.collateralType),
      recommendedActions: ['Vault health has improved', 'Consider your next financial moves'],
      createdAt: new Date()
    };
  }

  /**
   * Create liquidation warning alert
   */
  private createLiquidationWarningAlert(
    vault: CryptoVault,
    health: HealthFactorResult,
    timeToLiquidation: number
  ): HealthAlert {
    const hoursToLiquidation = Math.floor(timeToLiquidation / (60 * 60 * 1000));
    
    return {
      vaultId: vault.vaultId,
      owner: vault.owner,
      alertType: 'liquidation',
      currentLTV: health.ltvRatio,
      threshold: this.getThresholdForStatus('liquidation', vault.collateralType),
      timeToLiquidation,
      recommendedActions: [
        `Liquidation estimated in ${hoursToLiquidation} hours`,
        'Add collateral immediately',
        'Repay part of your loan',
        'Consider closing position'
      ],
      createdAt: new Date()
    };
  }

  /**
   * Process and deliver alert
   */
  private async processAlert(alert: HealthAlert): Promise<void> {
    // Store alert in history
    const vaultAlerts = this.alertHistory.get(alert.vaultId) || [];
    vaultAlerts.push(alert);
    this.alertHistory.set(alert.vaultId, vaultAlerts);

    // Deliver alert through configured channels
    await this.deliverAlert(alert);

    console.log(`Alert created for vault ${alert.vaultId}: ${alert.alertType} (LTV: ${alert.currentLTV / 100}%)`);
  }

  /**
   * Deliver alert through configured channels
   */
  private async deliverAlert(alert: HealthAlert): Promise<void> {
    try {
      if (this.config.enableEmailAlerts) {
        await this.sendEmailAlert(alert);
      }

      if (this.config.enablePushNotifications) {
        await this.sendPushNotification(alert);
      }

      if (this.config.enableSMSAlerts) {
        await this.sendSMSAlert(alert);
      }
    } catch (error) {
      console.error('Error delivering alert:', error);
    }
  }

  /**
   * Calculate current health for vault
   */
  private async calculateCurrentHealth(vault: CryptoVault): Promise<HealthFactorResult> {
    const currentPrice = await this.getCurrentPrice(vault.collateralType);
    const collateralDecimals = this.getCollateralDecimals(vault.collateralType);

    return this.ltvCalculator.calculateHealthFactor({
      collateralAmount: vault.collateralBalance,
      collateralPrice: currentPrice,
      collateralDecimals,
      loanAmount: vault.borrowedAmount,
      accruedInterest: vault.accruedInterest
    }, vault.collateralType);
  }

  /**
   * Get current price for asset (mock implementation)
   */
  private async getCurrentPrice(assetType: string): Promise<number> {
    // Mock price feed - in production would integrate with real price oracles
    const mockPrices: Record<string, number> = {
      'SUI': 2.50 + (Math.random() - 0.5) * 0.1, // Add some volatility
      'USDC': 1.00,
      'WETH': 3500.00 + (Math.random() - 0.5) * 100
    };

    return mockPrices[assetType] || 1.00;
  }

  /**
   * Update price history for asset
   */
  private updatePriceHistory(assetType: string, price: number): void {
    const history = this.priceCache.get(assetType) || [];
    const pricePoint: PricePoint = {
      timestamp: new Date(),
      price,
      source: 'mock-oracle'
    };

    history.push(pricePoint);

    // Keep only last 24 hours of data
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filteredHistory = history.filter(point => point.timestamp > cutoff);

    this.priceCache.set(assetType, filteredHistory);
  }

  /**
   * Get price history for asset
   */
  private async getPriceHistory(assetType: string, hoursBack: number): Promise<PricePoint[]> {
    const history = this.priceCache.get(assetType) || [];
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    
    return history.filter(point => point.timestamp > cutoff);
  }

  /**
   * Estimate time to liquidation based on interest accrual
   */
  private estimateTimeToLiquidation(vault: CryptoVault, health: HealthFactorResult): number | null {
    if (health.bufferAmount <= 0 || vault.borrowedAmount === 0) {
      return null;
    }

    // Estimate based on interest accrual (simplified)
    const annualInterestRate = 0.05; // 5% - would get from vault data
    const dailyInterest = vault.borrowedAmount * (annualInterestRate / 365);
    
    if (dailyInterest <= 0) {
      return null;
    }

    const daysToLiquidation = health.bufferAmount / dailyInterest;
    return Math.floor(daysToLiquidation * 24 * 60 * 60 * 1000); // Convert to milliseconds
  }

  /**
   * Get recommended actions based on health status
   */
  private getRecommendedActions(health: HealthFactorResult): string[] {
    switch (health.status) {
      case 'warning':
        return [
          'Consider adding more collateral',
          'Monitor price movements closely',
          'Prepare for potential margin call'
        ];
      case 'critical':
        return [
          'Add collateral immediately',
          'Consider partial loan repayment',
          'Set up price alerts'
        ];
      case 'liquidation':
        return [
          'URGENT: Add collateral now',
          'Repay loan immediately',
          'Contact support if needed'
        ];
      default:
        return ['Vault is healthy', 'Continue monitoring'];
    }
  }

  // Helper methods for alert logic
  private isStatusWorse(current: string, previous: string): boolean {
    const statusOrder = ['healthy', 'warning', 'critical', 'liquidation'];
    return statusOrder.indexOf(current) > statusOrder.indexOf(previous);
  }

  private isStatusBetter(current: string, previous: string): boolean {
    const statusOrder = ['healthy', 'warning', 'critical', 'liquidation'];
    return statusOrder.indexOf(current) < statusOrder.indexOf(previous);
  }

  private shouldCreateAlert(vaultId: string, status: string): boolean {
    const recentAlerts = this.getVaultAlerts(vaultId, 5);
    const cutoff = new Date(Date.now() - this.config.alertCooldownMs);
    
    // Check if we've sent a similar alert recently
    return !recentAlerts.some(alert => 
      alert.alertType === status && alert.createdAt > cutoff
    );
  }

  private getThresholdForStatus(status: string, assetType: string): number {
    const thresholds = this.ltvCalculator.getSupportedAssets()[assetType];
    if (!thresholds) return 8000; // Default 80%

    switch (status) {
      case 'warning': return thresholds.warningThreshold;
      case 'critical': return thresholds.liquidationThreshold - 200; // 2% buffer
      case 'liquidation': return thresholds.liquidationThreshold;
      default: return thresholds.maxLtv;
    }
  }

  private getCollateralDecimals(collateralType: string): number {
    const decimalsMap: Record<string, number> = {
      'SUI': 9,
      'USDC': 6,
      'WETH': 8
    };
    return decimalsMap[collateralType] || 9;
  }

  // Mock alert delivery methods (would integrate with real services)
  private async sendEmailAlert(alert: HealthAlert): Promise<void> {
    console.log(`Email alert sent for vault ${alert.vaultId}: ${alert.alertType}`);
  }

  private async sendPushNotification(alert: HealthAlert): Promise<void> {
    console.log(`Push notification sent for vault ${alert.vaultId}: ${alert.alertType}`);
  }

  private async sendSMSAlert(alert: HealthAlert): Promise<void> {
    console.log(`SMS alert sent for vault ${alert.vaultId}: ${alert.alertType}`);
  }
}