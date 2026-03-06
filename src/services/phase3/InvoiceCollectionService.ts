// PHASE 3: Yield-Generating Products
// Task 23.3 - Payment Collection and Distribution
// Service for automated invoice payment collection and distribution to token holders

import { InvoiceAsset, IInvoiceAsset } from '../../models/phase3/InvoiceAsset';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

interface InvoicePayment {
  transactionId: string;
  amount: number;
  date: Date;
  source: string; // debtor identifier
  paymentMethod: 'bank_transfer' | 'check' | 'wire' | 'ach';
  status: 'pending' | 'completed' | 'failed';
  reference?: string;
}

interface DistributionResult {
  totalAmount: number;
  platformFee: number;
  excessAmount: number;
  distributionAmount: number;
  tokenHolderPayment: number;
}

export class InvoiceCollectionService {
  /**
   * Process automated invoice payment collection
   * Validates payment and updates invoice status
   */
  static async collectInvoicePayment(
    invoiceId: string,
    payment: InvoicePayment
  ): Promise<IInvoiceAsset> {
    try {
      const invoice = await InvoiceAsset.findById(invoiceId);
      
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.paymentStatus === 'paid') {
        throw new Error('Invoice already paid');
      }

      if (invoice.paymentStatus === 'defaulted') {
        throw new Error('Invoice is in default status');
      }

      if (!invoice.isFactored) {
        throw new Error('Invoice is not factored');
      }

      // Validate payment amount
      if (payment.amount < invoice.invoiceAmount) {
        logger.warn('Partial payment received', {
          invoiceId,
          expected: invoice.invoiceAmount,
          received: payment.amount
        });
      }

      // Record payment
      invoice.paidAmount = payment.amount;
      invoice.paidDate = payment.date;
      invoice.paymentStatus = 'paid';
      invoice.status = 'paid';
      invoice.daysOverdue = 0;

      // Update escrow balance
      invoice.escrowBalance += payment.amount;

      await invoice.save();

      logger.info('Invoice payment collected', {
        invoiceId: invoice.invoiceNumber,
        amount: payment.amount,
        transactionId: payment.transactionId,
        debtor: invoice.debtor.businessName
      });

      return invoice;
    } catch (error) {
      logger.error('Error collecting invoice payment', { error, invoiceId });
      throw error;
    }
  }

  /**
   * Distribute payment to token holders and return excess to issuer
   * Implements Requirements 18.4
   */
  static async distributePayment(
    invoiceId: string
  ): Promise<DistributionResult> {
    try {
      const invoice = await InvoiceAsset.findById(invoiceId);
      
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.paymentStatus !== 'paid') {
        throw new Error('Invoice payment not received');
      }

      if (!invoice.isTokenized) {
        throw new Error('Invoice is not tokenized');
      }

      if (!invoice.paidAmount) {
        throw new Error('No payment amount recorded');
      }

      const totalAmount = invoice.paidAmount;
      const invoiceAmount = invoice.invoiceAmount;
      
      // Calculate platform fee (already deducted during factoring)
      const platformFee = invoice.factoringFee;
      
      // Calculate excess (if payment > invoice amount)
      const excessAmount = Math.max(0, totalAmount - invoiceAmount);
      
      // Amount to distribute to token holders (full invoice amount)
      const distributionAmount = Math.min(totalAmount, invoiceAmount);
      
      // Token holders get the full invoice amount
      const tokenHolderPayment = distributionAmount;

      // Update escrow balance
      invoice.escrowBalance = 0; // Funds distributed

      await invoice.save();

      logger.info('Payment distributed', {
        invoiceId: invoice.invoiceNumber,
        totalAmount,
        platformFee,
        excessAmount,
        distributionAmount,
        tokenHolderPayment
      });

      // In production, would trigger actual distribution to token holders
      // via smart contract or payment processor

      return {
        totalAmount,
        platformFee,
        excessAmount,
        distributionAmount,
        tokenHolderPayment
      };
    } catch (error) {
      logger.error('Error distributing payment', { error, invoiceId });
      throw error;
    }
  }

  /**
   * Return excess funds to original invoice issuer
   * Implements Requirements 18.4
   */
  static async returnExcessToIssuer(
    invoiceId: string,
    excessAmount: number
  ): Promise<void> {
    try {
      const invoice = await InvoiceAsset.findById(invoiceId);
      
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (excessAmount <= 0) {
        throw new Error('No excess amount to return');
      }

      logger.info('Excess funds returned to issuer', {
        invoiceId: invoice.invoiceNumber,
        issuerBusinessId: invoice.issuerBusinessId,
        excessAmount
      });

      // In production, would trigger actual payment to issuer
      // via bank transfer or blockchain transaction
    } catch (error) {
      logger.error('Error returning excess to issuer', { error, invoiceId });
      throw error;
    }
  }

  /**
   * Handle overdue invoice and initiate collection procedures
   * Implements Requirements 18.5
   */
  static async handleOverdueInvoice(
    invoiceId: string
  ): Promise<IInvoiceAsset> {
    try {
      const invoice = await InvoiceAsset.findById(invoiceId);
      
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Update payment status
      invoice.updatePaymentStatus();

      const daysOverdue = invoice.daysOverdue;

      // Determine collection procedure based on days overdue
      let collectionAction: string;
      
      if (daysOverdue <= 15) {
        collectionAction = 'reminder';
        await this.sendPaymentReminder(invoice);
      } else if (daysOverdue <= 30) {
        collectionAction = 'escalated_reminder';
        await this.sendEscalatedReminder(invoice);
      } else if (daysOverdue <= 60) {
        collectionAction = 'collection_agency';
        await this.initiateCollectionAgency(invoice);
      } else {
        collectionAction = 'legal_action';
        await this.initiateLegalAction(invoice);
      }

      await invoice.save();

      logger.warn('Overdue invoice collection initiated', {
        invoiceId: invoice.invoiceNumber,
        daysOverdue,
        collectionAction,
        debtor: invoice.debtor.businessName
      });

      return invoice;
    } catch (error) {
      logger.error('Error handling overdue invoice', { error, invoiceId });
      throw error;
    }
  }

  /**
   * Send payment reminder to debtor
   */
  private static async sendPaymentReminder(invoice: IInvoiceAsset): Promise<void> {
    logger.info('Payment reminder sent', {
      invoiceId: invoice.invoiceNumber,
      debtor: invoice.debtor.businessName,
      debtorEmail: invoice.debtor.email,
      amount: invoice.invoiceAmount,
      daysOverdue: invoice.daysOverdue
    });

    // In production, would send actual email/SMS reminder
    // using notification service (SendGrid, Twilio, etc.)
  }

  /**
   * Send escalated reminder with late fees
   */
  private static async sendEscalatedReminder(invoice: IInvoiceAsset): Promise<void> {
    const lateFee = (invoice.invoiceAmount * 0.05); // 5% late fee

    logger.warn('Escalated reminder sent', {
      invoiceId: invoice.invoiceNumber,
      debtor: invoice.debtor.businessName,
      amount: invoice.invoiceAmount,
      lateFee,
      totalDue: invoice.invoiceAmount + lateFee,
      daysOverdue: invoice.daysOverdue
    });

    // In production, would send escalated notice with late fees
  }

  /**
   * Initiate collection agency process
   */
  private static async initiateCollectionAgency(invoice: IInvoiceAsset): Promise<void> {
    logger.warn('Collection agency initiated', {
      invoiceId: invoice.invoiceNumber,
      debtor: invoice.debtor.businessName,
      amount: invoice.invoiceAmount,
      daysOverdue: invoice.daysOverdue
    });

    // In production, would integrate with collection agency API
    // to hand off collection process
  }

  /**
   * Initiate legal action for severely overdue invoices
   */
  private static async initiateLegalAction(invoice: IInvoiceAsset): Promise<void> {
    logger.error('Legal action initiated', {
      invoiceId: invoice.invoiceNumber,
      debtor: invoice.debtor.businessName,
      amount: invoice.invoiceAmount,
      daysOverdue: invoice.daysOverdue
    });

    // In production, would integrate with legal services
    // to initiate formal collection proceedings
  }

  /**
   * Adjust debtor credit rating based on payment behavior
   * Implements Requirements 18.5
   */
  static async adjustDebtorCreditRating(
    invoiceId: string
  ): Promise<IInvoiceAsset> {
    try {
      const invoice = await InvoiceAsset.findById(invoiceId);
      
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const previousRating = invoice.debtor.creditRating;

      // Update debtor metrics (includes credit rating adjustment)
      invoice.updateDebtorMetrics();

      await invoice.save();

      logger.info('Debtor credit rating adjusted', {
        invoiceId: invoice.invoiceNumber,
        debtor: invoice.debtor.businessName,
        previousRating,
        newRating: invoice.debtor.creditRating,
        onTimePaymentRate: invoice.debtor.onTimePaymentRate
      });

      return invoice;
    } catch (error) {
      logger.error('Error adjusting debtor credit rating', { error, invoiceId });
      throw error;
    }
  }

  /**
   * Track payment reconciliation
   */
  static async reconcilePayment(
    invoiceId: string,
    expectedAmount: number,
    receivedAmount: number
  ): Promise<{
    isReconciled: boolean;
    discrepancy: number;
    action: string;
  }> {
    try {
      const invoice = await InvoiceAsset.findById(invoiceId);
      
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const discrepancy = receivedAmount - expectedAmount;
      const isReconciled = Math.abs(discrepancy) < 0.01; // Allow 1 cent tolerance

      let action: string;
      
      if (isReconciled) {
        action = 'payment_reconciled';
      } else if (discrepancy > 0) {
        action = 'overpayment_detected';
      } else {
        action = 'underpayment_detected';
      }

      logger.info('Payment reconciliation', {
        invoiceId: invoice.invoiceNumber,
        expectedAmount,
        receivedAmount,
        discrepancy,
        isReconciled,
        action
      });

      return {
        isReconciled,
        discrepancy,
        action
      };
    } catch (error) {
      logger.error('Error reconciling payment', { error, invoiceId });
      throw error;
    }
  }

  /**
   * Get collection status for invoice
   */
  static async getCollectionStatus(invoiceId: string): Promise<{
    invoiceNumber: string;
    debtor: string;
    amount: number;
    dueDate: Date;
    paymentStatus: string;
    daysOverdue: number;
    collectionStage: string;
    nextAction: string;
    nextActionDate: Date;
  }> {
    try {
      const invoice = await InvoiceAsset.findById(invoiceId);
      
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Update status
      invoice.updatePaymentStatus();

      let collectionStage: string;
      let nextAction: string;
      let nextActionDate: Date;

      const daysOverdue = invoice.daysOverdue;

      if (invoice.paymentStatus === 'paid') {
        collectionStage = 'completed';
        nextAction = 'none';
        nextActionDate = new Date();
      } else if (daysOverdue === 0) {
        collectionStage = 'pending';
        nextAction = 'monitor';
        nextActionDate = invoice.dueDate;
      } else if (daysOverdue <= 15) {
        collectionStage = 'reminder';
        nextAction = 'send_reminder';
        nextActionDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
      } else if (daysOverdue <= 30) {
        collectionStage = 'escalated';
        nextAction = 'escalated_reminder';
        nextActionDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      } else if (daysOverdue <= 60) {
        collectionStage = 'collection_agency';
        nextAction = 'agency_followup';
        nextActionDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
      } else {
        collectionStage = 'legal';
        nextAction = 'legal_proceedings';
        nextActionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      }

      return {
        invoiceNumber: invoice.invoiceNumber,
        debtor: invoice.debtor.businessName,
        amount: invoice.invoiceAmount,
        dueDate: invoice.dueDate,
        paymentStatus: invoice.paymentStatus,
        daysOverdue,
        collectionStage,
        nextAction,
        nextActionDate
      };
    } catch (error) {
      logger.error('Error getting collection status', { error, invoiceId });
      throw error;
    }
  }

  /**
   * Batch process overdue invoices
   */
  static async processOverdueInvoices(): Promise<{
    processed: number;
    reminders: number;
    escalated: number;
    collections: number;
    legal: number;
  }> {
    try {
      const now = new Date();
      
      // Find all overdue invoices that are not paid or defaulted
      const overdueInvoices = await InvoiceAsset.find({
        dueDate: { $lt: now },
        paymentStatus: { $in: ['pending', 'late'] },
        isFactored: true
      });

      let reminders = 0;
      let escalated = 0;
      let collections = 0;
      let legal = 0;

      for (const invoice of overdueInvoices) {
        await this.handleOverdueInvoice(invoice._id.toString());
        
        const daysOverdue = invoice.daysOverdue;
        
        if (daysOverdue <= 15) reminders++;
        else if (daysOverdue <= 30) escalated++;
        else if (daysOverdue <= 60) collections++;
        else legal++;
      }

      logger.info('Batch overdue processing completed', {
        processed: overdueInvoices.length,
        reminders,
        escalated,
        collections,
        legal
      });

      return {
        processed: overdueInvoices.length,
        reminders,
        escalated,
        collections,
        legal
      };
    } catch (error) {
      logger.error('Error processing overdue invoices', { error });
      throw error;
    }
  }

  /**
   * Get payment history for debtor across all invoices
   */
  static async getDebtorPaymentHistory(debtorBusinessName: string): Promise<Array<{
    invoiceNumber: string;
    amount: number;
    dueDate: Date;
    paidDate?: Date;
    status: string;
    daysLate: number;
  }>> {
    try {
      const invoices = await InvoiceAsset.find({
        'debtor.businessName': debtorBusinessName
      }).sort({ dueDate: -1 });

      return invoices.map(invoice => ({
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.invoiceAmount,
        dueDate: invoice.dueDate,
        paidDate: invoice.paidDate,
        status: invoice.paymentStatus,
        daysLate: invoice.paidDate && invoice.paidDate > invoice.dueDate
          ? Math.ceil((invoice.paidDate.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0
      }));
    } catch (error) {
      logger.error('Error getting debtor payment history', { error, debtorBusinessName });
      throw error;
    }
  }

  /**
   * Calculate debtor reliability metrics
   */
  static async calculateDebtorMetrics(debtorBusinessName: string): Promise<{
    totalInvoices: number;
    paidInvoices: number;
    overdueInvoices: number;
    defaultedInvoices: number;
    averageDaysLate: number;
    onTimePaymentRate: number;
    creditRating: number;
  }> {
    try {
      const invoices = await InvoiceAsset.find({
        'debtor.businessName': debtorBusinessName
      });

      if (invoices.length === 0) {
        return {
          totalInvoices: 0,
          paidInvoices: 0,
          overdueInvoices: 0,
          defaultedInvoices: 0,
          averageDaysLate: 0,
          onTimePaymentRate: 0,
          creditRating: 50 // Default neutral rating
        };
      }

      const totalInvoices = invoices.length;
      const paidInvoices = invoices.filter(i => i.paymentStatus === 'paid').length;
      const overdueInvoices = invoices.filter(i => i.paymentStatus === 'late').length;
      const defaultedInvoices = invoices.filter(i => i.paymentStatus === 'defaulted').length;

      const paidOnTime = invoices.filter(i => 
        i.paymentStatus === 'paid' && 
        i.paidDate && 
        i.paidDate <= i.dueDate
      ).length;

      const onTimePaymentRate = totalInvoices > 0 ? (paidOnTime / totalInvoices) * 100 : 0;

      const daysLateSum = invoices
        .filter(i => i.paidDate && i.paidDate > i.dueDate)
        .reduce((sum, i) => {
          const daysLate = Math.ceil((i.paidDate!.getTime() - i.dueDate.getTime()) / (1000 * 60 * 60 * 24));
          return sum + daysLate;
        }, 0);

      const averageDaysLate = paidInvoices > 0 ? daysLateSum / paidInvoices : 0;

      // Get credit rating from most recent invoice
      const creditRating = invoices[0]?.debtor.creditRating || 50;

      return {
        totalInvoices,
        paidInvoices,
        overdueInvoices,
        defaultedInvoices,
        averageDaysLate,
        onTimePaymentRate,
        creditRating
      };
    } catch (error) {
      logger.error('Error calculating debtor metrics', { error, debtorBusinessName });
      throw error;
    }
  }
}
