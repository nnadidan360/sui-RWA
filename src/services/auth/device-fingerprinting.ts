/**
 * Device Fingerprinting Service for Credit OS
 * 
 * Provides device identification and fraud prevention through fingerprinting
 */

import { createHash } from 'crypto';
import { logger } from '../../utils/logger';
import { DeviceFingerprint } from './auth-service';

export interface FingerprintComponents {
  browser: {
    userAgent: string;
    language: string;
    platform: string;
    cookieEnabled: boolean;
    doNotTrack: string | null;
    plugins: string[];
    mimeTypes: string[];
  };
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelRatio: number;
    orientation?: string;
  };
  hardware: {
    cores: number;
    memory?: number;
    touchSupport: boolean;
    maxTouchPoints: number;
  };
  network: {
    connection?: string;
    downlink?: number;
    effectiveType?: string;
  };
  canvas?: {
    fingerprint: string;
    webgl?: string;
  };
  audio?: {
    fingerprint: string;
  };
  fonts?: string[];
  timezone: {
    offset: number;
    zone: string;
  };
}

export interface DeviceRisk {
  riskScore: number; // 0-100, higher is more risky
  riskFactors: string[];
  trustLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
}

export interface DeviceHistory {
  deviceId: string;
  firstSeen: Date;
  lastSeen: Date;
  sessionCount: number;
  successfulLogins: number;
  failedLogins: number;
  suspiciousActivities: number;
  locations: Array<{
    country: string;
    region: string;
    city: string;
    timestamp: Date;
  }>;
}

export class DeviceFingerprintingService {
  private knownDevices: Map<string, DeviceHistory> = new Map();
  private suspiciousPatterns: Set<string> = new Set();

  constructor() {
    this.initializeSuspiciousPatterns();
  }

  /**
   * Generate comprehensive device fingerprint
   */
  generateFingerprint(components: FingerprintComponents, ipAddress: string): DeviceFingerprint {
    try {
      // Create stable device ID from hardware and browser characteristics
      const deviceId = this.generateDeviceId(components);
      
      // Generate browser fingerprint
      const browserFingerprint = this.generateBrowserFingerprint(components);

      // Extract geolocation (would be from IP geolocation service in production)
      const geolocation = this.extractGeolocation(ipAddress);

      const fingerprint: DeviceFingerprint = {
        deviceId,
        browserFingerprint,
        ipAddress,
        geolocation,
        screenResolution: `${components.screen.width}x${components.screen.height}`,
        timezone: components.timezone.zone,
        userAgent: components.browser.userAgent,
        hardwareSpecs: {
          platform: components.browser.platform,
          cores: components.hardware.cores,
          memory: components.hardware.memory
        },
        behaviorMetrics: {
          // Would be populated from user interaction patterns
          typingPattern: [],
          mouseMovement: [],
          touchPattern: []
        }
      };

      // Update device history
      this.updateDeviceHistory(fingerprint);

      logger.info('Device fingerprint generated', { 
        deviceId: fingerprint.deviceId,
        platform: components.browser.platform,
        location: geolocation?.country
      });

      return fingerprint;
    } catch (error: any) {
      logger.error('Failed to generate device fingerprint', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Assess device risk based on fingerprint and history
   */
  assessDeviceRisk(fingerprint: DeviceFingerprint): DeviceRisk {
    try {
      let riskScore = 0;
      const riskFactors: string[] = [];
      const recommendations: string[] = [];

      const history = this.knownDevices.get(fingerprint.deviceId);

      // New device risk
      if (!history) {
        riskScore += 30;
        riskFactors.push('New device');
        recommendations.push('Require additional verification for new device');
      } else {
        // Analyze device history
        const failureRate = history.failedLogins / (history.successfulLogins + history.failedLogins);
        if (failureRate > 0.3) {
          riskScore += 25;
          riskFactors.push('High authentication failure rate');
        }

        if (history.suspiciousActivities > 5) {
          riskScore += 20;
          riskFactors.push('Multiple suspicious activities');
        }

        // Location consistency
        if (history.locations.length > 10) {
          riskScore += 15;
          riskFactors.push('Multiple geographic locations');
        }
      }

      // Browser/environment risks
      if (this.isSuspiciousBrowser(fingerprint.userAgent)) {
        riskScore += 20;
        riskFactors.push('Suspicious browser or automation detected');
        recommendations.push('Block automated browsers and bots');
      }

      if (this.isVPNOrProxy(fingerprint.ipAddress)) {
        riskScore += 15;
        riskFactors.push('VPN or proxy detected');
        recommendations.push('Require additional verification for VPN users');
      }

      // Fingerprint consistency
      if (history && this.hasInconsistentFingerprint(fingerprint, history)) {
        riskScore += 25;
        riskFactors.push('Inconsistent device fingerprint');
        recommendations.push('Device characteristics have changed significantly');
      }

      // Determine trust level
      let trustLevel: 'low' | 'medium' | 'high';
      if (riskScore >= 70) {
        trustLevel = 'low';
        recommendations.push('Require manual review or block access');
      } else if (riskScore >= 40) {
        trustLevel = 'medium';
        recommendations.push('Require additional authentication factors');
      } else {
        trustLevel = 'high';
      }

      const deviceRisk: DeviceRisk = {
        riskScore: Math.min(100, riskScore),
        riskFactors,
        trustLevel,
        recommendations
      };

      logger.info('Device risk assessed', {
        deviceId: fingerprint.deviceId,
        riskScore: deviceRisk.riskScore,
        trustLevel: deviceRisk.trustLevel,
        factorCount: riskFactors.length
      });

      return deviceRisk;
    } catch (error: any) {
      logger.error('Failed to assess device risk', { 
        error: error.message,
        deviceId: fingerprint.deviceId 
      });
      
      // Return high risk on error
      return {
        riskScore: 100,
        riskFactors: ['Risk assessment failed'],
        trustLevel: 'low',
        recommendations: ['Manual review required']
      };
    }
  }

  /**
   * Compare two device fingerprints for similarity
   */
  compareFingerprints(fp1: DeviceFingerprint, fp2: DeviceFingerprint): number {
    try {
      let similarity = 0;
      let totalChecks = 0;

      // Compare device ID (most important)
      if (fp1.deviceId === fp2.deviceId) {
        similarity += 40;
      }
      totalChecks += 40;

      // Compare browser fingerprint
      if (fp1.browserFingerprint === fp2.browserFingerprint) {
        similarity += 20;
      }
      totalChecks += 20;

      // Compare screen resolution
      if (fp1.screenResolution === fp2.screenResolution) {
        similarity += 10;
      }
      totalChecks += 10;

      // Compare timezone
      if (fp1.timezone === fp2.timezone) {
        similarity += 10;
      }
      totalChecks += 10;

      // Compare user agent
      if (fp1.userAgent === fp2.userAgent) {
        similarity += 10;
      }
      totalChecks += 10;

      // Compare hardware specs
      if (fp1.hardwareSpecs?.platform === fp2.hardwareSpecs?.platform) {
        similarity += 5;
      }
      totalChecks += 5;

      if (fp1.hardwareSpecs?.cores === fp2.hardwareSpecs?.cores) {
        similarity += 5;
      }
      totalChecks += 5;

      return (similarity / totalChecks) * 100;
    } catch (error: any) {
      logger.error('Failed to compare fingerprints', { error: error.message });
      return 0;
    }
  }

  /**
   * Record suspicious activity for a device
   */
  recordSuspiciousActivity(
    deviceId: string, 
    activity: string, 
    details?: Record<string, any>
  ): void {
    try {
      const history = this.knownDevices.get(deviceId);
      if (history) {
        history.suspiciousActivities++;
        history.lastSeen = new Date();
      }

      logger.warn('Suspicious activity recorded', {
        deviceId,
        activity,
        details
      });
    } catch (error: any) {
      logger.error('Failed to record suspicious activity', { 
        error: error.message,
        deviceId 
      });
    }
  }

  /**
   * Get device history
   */
  getDeviceHistory(deviceId: string): DeviceHistory | undefined {
    return this.knownDevices.get(deviceId);
  }

  /**
   * Generate stable device ID from hardware characteristics
   */
  private generateDeviceId(components: FingerprintComponents): string {
    const stableComponents = [
      components.browser.platform,
      components.screen.width.toString(),
      components.screen.height.toString(),
      components.screen.colorDepth.toString(),
      components.hardware.cores.toString(),
      components.hardware.memory?.toString() || 'unknown',
      components.timezone.zone,
      components.canvas?.fingerprint || '',
      components.audio?.fingerprint || ''
    ];

    const combined = stableComponents.join('|');
    return createHash('sha256').update(combined).digest('hex').substring(0, 32);
  }

  /**
   * Generate browser fingerprint from browser-specific characteristics
   */
  private generateBrowserFingerprint(components: FingerprintComponents): string {
    const browserComponents = [
      components.browser.userAgent,
      components.browser.language,
      components.browser.plugins.join(','),
      components.browser.mimeTypes.join(','),
      components.fonts?.join(',') || '',
      components.browser.cookieEnabled.toString(),
      components.browser.doNotTrack || 'null'
    ];

    const combined = browserComponents.join('|');
    return createHash('sha256').update(combined).digest('hex').substring(0, 32);
  }

  /**
   * Extract geolocation from IP address (mock implementation)
   */
  private extractGeolocation(ipAddress: string): DeviceFingerprint['geolocation'] {
    // Mock implementation - in production would use IP geolocation service
    if (ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('127.')) {
      return {
        country: 'Local',
        region: 'Local',
        city: 'Local'
      };
    }

    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown'
    };
  }

  /**
   * Update device history
   */
  private updateDeviceHistory(fingerprint: DeviceFingerprint): void {
    const existing = this.knownDevices.get(fingerprint.deviceId);
    const now = new Date();

    if (existing) {
      existing.lastSeen = now;
      existing.sessionCount++;
      
      // Add location if different
      const currentLocation = {
        country: fingerprint.geolocation?.country || 'Unknown',
        region: fingerprint.geolocation?.region || 'Unknown',
        city: fingerprint.geolocation?.city || 'Unknown',
        timestamp: now
      };

      const hasLocation = existing.locations.some(loc => 
        loc.country === currentLocation.country &&
        loc.region === currentLocation.region &&
        loc.city === currentLocation.city
      );

      if (!hasLocation) {
        existing.locations.push(currentLocation);
        // Keep only last 20 locations
        if (existing.locations.length > 20) {
          existing.locations = existing.locations.slice(-20);
        }
      }
    } else {
      const newHistory: DeviceHistory = {
        deviceId: fingerprint.deviceId,
        firstSeen: now,
        lastSeen: now,
        sessionCount: 1,
        successfulLogins: 0,
        failedLogins: 0,
        suspiciousActivities: 0,
        locations: [{
          country: fingerprint.geolocation?.country || 'Unknown',
          region: fingerprint.geolocation?.region || 'Unknown',
          city: fingerprint.geolocation?.city || 'Unknown',
          timestamp: now
        }]
      };
      
      this.knownDevices.set(fingerprint.deviceId, newHistory);
    }
  }

  /**
   * Check if browser appears suspicious
   */
  private isSuspiciousBrowser(userAgent: string): boolean {
    const suspiciousPatterns = [
      /headless/i,
      /phantom/i,
      /selenium/i,
      /webdriver/i,
      /bot/i,
      /crawler/i,
      /spider/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Check if IP appears to be VPN or proxy (mock implementation)
   */
  private isVPNOrProxy(ipAddress: string): boolean {
    // Mock implementation - in production would use VPN/proxy detection service
    const knownVPNRanges = [
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16'
    ];

    // Simple check for private ranges (not comprehensive)
    return knownVPNRanges.some(range => {
      // Simplified range check
      return ipAddress.startsWith(range.split('/')[0].split('.').slice(0, 2).join('.'));
    });
  }

  /**
   * Check if fingerprint is inconsistent with device history
   */
  private hasInconsistentFingerprint(
    fingerprint: DeviceFingerprint, 
    history: DeviceHistory
  ): boolean {
    // In production, would compare against stored fingerprint characteristics
    // For now, just check if there are too many location changes
    return history.locations.length > 15;
  }

  /**
   * Initialize suspicious patterns
   */
  private initializeSuspiciousPatterns(): void {
    this.suspiciousPatterns.add('multiple_rapid_logins');
    this.suspiciousPatterns.add('unusual_location_change');
    this.suspiciousPatterns.add('automated_behavior');
    this.suspiciousPatterns.add('fingerprint_spoofing');
    this.suspiciousPatterns.add('vpn_usage');
  }

  /**
   * Record successful login
   */
  recordSuccessfulLogin(deviceId: string): void {
    const history = this.knownDevices.get(deviceId);
    if (history) {
      history.successfulLogins++;
      history.lastSeen = new Date();
    }
  }

  /**
   * Record failed login
   */
  recordFailedLogin(deviceId: string): void {
    const history = this.knownDevices.get(deviceId);
    if (history) {
      history.failedLogins++;
      history.lastSeen = new Date();
    }
  }

  /**
   * Get device statistics
   */
  getDeviceStatistics(): {
    totalDevices: number;
    newDevicesLast24h: number;
    suspiciousDevices: number;
    averageSessionsPerDevice: number;
  } {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    let newDevicesLast24h = 0;
    let suspiciousDevices = 0;
    let totalSessions = 0;

    for (const history of this.knownDevices.values()) {
      if (history.firstSeen > yesterday) {
        newDevicesLast24h++;
      }
      
      if (history.suspiciousActivities > 3 || history.failedLogins > 10) {
        suspiciousDevices++;
      }
      
      totalSessions += history.sessionCount;
    }

    return {
      totalDevices: this.knownDevices.size,
      newDevicesLast24h,
      suspiciousDevices,
      averageSessionsPerDevice: this.knownDevices.size > 0 ? totalSessions / this.knownDevices.size : 0
    };
  }
}