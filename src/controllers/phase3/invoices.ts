// PHASE 3: Yield-Generating Products
// Task 23.3 - Payment Collection and Distribution
// Controller for invoice payment collection and distribution endpoints

import { Request, Response } from 'express';
import { InvoiceCollectionService } from '../../services/phase3/InvoiceCollectionService';
import { logger } from '../../utils/logger';

/**
 * Collect invoice payment
 * POST /api/phase3/invoices/:invoiceId/collect
 */
export const collectPayment = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { transactionId, amount, date, source, paymentMethod, status, reference } = req.body;

    if (!transactionId || !amount || !date || !source || !paymentMethod) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment fields'
      });
    }

    const payment = {
      transactionId,
      amount: parseFloat(amount),
      date: new Date(date),
      source,
      paymentMethod,
      status: status || 'completed',
      reference
    };

    const invoice = await InvoiceCollectionService.collectInvoicePayment(
      invoiceId,
      payment
    );

    res.json({
      success: true,
      data: {
        invoice: {
          id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          paymentStatus: invoice.paymentStatus,
          paidAmount: invoice.paidAmount,
          paidDate: invoice.paidDate
        }
      }
    });
  } catch (error: any) {
    logger.error('Error in collectPayment controller', { error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to collect payment'
    });
  }
};

/**
 * Distribute payment to token holders
 * POST /api/phase3/invoices/:invoiceId/distribute
 */
export const distributePayment = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    const result = await InvoiceCollectionService.distributePayment(invoiceId);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error in distributePayment controller', { error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to distribute payment'
    });
  }
};

/**
 * Handle overdue invoice
 * POST /api/phase3/invoices/:invoiceId/overdue
 */
export const handleOverdue = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await InvoiceCollectionService.handleOverdueInvoice(invoiceId);

    res.json({
      success: true,
      data: {
        invoice: {
          id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          paymentStatus: invoice.paymentStatus,
          daysOverdue: invoice.daysOverdue,
          debtor: invoice.debtor.businessName
        }
      }
    });
  } catch (error: any) {
    logger.error('Error in handleOverdue controller', { error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to handle overdue invoice'
    });
  }
};

/**
 * Adjust debtor credit rating
 * POST /api/phase3/invoices/:invoiceId/adjust-rating
 */
export const adjustCreditRating = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await InvoiceCollectionService.adjustDebtorCreditRating(invoiceId);

    res.json({
      success: true,
      data: {
        debtor: {
          businessName: invoice.debtor.businessName,
          creditRating: invoice.debtor.creditRating,
          onTimePaymentRate: invoice.debtor.onTimePaymentRate,
          totalInvoices: invoice.debtor.totalInvoices
        }
      }
    });
  } catch (error: any) {
    logger.error('Error in adjustCreditRating controller', { error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to adjust credit rating'
    });
  }
};

/**
 * Get collection status
 * GET /api/phase3/invoices/:invoiceId/collection-status
 */
export const getCollectionStatus = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    const status = await InvoiceCollectionService.getCollectionStatus(invoiceId);

    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    logger.error('Error in getCollectionStatus controller', { error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get collection status'
    });
  }
};

/**
 * Reconcile payment
 * POST /api/phase3/invoices/:invoiceId/reconcile
 */
export const reconcilePayment = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { expectedAmount, receivedAmount } = req.body;

    if (!expectedAmount || !receivedAmount) {
      return res.status(400).json({
        success: false,
        error: 'Missing expected or received amount'
      });
    }

    const result = await InvoiceCollectionService.reconcilePayment(
      invoiceId,
      parseFloat(expectedAmount),
      parseFloat(receivedAmount)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error in reconcilePayment controller', { error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reconcile payment'
    });
  }
};

/**
 * Process batch overdue invoices
 * POST /api/phase3/invoices/process-overdue
 */
export const processBatchOverdue = async (req: Request, res: Response) => {
  try {
    const result = await InvoiceCollectionService.processOverdueInvoices();

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error in processBatchOverdue controller', { error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process overdue invoices'
    });
  }
};

/**
 * Get debtor payment history
 * GET /api/phase3/debtors/:debtorBusinessName/payment-history
 */
export const getDebtorPaymentHistory = async (req: Request, res: Response) => {
  try {
    const { debtorBusinessName } = req.params;

    const history = await InvoiceCollectionService.getDebtorPaymentHistory(
      decodeURIComponent(debtorBusinessName)
    );

    res.json({
      success: true,
      data: {
        debtor: debtorBusinessName,
        history
      }
    });
  } catch (error: any) {
    logger.error('Error in getDebtorPaymentHistory controller', { error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get payment history'
    });
  }
};

/**
 * Get debtor metrics
 * GET /api/phase3/debtors/:debtorBusinessName/metrics
 */
export const getDebtorMetrics = async (req: Request, res: Response) => {
  try {
    const { debtorBusinessName } = req.params;

    const metrics = await InvoiceCollectionService.calculateDebtorMetrics(
      decodeURIComponent(debtorBusinessName)
    );

    res.json({
      success: true,
      data: {
        debtor: debtorBusinessName,
        metrics
      }
    });
  } catch (error: any) {
    logger.error('Error in getDebtorMetrics controller', { error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get debtor metrics'
    });
  }
};
