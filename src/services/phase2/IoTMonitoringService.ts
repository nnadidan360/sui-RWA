// PHASE 2: IoT Integration
// Task 18.3 - IoT Asset Monitoring Service
// Real-time condition monitoring and valuation adjustments

import { logger } from '../../utils/logger';

interface IoTSensorData {
  sensorId: string;
  assetId: string;
  sensorType: string;
  value: number;
  unit: string;
  timestamp: Date;
  location?: { lat: number; lng: number };
}

interface AssetHealthMetrics {
  assetId: string;
  overallHealth: number; // 0-100
  temperature?: number;
  humidity?: number;
  vibration?: number;
  operatingHours?: number;
  maintenanceScore: number;
  lastInspection: Date;
}

interface ValuationAdjustment {
  assetId: string;
  originalValue: number;
  adjustedValue: number;
  adjustmentFactor: number;
  reason: string;
  timestamp: Date;
}

export class IoTMonitoringService {
  // Thresholds for condition monitoring
  private static readonly TEMP_THRESHOLD_HIGH = 80; // Celsius
  private static readonly TEMP_THRESHOLD_LOW = -20;
  private static readonly HUMIDITY_THRESHOLD = 80; // Percent
  private static readonly VIBRATION_THRESHOLD = 10; // mm/s

  /**
   * Process IoT sensor data
   */
  static async processSensorData(data: IoTSensorData): Promise<void> {
    try {
      logger.info('Processing IoT sensor data', {
        sensorId: data.sensorId,
        assetId: data.assetId,
        type: data.sensorType
      });

      // Validate sensor data
      if (!this.validateSensorData(data)) {
        logger.warn('Invalid sensor data received', { data });
        return;
      }

      // Check for anomalies
      const anomaly = this.detectAnomaly(data);
      if (anomaly) {
        await this.handleAnomaly(data, anomaly);
      }

      // Update asset health metrics
      await this.updateAssetHealth(data.assetId, data);
    } catch (error) {
      logger.error('Error processing sensor data', { data, error });
    }
  }


  /**
   * Validate sensor data
   */
  private static validateSensorData(data: IoTSensorData): boolean {
    if (!data.sensorId || !data.assetId || !data.sensorType) {
      return false;
    }

    if (typeof data.value !== 'number' || isNaN(data.value)) {
      return false;
    }

    return true;
  }

  /**
   * Detect anomalies in sensor data
   */
  private static detectAnomaly(data: IoTSensorData): string | null {
    switch (data.sensorType) {
      case 'temperature':
        if (data.value > this.TEMP_THRESHOLD_HIGH) {
          return 'Temperature exceeds safe threshold';
        }
        if (data.value < this.TEMP_THRESHOLD_LOW) {
          return 'Temperature below safe threshold';
        }
        break;

      case 'humidity':
        if (data.value > this.HUMIDITY_THRESHOLD) {
          return 'Humidity exceeds safe threshold';
        }
        break;

      case 'vibration':
        if (data.value > this.VIBRATION_THRESHOLD) {
          return 'Excessive vibration detected';
        }
        break;
    }

    return null;
  }

  /**
   * Handle detected anomaly
   */
  private static async handleAnomaly(
    data: IoTSensorData,
    anomaly: string
  ): Promise<void> {
    logger.warn('IoT anomaly detected', {
      assetId: data.assetId,
      sensorType: data.sensorType,
      value: data.value,
      anomaly
    });

    // In production, would:
    // - Create alert
    // - Notify asset owner
    // - Trigger maintenance workflow
    // - Adjust asset valuation
  }

  /**
   * Update asset health metrics
   */
  private static async updateAssetHealth(
    assetId: string,
    sensorData: IoTSensorData
  ): Promise<void> {
    // In production, would update database with latest metrics
    logger.info('Updating asset health metrics', { assetId });
  }

  /**
   * Calculate asset health score
   */
  static async calculateHealthScore(assetId: string): Promise<number> {
    // In production, would aggregate all sensor data
    // For now, return mock score
    return 85; // 0-100 scale
  }

  /**
   * Adjust valuation based on condition
   */
  static async adjustValuationByCondition(
    assetId: string,
    originalValue: number,
    healthMetrics: AssetHealthMetrics
  ): Promise<ValuationAdjustment> {
    const healthScore = healthMetrics.overallHealth;
    
    // Calculate adjustment factor based on health
    let adjustmentFactor = 1.0;
    let reason = 'Normal condition';

    if (healthScore >= 90) {
      adjustmentFactor = 1.05; // 5% premium for excellent condition
      reason = 'Excellent condition';
    } else if (healthScore >= 75) {
      adjustmentFactor = 1.0; // No adjustment
      reason = 'Good condition';
    } else if (healthScore >= 60) {
      adjustmentFactor = 0.95; // 5% discount
      reason = 'Fair condition - minor issues';
    } else if (healthScore >= 40) {
      adjustmentFactor = 0.85; // 15% discount
      reason = 'Poor condition - maintenance required';
    } else {
      adjustmentFactor = 0.70; // 30% discount
      reason = 'Critical condition - immediate attention needed';
    }

    const adjustedValue = Math.round(originalValue * adjustmentFactor);

    return {
      assetId,
      originalValue,
      adjustedValue,
      adjustmentFactor,
      reason,
      timestamp: new Date()
    };
  }

  /**
   * Get real-time asset monitoring data
   */
  static async getAssetMonitoring(assetId: string): Promise<AssetHealthMetrics> {
    // In production, would query latest sensor data
    return {
      assetId,
      overallHealth: 85,
      temperature: 25,
      humidity: 45,
      vibration: 2,
      operatingHours: 1500,
      maintenanceScore: 90,
      lastInspection: new Date()
    };
  }

  /**
   * Predict maintenance needs
   */
  static async predictMaintenance(assetId: string): Promise<{
    nextMaintenanceDate: Date;
    estimatedCost: number;
    urgency: 'low' | 'medium' | 'high';
  }> {
    // In production, would use ML model based on sensor trends
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 3);

    return {
      nextMaintenanceDate: nextDate,
      estimatedCost: 500,
      urgency: 'low'
    };
  }

  /**
   * Calculate depreciation based on usage
   */
  static async calculateUsageBasedDepreciation(
    assetId: string,
    purchasePrice: number,
    operatingHours: number
  ): Promise<number> {
    // Simple usage-based depreciation model
    const expectedLifetimeHours = 10000;
    const usageRatio = operatingHours / expectedLifetimeHours;
    const depreciation = purchasePrice * usageRatio * 0.7; // 70% max depreciation

    return Math.max(purchasePrice - depreciation, purchasePrice * 0.1);
  }
}
