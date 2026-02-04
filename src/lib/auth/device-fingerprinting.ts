/**
 * Credit OS Device Fingerprinting Service
 * Implements device identification and fraud prevention
 * Requirements: 6.1, 5.5
 */

import { createHash } from 'crypto';
import { getCreditOSConfig } from '../../config/credit-os';
import { DeviceFingerprint } from '../database/credit-os-models';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ClientDeviceData {
  // Browser/Environment
  userAgent: string;
  language: string;
  languages: string[];
  platform: string;
  cookieEnabled: boolean;
  doNotTrack: string | null;
  
  // Screen/Display
  screenWidth: number;
  screenHeight: number;
  screenColorDepth: number;
  screenPixelDepth: number;
  availScreenWidth: number;
  availScreenHeight: number;
  
  // Timezone
  timezone: string;
  timezoneOffset: number;
  
  // Storage capabilities
  localStorage: boolean;
  sessionStorage: boolean;
  indexedDB: boolean;
  
  // WebGL
  webglVendor?: string;
  webglRenderer?: string;
  
  // Canvas fingerprint
  canvasFingerprint?: string;
  
  // Audio context
  audioFingerprint?: string;
  
  // Fonts
  availableFonts?: string[];
  
  // Plugins (deprecated but still useful)
  plugins?: string[];
  
  // Touch support
  touchSupport: boolean;
  maxTouchPoints: number;
  
  // Hardware
  hardwareConcurrency: number;
  deviceMemory?: number;
  
  // Network
  connectionType?: string;
  connectionDownlink?: number;
  connectionRtt?: number;
}

export interface DeviceFingerprintResult {
  fingerprint: string;
  confidence: number; // 0-100, how unique this fingerprint is
  components: Record<string, any>;
  riskScore: number; // 0-100, fraud risk assessment
}

export interface DeviceValidationResult {
  isValid: boolean;
  isTrusted: boolean;
  riskFactors: string[];
  confidence: number;
  recommendation: 'allow' | 'challenge' | 'block';
}

// ============================================================================
// DEVICE FINGERPRINTING SERVICE
// ============================================================================

export class DeviceFingerprintingService {
  private config = getCreditOSConfig();
  private knownFingerprints = new Map<string, DeviceFingerprint>();
  private suspiciousPatterns = new Set<string>();

  constructor() {
    this.initializeSuspiciousPatterns();
  }

  // ============================================================================
  // FINGERPRINT GENERATION
  // ============================================================================

  /**
   * Generate device fingerprint from client data
   * Requirements: 6.1
   */
  generateFingerprint(
    clientData: ClientDeviceData,
    ipAddress: string
  ): DeviceFingerprintResult {
    const components = this.extractComponents(clientData);
    const fingerprint = this.computeFingerprint(components);
    const confidence = this.calculateConfidence(components);
    const riskScore = this.assessRisk(components, ipAddress);

    return {
      fingerprint,
      confidence,
      components,
      riskScore,
    };
  }

  /**
   * Extract fingerprinting components
   */
  private extractComponents(data: ClientDeviceData): Record<string, any> {
    return {
      // Browser signature
      userAgent: this.normalizeUserAgent(data.userAgent),
      language: data.language,
      languages: data.languages?.sort().join(','),
      platform: data.platform,
      cookieEnabled: data.cookieEnabled,
      doNotTrack: data.doNotTrack,
      
      // Screen signature
      screen: `${data.screenWidth}x${data.screenHeight}x${data.screenColorDepth}`,
      availScreen: `${data.availScreenWidth}x${data.availScreenHeight}`,
      
      // Timezone signature
      timezone: data.timezone,
      timezoneOffset: data.timezoneOffset,
      
      // Capabilities signature
      storage: [
        data.localStorage ? 'ls' : '',
        data.sessionStorage ? 'ss' : '',
        data.indexedDB ? 'idb' : '',
      ].filter(Boolean).join(','),
      
      // WebGL signature
      webgl: data.webglVendor && data.webglRenderer 
        ? `${data.webglVendor}|${data.webglRenderer}` 
        : null,
      
      // Canvas fingerprint (already computed on client)
      canvas: data.canvasFingerprint,
      
      // Audio fingerprint
      audio: data.audioFingerprint,
      
      // Font signature
      fonts: data.availableFonts?.sort().join(','),
      
      // Plugin signature
      plugins: data.plugins?.sort().join(','),
      
      // Touch signature
      touch: `${data.touchSupport}:${data.maxTouchPoints}`,
      
      // Hardware signature
      hardware: `${data.hardwareConcurrency}:${data.deviceMemory || 'unknown'}`,
      
      // Network signature
      network: data.connectionType 
        ? `${data.connectionType}:${data.connectionDownlink}:${data.connectionRtt}`
        : null,
    };
  }

  /**
   * Compute final fingerprint hash
   */
  private computeFingerprint(components: Record<string, any>): string {
    // Create a stable string representation of components
    const fingerprintString = Object.keys(components)
      .sort()
      .map(key => `${key}:${components[key] || ''}`)
      .join('|');
    
    return createHash('sha256')
      .update(fingerprintString)
      .digest('hex');
  }

  /**
   * Calculate fingerprint uniqueness confidence
   */
  private calculateConfidence(components: Record<string, any>): number {
    let confidence = 0;
    
    // Screen resolution contributes to uniqueness
    if (components.screen) confidence += 15;
    
    // WebGL renderer is highly unique
    if (components.webgl) confidence += 25;
    
    // Canvas fingerprint is very unique
    if (components.canvas) confidence += 20;
    
    // Audio fingerprint adds uniqueness
    if (components.audio) confidence += 15;
    
    // Font list is moderately unique
    if (components.fonts) confidence += 10;
    
    // Hardware info adds some uniqueness
    if (components.hardware) confidence += 10;
    
    // Timezone adds some uniqueness
    if (components.timezone) confidence += 5;
    
    return Math.min(confidence, 100);
  }

  /**
   * Assess fraud risk based on fingerprint components
   */
  private assessRisk(components: Record<string, any>, ipAddress: string): number {
    let riskScore = 0;
    
    // Check for suspicious user agent patterns
    if (this.isSuspiciousUserAgent(components.userAgent)) {
      riskScore += 30;
    }
    
    // Check for automation indicators
    if (this.hasAutomationIndicators(components)) {
      riskScore += 40;
    }
    
    // Check for inconsistent data
    if (this.hasInconsistentData(components)) {
      riskScore += 20;
    }
    
    // Check for common fraud patterns
    if (this.matchesFraudPatterns(components)) {
      riskScore += 25;
    }
    
    // Check IP reputation (placeholder)
    if (this.isSuspiciousIP(ipAddress)) {
      riskScore += 15;
    }
    
    return Math.min(riskScore, 100);
  }

  // ============================================================================
  // DEVICE VALIDATION
  // ============================================================================

  /**
   * Validate device against known fingerprints
   * Requirements: 5.5
   */
  validateDevice(
    fingerprint: string,
    userId: string,
    knownDevices: DeviceFingerprint[]
  ): DeviceValidationResult {
    const riskFactors: string[] = [];
    let confidence = 0;
    let isTrusted = false;

    // Check if device is known and trusted
    const knownDevice = knownDevices.find(d => d.fingerprint === fingerprint);
    if (knownDevice) {
      isTrusted = knownDevice.trusted;
      confidence = 90;
      
      // Check if device hasn't been seen for a long time
      const daysSinceLastSeen = (Date.now() - knownDevice.lastSeen.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastSeen > 30) {
        riskFactors.push('Device not seen for over 30 days');
        confidence -= 20;
      }
    } else {
      // New device
      riskFactors.push('New device');
      confidence = 50;
    }

    // Check if fingerprint is suspicious
    if (this.suspiciousPatterns.has(fingerprint)) {
      riskFactors.push('Fingerprint matches suspicious pattern');
      confidence -= 30;
    }

    // Check fingerprint entropy (too common or too unique can be suspicious)
    const entropy = this.calculateFingerprintEntropy(fingerprint);
    if (entropy < 0.3) {
      riskFactors.push('Fingerprint too common');
      confidence -= 15;
    } else if (entropy > 0.95) {
      riskFactors.push('Fingerprint suspiciously unique');
      confidence -= 10;
    }

    // Determine recommendation
    let recommendation: 'allow' | 'challenge' | 'block';
    if (confidence >= 80 && riskFactors.length === 0) {
      recommendation = 'allow';
    } else if (confidence >= 50 && riskFactors.length <= 2) {
      recommendation = 'challenge';
    } else {
      recommendation = 'block';
    }

    return {
      isValid: confidence >= 50,
      isTrusted,
      riskFactors,
      confidence: Math.max(0, confidence),
      recommendation,
    };
  }

  /**
   * Update device trust status
   */
  updateDeviceTrust(
    fingerprint: string,
    trusted: boolean,
    reason: string
  ): void {
    const device = this.knownFingerprints.get(fingerprint);
    if (device) {
      device.trusted = trusted;
      device.lastSeen = new Date();
    }

    if (!trusted) {
      this.suspiciousPatterns.add(fingerprint);
    }
  }

  // ============================================================================
  // RISK ASSESSMENT HELPERS
  // ============================================================================

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /headless/i,
      /phantom/i,
      /selenium/i,
      /webdriver/i,
      /bot/i,
      /crawler/i,
      /spider/i,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  private hasAutomationIndicators(components: Record<string, any>): boolean {
    // Check for common automation indicators
    const indicators = [
      // Missing expected properties
      !components.canvas,
      !components.webgl,
      
      // Suspicious values
      components.hardwareConcurrency === '0',
      components.languages === '',
      
      // Perfect values (often indicates simulation)
      components.screen === '1920x1080x24',
      components.timezone === 'UTC',
    ];

    return indicators.filter(Boolean).length >= 2;
  }

  private hasInconsistentData(components: Record<string, any>): boolean {
    // Check for data inconsistencies that might indicate spoofing
    const inconsistencies = [];

    // Platform vs user agent mismatch
    if (components.platform && components.userAgent) {
      const platformInUA = components.userAgent.toLowerCase().includes(
        components.platform.toLowerCase()
      );
      if (!platformInUA) {
        inconsistencies.push('platform_ua_mismatch');
      }
    }

    // Language inconsistencies
    if (components.language && components.languages) {
      const primaryLang = components.language.split('-')[0];
      const hasMatchingLang = components.languages.includes(primaryLang);
      if (!hasMatchingLang) {
        inconsistencies.push('language_mismatch');
      }
    }

    return inconsistencies.length > 0;
  }

  private matchesFraudPatterns(components: Record<string, any>): boolean {
    // Check against known fraud patterns
    // This would be populated from fraud intelligence feeds
    return false; // Placeholder
  }

  private isSuspiciousIP(ipAddress: string): boolean {
    // Check IP against threat intelligence feeds
    // This would integrate with services like VirusTotal, AbuseIPDB, etc.
    return false; // Placeholder
  }

  private calculateFingerprintEntropy(fingerprint: string): number {
    // Calculate how unique this fingerprint is
    // This would require a database of known fingerprints
    // For now, return a random value between 0.3 and 0.9
    return 0.3 + Math.random() * 0.6;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private normalizeUserAgent(userAgent: string): string {
    // Normalize user agent to reduce noise while preserving uniqueness
    return userAgent
      .replace(/\d+\.\d+\.\d+/g, 'X.X.X') // Replace version numbers
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private initializeSuspiciousPatterns(): void {
    // Initialize with known suspicious fingerprint patterns
    // This would be loaded from a threat intelligence database
    this.suspiciousPatterns.add('known_bot_fingerprint_1');
    this.suspiciousPatterns.add('known_bot_fingerprint_2');
  }

  // ============================================================================
  // CLIENT-SIDE FINGERPRINTING HELPERS
  // ============================================================================

  /**
   * Generate client-side fingerprinting script
   * This would be sent to the browser to collect device data
   */
  generateClientScript(): string {
    return `
(function() {
  function collectDeviceData() {
    const data = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages ? Array.from(navigator.languages) : [],
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      
      screenWidth: screen.width,
      screenHeight: screen.height,
      screenColorDepth: screen.colorDepth,
      screenPixelDepth: screen.pixelDepth,
      availScreenWidth: screen.availWidth,
      availScreenHeight: screen.availHeight,
      
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      
      localStorage: !!window.localStorage,
      sessionStorage: !!window.sessionStorage,
      indexedDB: !!window.indexedDB,
      
      touchSupport: 'ontouchstart' in window,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      deviceMemory: navigator.deviceMemory,
    };
    
    // WebGL fingerprint
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          data.webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          data.webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        }
      }
    } catch (e) {}
    
    // Canvas fingerprint
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Device fingerprint test 🔒', 2, 2);
        data.canvasFingerprint = canvas.toDataURL();
      }
    } catch (e) {}
    
    // Network information
    if (navigator.connection) {
      data.connectionType = navigator.connection.effectiveType;
      data.connectionDownlink = navigator.connection.downlink;
      data.connectionRtt = navigator.connection.rtt;
    }
    
    return data;
  }
  
  return collectDeviceData();
})();
    `.trim();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let deviceFingerprintingInstance: DeviceFingerprintingService | null = null;

export function getDeviceFingerprintingService(): DeviceFingerprintingService {
  if (!deviceFingerprintingInstance) {
    deviceFingerprintingInstance = new DeviceFingerprintingService();
  }
  return deviceFingerprintingInstance;
}