/**
 * Transaction Controller
 */

import { Request, Response, NextFunction } from 'express';
import { Transaction } from '../models/Transaction';
import { logger } from '../utils/logger';

/**
 * Get transaction by ID
 */
export async function getTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const { transactionId } = req.params;
    
    const transaction = await Transaction.findOne({ transactionId });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    logger.error('Error fetching transaction:', error);
    next(error);
  }
}

/**
 * Get user transactions
 */
export async function getUserTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const { type, status, page = 1, limit = 20 } = req.query;
    
    const query: any = {
      $or: [{ from: userId }, { to: userId }]
    };
    
    if (type) {
      query.type = type;
    }
    
    if (status) {
      query.status = status;
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Transaction.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching user transactions:', error);
    next(error);
  }
}

/**
 * Create a transaction
 */
export async function createTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const { type, from, to, amount, asset, metadata } = req.body;
    
    if (!type || !from || !to || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const transaction = new Transaction({
      transactionId,
      type,
      from,
      to,
      amount,
      asset,
      status: 'pending',
      metadata: metadata || {}
    });
    
    await transaction.save();
    
    logger.info(`Transaction created: ${transactionId}`);
    
    res.status(201).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    logger.error('Error creating transaction:', error);
    next(error);
  }
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { transactionId } = req.params;
    const { status, hash, blockNumber, gasUsed } = req.body;
    
    const transaction = await Transaction.findOne({ transactionId });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    transaction.status = status;
    
    if (hash) transaction.hash = hash;
    if (blockNumber) transaction.blockNumber = blockNumber;
    if (gasUsed) transaction.gasUsed = gasUsed;
    
    if (status === 'confirmed') {
      transaction.confirmedAt = new Date();
    }
    
    await transaction.save();
    
    logger.info(`Transaction status updated: ${transactionId} -> ${status}`);
    
    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    logger.error('Error updating transaction status:', error);
    next(error);
  }
}

/**
 * Get transaction statistics
 */
export async function getTransactionStatistics(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    const daysAgo = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    const [
      totalTransactions,
      confirmedTransactions,
      pendingTransactions,
      failedTransactions,
      totalVolume
    ] = await Promise.all([
      Transaction.countDocuments({
        $or: [{ from: userId }, { to: userId }],
        createdAt: { $gte: startDate }
      }),
      Transaction.countDocuments({
        $or: [{ from: userId }, { to: userId }],
        status: 'confirmed',
        createdAt: { $gte: startDate }
      }),
      Transaction.countDocuments({
        $or: [{ from: userId }, { to: userId }],
        status: 'pending',
        createdAt: { $gte: startDate }
      }),
      Transaction.countDocuments({
        $or: [{ from: userId }, { to: userId }],
        status: 'failed',
        createdAt: { $gte: startDate }
      }),
      Transaction.aggregate([
        {
          $match: {
            $or: [{ from: userId }, { to: userId }],
            status: 'confirmed',
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ])
    ]);
    
    res.json({
      success: true,
      data: {
        period,
        totalTransactions,
        confirmedTransactions,
        pendingTransactions,
        failedTransactions,
        totalVolume: totalVolume[0]?.total || 0,
        successRate: totalTransactions > 0 
          ? (confirmedTransactions / totalTransactions * 100).toFixed(2) 
          : 0
      }
    });
  } catch (error) {
    logger.error('Error fetching transaction statistics:', error);
    next(error);
  }
}
