/**
 * Fraud Detection Service
 * 
 * Multi-layered fraud detection system that monitors device binding,
 * velocity checks, behavioral patterns, and geo/IP validation.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { User, IUser } from '../../models/User';
import { Asset } from '../../models/Asset';
import { logger } from '../../utils/logger';
import * as crypto from 'crypto';

export interface FraudAssessment {
  userId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  fraudScore: number;
  signals: FraudSignal[];
  recommendedAction: 'allow' | 'review' | 'block' | 'freeze';
  timestamp: Date;
}

export interface FraudSignal {
  signalType: 'identity' | 'asset' | 'behavioral' | 'collusion';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: Record<string, any>;
}

export interface UserActivity {
  userId: string;
  activityType: 'login' | 'asset_upload' | 'loan_request' | 'withdrawal' | 'profile_update';
  deviceFingerprint?: {
    deviceId: string;
    browserFingerprint: string;
    ipAddress: string;
    userAgent: string;
    geolocation?: {
      country?: string;
      region?: string;
      city?: string;
    };
  };
  metadata: Record<string, any>;
  timestamp: Date;
}

export class FraudDetectionService {
  private readonly VELOCITY_THRESHOLDS = {
    asset_upload: { timeWindow: 60, maxActions: 5 },
    loan_request: { timeWindow: 60, maxActions: 3 },
    login_attempt: { timeWindow: 15, maxActions: 5 },
    withdrawal: { timeWindow: 60, maxActions: 10 }
  };

  async detectFraud(userId: string, activity: UserActivity): Promise<FraudAssessment> {
    try {
      logger.info(`Running fraud detection for user ${userId}: ${activity.activityType}`);

      const user = await User.findOne({ internalUserId: userId });
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      const signals: FraudSignal[] = [];

      signals.push(...await this.checkDeviceBinding(user, activity));
      signals.push(...await this.checkVelocity(user, activity));
      signals.push(...await this.checkGeoIPConsistency(user, activity));
      signals.push(...await this.checkBehavioralPatterns(user, activity));
      signals.push(...await this.checkAssetDuplication(user, activity));
      signals.push(...await this.checkCollusionPatterns(user, activity));

      const fraudScore = this.calculateFraudScore(signals);
      const riskLevel = this.determineRiskLevel(fraudScore);
      const recommendedAction = this.determineRecommendedAction(riskLevel, signals);

      const assessment: FraudAssessment = {
        userId,
        riskLevel,
        fraudScore,
        signals,
        recommendedAction,
        timestamp: new Date()
      };

      if (signals.length > 0) {
        logger.warn(`Fraud signals detected for user ${userId}:`, {
          signalCount: signals.length,
          riskLevel,
          fraudScore
        });

        for (const signal of signals) {
          user.addFraudSignal(signal.signalType, signal.severity, signal.description);
        }
        await user.save();
      }

      return assessment;
    } catch (error) {
      logger.error('Error detecting fraud:', error);
      throw error;
    }
  }

  private async checkDeviceBinding(user: IUser, activity: UserActivity): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    if (!activity.deviceFingerprint) {
      return signals;
    }

    const { deviceId, browserFingerprint } = activity.deviceFingerprint;

    const knownDevice = user.deviceFingerprints.find(
      (d: any) => d.deviceId === deviceId && d.isActive
    );

    if (!knownDevice) {
      const recentDeviceChanges = user.deviceFingerprints.filter((d: any) => {
        const daysSinceLastUsed = (Date.now() - d.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLastUsed < 7;
      }).length;

      if (recentDeviceChanges > 3) {
        signals.push({
          signalType: 'identity',
          severity: 'high',
          description: 'Multiple new devices in short time period',
          evidence: { recentDeviceChanges, newDeviceId: deviceId }
        });
      }
    } else {
      if (knownDevice.browserFingerprint !== browserFingerprint) {
        signals.push({
          signalType: 'identity',
          severity: 'medium',
          description: 'Browser fingerprint mismatch for known device',
          evidence: {
            deviceId,
            expectedFingerprint: knownDevice.browserFingerprint,
            actualFingerprint: browserFingerprint
          }
        });
      }
    }

    return signals;
  }

  private async checkVelocity(user: IUser, activity: UserActivity): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    const threshold = this.VELOCITY_THRESHOLDS[activity.activityType as keyof typeof this.VELOCITY_THRESHOLDS];
    if (!threshold) {
      return signals;
    }

    const cutoffTime = new Date(Date.now() - threshold.timeWindow * 60 * 1000);
    const recentActivities = user.activityLog.filter((log: any) => {
      return log.action === activity.activityType && log.timestamp > cutoffTime;
    });

    if (recentActivities.length >= threshold.maxActions) {
      signals.push({
        signalType: 'behavioral',
        severity: 'high',
        description: `Velocity limit exceeded for ${activity.activityType}`,
        evidence: {
          activityType: activity.activityType,
          count: recentActivities.length,
          threshold: threshold.maxActions,
          timeWindow: threshold.timeWindow
        }
      });
    }

    return signals;
  }

  private async checkGeoIPConsistency(user: IUser, activity: UserActivity): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    if (!activity.deviceFingerprint?.geolocation) {
      return signals;
    }

    const currentGeo = activity.deviceFingerprint.geolocation;

    const recentDevices = user.deviceFingerprints
      .filter((d: any) => {
        const hoursSinceLastUsed = (Date.now() - d.lastUsed.getTime()) / (1000 * 60 * 60);
        return hoursSinceLastUsed < 24 && d.isActive;
      })
      .sort((a: any, b: any) => b.lastUsed.getTime() - a.lastUsed.getTime());

    if (recentDevices.length > 0) {
      const lastDevice = recentDevices[0];
      const lastGeo = lastDevice.geolocation;

      if (lastGeo && lastGeo.country !== currentGeo.country) {
        const hoursSinceLastActivity = (Date.now() - lastDevice.lastUsed.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastActivity < 2) {
          signals.push({
            signalType: 'identity',
            severity: 'critical',
            description: 'Impossible travel detected - location change too rapid',
            evidence: {
              previousCountry: lastGeo.country,
              currentCountry: currentGeo.country,
              timeDifference: hoursSinceLastActivity
            }
          });
        }
      }
    }

    const ipChanges = user.deviceFingerprints
      .filter((d: any) => {
        const hoursSinceLastUsed = (Date.now() - d.lastUsed.getTime()) / (1000 * 60 * 60);
        return hoursSinceLastUsed < 24;
      })
      .map((d: any) => d.ipAddress);

    const uniqueIPs = new Set(ipChanges);
    if (uniqueIPs.size > 5) {
      signals.push({
        signalType: 'identity',
        severity: 'medium',
        description: 'Multiple IP addresses in short time period',
        evidence: {
          uniqueIPCount: uniqueIPs.size,
          timeWindow: '24 hours'
        }
      });
    }

    return signals;
  }

  private async checkBehavioralPatterns(user: IUser, activity: UserActivity): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    if (activity.activityType === 'asset_upload') {
      const recentAssetUploads = user.activityLog.filter((log: any) => {
        const daysSince = (Date.now() - log.timestamp.getTime()) / (1000 * 60 * 60 * 24);
        return log.action === 'asset_upload' && daysSince < 7;
      });

      if (recentAssetUploads.length > 10) {
        signals.push({
          signalType: 'behavioral',
          severity: 'high',
          description: 'Abnormally high asset upload frequency',
          evidence: {
            uploadCount: recentAssetUploads.length,
            timeWindow: '7 days'
          }
        });
      }
    }

    if (activity.activityType === 'loan_request') {
      const recentLoanRequests = user.activityLog.filter((log: any) => {
        const daysSince = (Date.now() - log.timestamp.getTime()) / (1000 * 60 * 60 * 24);
        return log.action === 'loan_request' && daysSince < 30;
      });

      const loanAmounts = recentLoanRequests
        .map((log: any) => log.details?.amount || 0)
        .filter((amount: number) => amount > 0);

      if (loanAmounts.length >= 3) {
        const isEscalating = loanAmounts.every((amount: number, index: number) => {
          if (index === 0) return true;
          return amount > loanAmounts[index - 1] * 1.5;
        });

        if (isEscalating) {
          signals.push({
            signalType: 'behavioral',
            severity: 'high',
            description: 'Rapidly escalating loan request amounts',
            evidence: {
              loanAmounts,
              pattern: 'escalating'
            }
          });
        }
      }
    }

    const accountAgeInDays = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (accountAgeInDays < 7 && user.activityLog.length > 50) {
      signals.push({
        signalType: 'behavioral',
        severity: 'medium',
        description: 'Unusually high activity for new account',
        evidence: {
          accountAgeInDays,
          activityCount: user.activityLog.length
        }
      });
    }

    return signals;
  }

  private async checkAssetDuplication(user: IUser, activity: UserActivity): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    if (activity.activityType !== 'asset_upload' || !activity.metadata.documentHash) {
      return signals;
    }

    const documentHash = activity.metadata.documentHash;

    const duplicateAssets = await Asset.find({
      documentHash,
      owner: { $ne: user._id }
    });

    if (duplicateAssets.length > 0) {
      signals.push({
        signalType: 'asset',
        severity: 'critical',
        description: 'Document hash matches assets from other users',
        evidence: {
          documentHash,
          duplicateCount: duplicateAssets.length,
          otherUserIds: duplicateAssets.map(a => a.owner.toString())
        }
      });
    }

    if (activity.metadata.assetMetadata) {
      const metadata = activity.metadata.assetMetadata;
      const similarAssets = await Asset.find({
        owner: { $ne: user._id },
        $or: [
          { 'metadata.serialNumber': metadata.serialNumber },
          { 'metadata.registrationNumber': metadata.registrationNumber },
          { 'metadata.propertyId': metadata.propertyId }
        ]
      });

      if (similarAssets.length > 0) {
        signals.push({
          signalType: 'asset',
          severity: 'high',
          description: 'Asset metadata matches existing assets from other users',
          evidence: {
            matchedFields: Object.keys(metadata),
            duplicateCount: similarAssets.length
          }
        });
      }
    }

    return signals;
  }

  private async checkCollusionPatterns(user: IUser, activity: UserActivity): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    if (!activity.deviceFingerprint) {
      return signals;
    }

    const sharedDeviceUsers = await User.find({
      internalUserId: { $ne: user.internalUserId },
      'deviceFingerprints.deviceId': activity.deviceFingerprint.deviceId,
      'deviceFingerprints.isActive': true
    });

    if (sharedDeviceUsers.length > 0) {
      signals.push({
        signalType: 'collusion',
        severity: 'high',
        description: 'Device shared across multiple user accounts',
        evidence: {
          deviceId: activity.deviceFingerprint.deviceId,
          sharedWithUserCount: sharedDeviceUsers.length
        }
      });
    }

    const sharedIPUsers = await User.find({
      internalUserId: { $ne: user.internalUserId },
      'deviceFingerprints.ipAddress': activity.deviceFingerprint.ipAddress,
      'deviceFingerprints.isActive': true
    });

    if (sharedIPUsers.length > 5) {
      signals.push({
        signalType: 'collusion',
        severity: 'medium',
        description: 'IP address shared across many user accounts',
        evidence: {
          ipAddress: activity.deviceFingerprint.ipAddress,
          sharedWithUserCount: sharedIPUsers.length
        }
      });
    }

    return signals;
  }

  private calculateFraudScore(signals: FraudSignal[]): number {
    if (signals.length === 0) {
      return 0;
    }

    const severityScores = {
      low: 10,
      medium: 25,
      high: 50,
      critical: 100
    };

    const totalScore = signals.reduce((sum, signal) => {
      return sum + severityScores[signal.severity];
    }, 0);

    return Math.min(100, totalScore);
  }

  private determineRiskLevel(fraudScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (fraudScore >= 75) return 'critical';
    if (fraudScore >= 50) return 'high';
    if (fraudScore >= 25) return 'medium';
    return 'low';
  }

  private determineRecommendedAction(
    riskLevel: string,
    signals: FraudSignal[]
  ): 'allow' | 'review' | 'block' | 'freeze' {
    const hasCriticalSignal = signals.some(s => s.severity === 'critical');
    if (hasCriticalSignal) {
      return 'freeze';
    }

    const highSeverityCount = signals.filter(s => s.severity === 'high').length;
    if (highSeverityCount >= 2) {
      return 'block';
    }

    switch (riskLevel) {
      case 'critical':
        return 'freeze';
      case 'high':
        return 'block';
      case 'medium':
        return 'review';
      default:
        return 'allow';
    }
  }

  async freezeAccount(userId: string, reason: string): Promise<void> {
    try {
      logger.warn(`Freezing account for user ${userId}: ${reason}`);

      const user = await User.findOne({ internalUserId: userId });
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      user.isActive = false;

      user.activeSessions.forEach((session: any) => {
        session.isActive = false;
      });

      user.addFraudSignal('identity', 'critical', `Account frozen: ${reason}`);

      user.logActivity('account_frozen', {
        reason,
        timestamp: new Date()
      });

      await user.save();

      logger.info(`Account frozen for user ${userId}`);
    } catch (error) {
      logger.error('Error freezing account:', error);
      throw error;
    }
  }

  async revokeCapabilities(userId: string, reason: string): Promise<void> {
    try {
      logger.warn(`Revoking capabilities for user ${userId}: ${reason}`);

      const user = await User.findOne({ internalUserId: userId });
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      user.logActivity('capabilities_revoked', {
        reason,
        timestamp: new Date()
      });

      await user.save();

      logger.info(`Capabilities revoked for user ${userId}`);
    } catch (error) {
      logger.error('Error revoking capabilities:', error);
      throw error;
    }
  }

  generateDeviceFingerprint(components: {
    userAgent: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
    platform?: string;
  }): string {
    const fingerprintString = JSON.stringify(components);
    return crypto.createHash('sha256').update(fingerprintString).digest('hex');
  }
}

export const fraudDetectionService = new FraudDetectionService();
