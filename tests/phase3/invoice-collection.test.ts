// PHASE 3: Yield-Generating Products
// Task 23.3 - Payment Collection and Distribution
// Tests for invoice payment collection and distribution

import { InvoiceCollectionService } from '../../src/services/phase3/InvoiceCollectionService';
import { InvoiceAsset } from '../../src/models/phase3/InvoiceAsset';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/test-db';

describe('InvoiceCollectionService', () => {
  beforeAll(async () => {
    await connectTestDB();
  }, 60000); // 60 second timeout

  afterAll(async () => {
    await disconnectTestDB();
  }, 60000); // 60 second timeout

  afterEach(async () => {
    await clearTestDB();
  });

  describe('collectInvoicePayment', () => {
    it('should collect payment for a factored invoice', async () => {
      // Create test invoice
      const invoice = await InvoiceAsset.create({
        invoiceNumber: 'INV-TEST-001',
        issuerBusinessId: '507f1f77bcf86cd799439011',
        debtor: {
          name: 'John Doe',
          businessName: 'Test Corp',
          email: 'test@example.com',
          creditRating: 75,
          paymentHistory: [],
          totalInvoices: 0,
          onTimePaymentRate: 100
        },
        invoiceAmount: 10000,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        issueDate: new Date(),
        paymentTerms: 30,
        isFactored: true,
        discountRate: 3.5,
        advanceRate: 80,
        advanceAmount: 7650,
        factoringFee: 350,
        riskScore: 25,
        expectedPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'funded'
      });

      const payment = {
        transactionId: 'TXN-001',
        amount: 10000,
        date: new Date(),
        source: 'Test Corp',
        paymentMethod: 'bank_transfer' as const,
        status: 'completed' as const
      };

      const result = await InvoiceCollectionService.collectInvoicePayment(
        invoice._id.toString(),
        payment
      );

      expect(result.paymentStatus).toBe('paid');
      expect(result.paidAmount).toBe(10000);
      expect(result.status).toBe('paid');
    });

    it('should reject payment for already paid invoice', async () => {
      const invoice = await InvoiceAsset.create({
        invoiceNumber: 'INV-TEST-002',
        issuerBusinessId: '507f1f77bcf86cd799439011',
        debtor: {
          name: 'John Doe',
          businessName: 'Test Corp',
          email: 'test@example.com',
          creditRating: 75,
          paymentHistory: [],
          totalInvoices: 0,
          onTimePaymentRate: 100
        },
        invoiceAmount: 10000,
        dueDate: new Date(),
        issueDate: new Date(),
        paymentTerms: 30,
        isFactored: true,
        paymentStatus: 'paid',
        riskScore: 25,
        expectedPaymentDate: new Date(),
        status: 'paid'
      });

      const payment = {
        transactionId: 'TXN-002',
        amount: 10000,
        date: new Date(),
        source: 'Test Corp',
        paymentMethod: 'bank_transfer' as const,
        status: 'completed' as const
      };

      await expect(
        InvoiceCollectionService.collectInvoicePayment(
          invoice._id.toString(),
          payment
        )
      ).rejects.toThrow('Invoice already paid');
    });
  });

  describe('distributePayment', () => {
    it('should distribute payment to token holders', async () => {
      const invoice = await InvoiceAsset.create({
        invoiceNumber: 'INV-TEST-003',
        issuerBusinessId: '507f1f77bcf86cd799439011',
        debtor: {
          name: 'John Doe',
          businessName: 'Test Corp',
          email: 'test@example.com',
          creditRating: 75,
          paymentHistory: [],
          totalInvoices: 0,
          onTimePaymentRate: 100
        },
        invoiceAmount: 10000,
        dueDate: new Date(),
        issueDate: new Date(),
        paymentTerms: 30,
        isFactored: true,
        isTokenized: true,
        paymentStatus: 'paid',
        paidAmount: 10000,
        paidDate: new Date(),
        discountRate: 3.5,
        factoringFee: 350,
        escrowBalance: 10000,
        riskScore: 25,
        expectedPaymentDate: new Date(),
        status: 'paid'
      });

      const result = await InvoiceCollectionService.distributePayment(
        invoice._id.toString()
      );

      expect(result.totalAmount).toBe(10000);
      expect(result.platformFee).toBe(350);
      expect(result.distributionAmount).toBe(10000);
      expect(result.tokenHolderPayment).toBe(10000);
    });

    it('should handle overpayment correctly', async () => {
      const invoice = await InvoiceAsset.create({
        invoiceNumber: 'INV-TEST-004',
        issuerBusinessId: '507f1f77bcf86cd799439011',
        debtor: {
          name: 'John Doe',
          businessName: 'Test Corp',
          email: 'test@example.com',
          creditRating: 75,
          paymentHistory: [],
          totalInvoices: 0,
          onTimePaymentRate: 100
        },
        invoiceAmount: 10000,
        dueDate: new Date(),
        issueDate: new Date(),
        paymentTerms: 30,
        isFactored: true,
        isTokenized: true,
        paymentStatus: 'paid',
        paidAmount: 10500, // Overpayment
        paidDate: new Date(),
        discountRate: 3.5,
        factoringFee: 350,
        escrowBalance: 10500,
        riskScore: 25,
        expectedPaymentDate: new Date(),
        status: 'paid'
      });

      const result = await InvoiceCollectionService.distributePayment(
        invoice._id.toString()
      );

      expect(result.totalAmount).toBe(10500);
      expect(result.excessAmount).toBe(500);
      expect(result.distributionAmount).toBe(10000);
    });
  });

  describe('handleOverdueInvoice', () => {
    it('should handle overdue invoice and update status', async () => {
      const pastDueDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000); // 20 days ago

      const invoice = await InvoiceAsset.create({
        invoiceNumber: 'INV-TEST-005',
        issuerBusinessId: '507f1f77bcf86cd799439011',
        debtor: {
          name: 'John Doe',
          businessName: 'Test Corp',
          email: 'test@example.com',
          creditRating: 75,
          paymentHistory: [],
          totalInvoices: 0,
          onTimePaymentRate: 100
        },
        invoiceAmount: 10000,
        dueDate: pastDueDate,
        issueDate: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
        paymentTerms: 30,
        isFactored: true,
        paymentStatus: 'pending',
        riskScore: 25,
        expectedPaymentDate: pastDueDate,
        status: 'collecting'
      });

      const result = await InvoiceCollectionService.handleOverdueInvoice(
        invoice._id.toString()
      );

      expect(result.paymentStatus).toBe('late');
      expect(result.daysOverdue).toBeGreaterThan(0);
    });
  });

  describe('calculateDebtorMetrics', () => {
    it('should calculate debtor reliability metrics', async () => {
      const debtorName = 'Reliable Corp';

      // Create multiple invoices for the debtor
      await InvoiceAsset.create([
        {
          invoiceNumber: 'INV-TEST-006',
          issuerBusinessId: '507f1f77bcf86cd799439011',
          debtor: {
            name: 'John Doe',
            businessName: debtorName,
            email: 'test@example.com',
            creditRating: 85,
            paymentHistory: [],
            totalInvoices: 0,
            onTimePaymentRate: 100
          },
          invoiceAmount: 5000,
          dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          issueDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
          paymentTerms: 30,
          isFactored: true,
          paymentStatus: 'paid',
          paidAmount: 5000,
          paidDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // Paid on time
          riskScore: 15,
          expectedPaymentDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          status: 'paid'
        },
        {
          invoiceNumber: 'INV-TEST-007',
          issuerBusinessId: '507f1f77bcf86cd799439011',
          debtor: {
            name: 'John Doe',
            businessName: debtorName,
            email: 'test@example.com',
            creditRating: 85,
            paymentHistory: [],
            totalInvoices: 0,
            onTimePaymentRate: 100
          },
          invoiceAmount: 7500,
          dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          issueDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
          paymentTerms: 30,
          isFactored: true,
          paymentStatus: 'paid',
          paidAmount: 7500,
          paidDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Paid on time
          riskScore: 15,
          expectedPaymentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          status: 'paid'
        }
      ]);

      const metrics = await InvoiceCollectionService.calculateDebtorMetrics(debtorName);

      expect(metrics.totalInvoices).toBe(2);
      expect(metrics.paidInvoices).toBe(2);
      expect(metrics.onTimePaymentRate).toBe(100);
      expect(metrics.creditRating).toBe(85);
    });
  });

  describe('reconcilePayment', () => {
    it('should reconcile matching payment amounts', async () => {
      const invoice = await InvoiceAsset.create({
        invoiceNumber: 'INV-TEST-008',
        issuerBusinessId: '507f1f77bcf86cd799439011',
        debtor: {
          name: 'John Doe',
          businessName: 'Test Corp',
          email: 'test@example.com',
          creditRating: 75,
          paymentHistory: [],
          totalInvoices: 0,
          onTimePaymentRate: 100
        },
        invoiceAmount: 10000,
        dueDate: new Date(),
        issueDate: new Date(),
        paymentTerms: 30,
        isFactored: true,
        riskScore: 25,
        expectedPaymentDate: new Date(),
        status: 'funded'
      });

      const result = await InvoiceCollectionService.reconcilePayment(
        invoice._id.toString(),
        10000,
        10000
      );

      expect(result.isReconciled).toBe(true);
      expect(result.discrepancy).toBe(0);
      expect(result.action).toBe('payment_reconciled');
    });

    it('should detect overpayment', async () => {
      const invoice = await InvoiceAsset.create({
        invoiceNumber: 'INV-TEST-009',
        issuerBusinessId: '507f1f77bcf86cd799439011',
        debtor: {
          name: 'John Doe',
          businessName: 'Test Corp',
          email: 'test@example.com',
          creditRating: 75,
          paymentHistory: [],
          totalInvoices: 0,
          onTimePaymentRate: 100
        },
        invoiceAmount: 10000,
        dueDate: new Date(),
        issueDate: new Date(),
        paymentTerms: 30,
        isFactored: true,
        riskScore: 25,
        expectedPaymentDate: new Date(),
        status: 'funded'
      });

      const result = await InvoiceCollectionService.reconcilePayment(
        invoice._id.toString(),
        10000,
        10500
      );

      expect(result.isReconciled).toBe(false);
      expect(result.discrepancy).toBe(500);
      expect(result.action).toBe('overpayment_detected');
    });
  });
});
