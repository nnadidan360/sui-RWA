// PHASE 3: Yield-Generating Products
// Task 22.3 - Automated Collection Integration
// Service for automated rental payment collection and distribution

import { RentalIncomeAsset, IRentalIncomeAsset } from '../../models/phase3/RentalIncomeAsset';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

interface BankPayment {
  transactionId: string;
  amount: number;
  date: Date;
  source: string;
  status: 'pending' | 'completed' | 'failed';
}

export class RentalCollectionService {
  /**
   * Process automated rental payment collection
   */
  static async collectRentalPayment(
    assetId: string,
    payment: BankPayment
  ): Promise<IRentalIncomeAsset> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      if (!asset.bankAccountLinked) {
        throw new Error('Bank account not linked for this property');
      }

      if (!asset.currentTenant) {
        throw new Error('No current tenant for this property');
      }

      // Record the payment
      asset.currentTenant.paymentHistory.push({
        date: payment.date,
        amount: payment.amount,
        status: payment.status === 'completed' ? 'paid' : 'pending',
        lateDays: 0
      });

      if (payment.status === 'completed') {
        asset.totalIncome += payment.amount;
      }

      await asset.save();

      logger.info('Rental payment collected', {
        assetId,
        amount: payment.amount,
        transactionId: payment.transactionId
      });

      return asset;
    } catch (error) {
      logger.error('Error collecting rental payment', { error, assetId });
      throw error;
    }
  }

  /**
   * Distribute rental income to token holders
   */
  static async distributeIncome(
    assetId: string,
    grossIncome: number
  ): Promise<{
    netIncome: number;
    managementFee: number;
    distributionAmount: number;
  }> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      if (!asset.isTokenized) {
        throw new Error('Asset is not tokenized');
      }

      // Calculate management fee
      const managementFee = (grossIncome * asset.managementFeePercentage) / 100;
      const netIncome = grossIncome - managementFee;

      // In production, would distribute to token holders via dividend service
      const distributionAmount = netIncome;

      logger.info('Income distributed', {
        assetId,
        grossIncome,
        managementFee,
        netIncome,
        distributionAmount
      });

      return {
        netIncome,
        managementFee,
        distributionAmount
      };
    } catch (error) {
      logger.error('Error distributing income', { error, assetId });
      throw error;
    }
  }

  /**
   * Handle late payment
   */
  static async handleLatePayment(
    assetId: string,
    lateDays: number
  ): Promise<IRentalIncomeAsset> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      if (!asset.currentTenant) {
        throw new Error('No current tenant for this property');
      }

      // Record late payment
      const lastPaymentIndex = asset.currentTenant.paymentHistory.length - 1;
      if (lastPaymentIndex >= 0) {
        asset.currentTenant.paymentHistory[lastPaymentIndex].status = 'late';
        asset.currentTenant.paymentHistory[lastPaymentIndex].lateDays = lateDays;
      }

      await asset.save();

      logger.warn('Late payment recorded', {
        assetId,
        lateDays,
        tenantName: asset.currentTenant.name
      });

      return asset;
    } catch (error) {
      logger.error('Error handling late payment', { error, assetId });
      throw error;
    }
  }

  /**
   * Process collection for overdue payment
   */
  static async processCollection(
    assetId: string,
    collectionMethod: 'reminder' | 'legal' | 'eviction'
  ): Promise<void> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      logger.info('Collection process initiated', {
        assetId,
        method: collectionMethod,
        tenant: asset.currentTenant?.name
      });

      // In production, would trigger appropriate collection procedures
      // - reminder: Send automated reminder email/SMS
      // - legal: Initiate legal collection process
      // - eviction: Start eviction proceedings
    } catch (error) {
      logger.error('Error processing collection', { error, assetId });
      throw error;
    }
  }

  /**
   * Link bank account via Plaid or similar service
   */
  static async linkBankAccount(
    assetId: string,
    bankDetails: {
      accountId: string;
      accountName: string;
      routingNumber: string;
      accountNumber: string;
    }
  ): Promise<IRentalIncomeAsset> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      asset.bankAccountLinked = true;
      asset.bankAccountId = bankDetails.accountId;
      asset.autoCollectionEnabled = true;

      await asset.save();

      logger.info('Bank account linked', {
        assetId,
        accountId: bankDetails.accountId
      });

      return asset;
    } catch (error) {
      logger.error('Error linking bank account', { error, assetId });
      throw error;
    }
  }

  /**
   * Enable/disable automated collection
   */
  static async toggleAutoCollection(
    assetId: string,
    enabled: boolean
  ): Promise<IRentalIncomeAsset> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      if (!asset.bankAccountLinked && enabled) {
        throw new Error('Cannot enable auto-collection without linked bank account');
      }

      asset.autoCollectionEnabled = enabled;
      await asset.save();

      logger.info('Auto-collection toggled', { assetId, enabled });

      return asset;
    } catch (error) {
      logger.error('Error toggling auto-collection', { error, assetId });
      throw error;
    }
  }

  /**
   * Get payment history for asset
   */
  static async getPaymentHistory(assetId: string): Promise<Array<{
    date: Date;
    amount: number;
    status: string;
    lateDays?: number;
  }>> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      if (!asset.currentTenant) {
        return [];
      }

      return asset.currentTenant.paymentHistory;
    } catch (error) {
      logger.error('Error getting payment history', { error, assetId });
      throw error;
    }
  }

  /**
   * Calculate on-time payment rate
   */
  static async calculatePaymentRate(assetId: string): Promise<{
    totalPayments: number;
    onTimePayments: number;
    latePayments: number;
    missedPayments: number;
    onTimeRate: number;
  }> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      if (!asset.currentTenant) {
        return {
          totalPayments: 0,
          onTimePayments: 0,
          latePayments: 0,
          missedPayments: 0,
          onTimeRate: 0
        };
      }

      const payments = asset.currentTenant.paymentHistory;
      const totalPayments = payments.length;
      const onTimePayments = payments.filter(p => p.status === 'paid' && (!p.lateDays || p.lateDays === 0)).length;
      const latePayments = payments.filter(p => p.status === 'late').length;
      const missedPayments = payments.filter(p => p.status === 'missed').length;
      const onTimeRate = totalPayments > 0 ? (onTimePayments / totalPayments) * 100 : 0;

      return {
        totalPayments,
        onTimePayments,
        latePayments,
        missedPayments,
        onTimeRate
      };
    } catch (error) {
      logger.error('Error calculating payment rate', { error, assetId });
      throw error;
    }
  }

  /**
   * Schedule automated collection
   */
  static async scheduleCollection(
    assetId: string,
    dayOfMonth: number
  ): Promise<void> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      if (!asset.autoCollectionEnabled) {
        throw new Error('Auto-collection is not enabled');
      }

      logger.info('Collection scheduled', {
        assetId,
        dayOfMonth,
        monthlyRent: asset.monthlyRent
      });

      // In production, would set up recurring job/webhook
      // to automatically collect payment on specified day
    } catch (error) {
      logger.error('Error scheduling collection', { error, assetId });
      throw error;
    }
  }
}
