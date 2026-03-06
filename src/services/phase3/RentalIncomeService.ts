// PHASE 3: Yield-Generating Products
// Task 22.1 - Rental Income Service
// Service for managing rental income assets and tokenization

import { RentalIncomeAsset, IRentalIncomeAsset, ITenant, IPropertyExpense } from '../../models/phase3/RentalIncomeAsset';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

export class RentalIncomeService {
  /**
   * Create a new rental income asset
   */
  static async createRentalAsset(data: {
    propertyAddress: string;
    propertyType: 'single-family' | 'multi-family' | 'apartment' | 'commercial' | 'other';
    propertyValue: number;
    ownerId: string;
    monthlyRent: number;
    projectedAnnualExpenses: number;
  }): Promise<IRentalIncomeAsset> {
    try {
      const projectedAnnualIncome = data.monthlyRent * 12;
      const projectedNetYield = ((projectedAnnualIncome - data.projectedAnnualExpenses) / data.propertyValue) * 100;

      const rentalAsset = await RentalIncomeAsset.create({
        propertyAddress: data.propertyAddress,
        propertyType: data.propertyType,
        propertyValue: data.propertyValue,
        ownerId: new mongoose.Types.ObjectId(data.ownerId),
        monthlyRent: data.monthlyRent,
        occupancyRate: 0,
        projectedAnnualIncome,
        projectedAnnualExpenses: data.projectedAnnualExpenses,
        projectedNetYield,
        tenantHistory: [],
        expenses: [],
        historicalYield: [],
        status: 'vacant'
      });

      logger.info('Rental asset created', { assetId: rentalAsset._id, propertyAddress: data.propertyAddress });

      return rentalAsset;
    } catch (error) {
      logger.error('Error creating rental asset', { error, data });
      throw error;
    }
  }

  /**
   * Add tenant to rental property
   */
  static async addTenant(
    assetId: string,
    tenant: ITenant
  ): Promise<IRentalIncomeAsset> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      // Move current tenant to history if exists
      if (asset.currentTenant) {
        asset.tenantHistory.push(asset.currentTenant);
      }

      asset.currentTenant = tenant;
      asset.monthlyRent = tenant.monthlyRent;
      asset.projectedAnnualIncome = tenant.monthlyRent * 12;
      
      asset.updateOccupancyRate();
      asset.calculateNetYield();

      await asset.save();

      logger.info('Tenant added to rental asset', { assetId, tenantName: tenant.name });

      return asset;
    } catch (error) {
      logger.error('Error adding tenant', { error, assetId });
      throw error;
    }
  }

  /**
   * Record rental payment
   */
  static async recordPayment(
    assetId: string,
    payment: {
      date: Date;
      amount: number;
      status: 'paid' | 'late' | 'pending' | 'missed';
      lateDays?: number;
    }
  ): Promise<IRentalIncomeAsset> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      if (!asset.currentTenant) {
        throw new Error('No current tenant for this property');
      }

      asset.currentTenant.paymentHistory.push(payment);
      
      if (payment.status === 'paid') {
        asset.totalIncome += payment.amount;
      }

      await asset.save();

      logger.info('Payment recorded', { assetId, amount: payment.amount, status: payment.status });

      return asset;
    } catch (error) {
      logger.error('Error recording payment', { error, assetId });
      throw error;
    }
  }

  /**
   * Add expense to rental property
   */
  static async addExpense(
    assetId: string,
    expense: IPropertyExpense
  ): Promise<IRentalIncomeAsset> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      asset.addExpense(expense);
      await asset.save();

      logger.info('Expense added to rental asset', { assetId, category: expense.category, amount: expense.amount });

      return asset;
    } catch (error) {
      logger.error('Error adding expense', { error, assetId });
      throw error;
    }
  }

  /**
   * Calculate net yield for rental property
   */
  static async calculateYield(assetId: string): Promise<number> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      return asset.calculateNetYield();
    } catch (error) {
      logger.error('Error calculating yield', { error, assetId });
      throw error;
    }
  }

  /**
   * Get rental asset by ID
   */
  static async getRentalAsset(assetId: string): Promise<IRentalIncomeAsset | null> {
    try {
      return await RentalIncomeAsset.findById(assetId);
    } catch (error) {
      logger.error('Error getting rental asset', { error, assetId });
      throw error;
    }
  }

  /**
   * Get all rental assets for owner
   */
  static async getOwnerAssets(ownerId: string): Promise<IRentalIncomeAsset[]> {
    try {
      return await RentalIncomeAsset.find({ ownerId: new mongoose.Types.ObjectId(ownerId) });
    } catch (error) {
      logger.error('Error getting owner assets', { error, ownerId });
      throw error;
    }
  }

  /**
   * Update occupancy rate
   */
  static async updateOccupancy(assetId: string): Promise<IRentalIncomeAsset> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      asset.updateOccupancyRate();
      await asset.save();

      return asset;
    } catch (error) {
      logger.error('Error updating occupancy', { error, assetId });
      throw error;
    }
  }

  /**
   * Link bank account for automated collection
   */
  static async linkBankAccount(
    assetId: string,
    bankAccountId: string
  ): Promise<IRentalIncomeAsset> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      asset.bankAccountLinked = true;
      asset.bankAccountId = bankAccountId;
      asset.autoCollectionEnabled = true;

      await asset.save();

      logger.info('Bank account linked', { assetId, bankAccountId });

      return asset;
    } catch (error) {
      logger.error('Error linking bank account', { error, assetId });
      throw error;
    }
  }

  /**
   * Calculate distribution amount after management fees
   */
  static calculateDistributionAmount(
    grossIncome: number,
    managementFeePercentage: number
  ): { netIncome: number; managementFee: number } {
    const managementFee = (grossIncome * managementFeePercentage) / 100;
    const netIncome = grossIncome - managementFee;

    return { netIncome, managementFee };
  }

  /**
   * Get historical yield data
   */
  static async getHistoricalYield(assetId: string): Promise<Array<{
    year: number;
    income: number;
    expenses: number;
    netYield: number;
  }>> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      return asset.historicalYield;
    } catch (error) {
      logger.error('Error getting historical yield', { error, assetId });
      throw error;
    }
  }

  /**
   * Add historical yield data
   */
  static async addHistoricalYield(
    assetId: string,
    yearData: {
      year: number;
      income: number;
      expenses: number;
    }
  ): Promise<IRentalIncomeAsset> {
    try {
      const asset = await RentalIncomeAsset.findById(assetId);
      
      if (!asset) {
        throw new Error('Rental asset not found');
      }

      const netYield = ((yearData.income - yearData.expenses) / asset.propertyValue) * 100;

      asset.historicalYield.push({
        year: yearData.year,
        income: yearData.income,
        expenses: yearData.expenses,
        netYield
      });

      await asset.save();

      logger.info('Historical yield added', { assetId, year: yearData.year });

      return asset;
    } catch (error) {
      logger.error('Error adding historical yield', { error, assetId });
      throw error;
    }
  }
}
