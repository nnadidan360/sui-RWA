/**
 * Property-Based Tests for Suspicious Activity Detection
 * 
 * **Feature: rwa-lending-protocol, Property 25: Suspicious activity response**
 * **Validates: Requirements 6.3**
 */

import * as fc from 'fast-check';

// Mock interfaces matching the analytics service
interface TransactionMetrics {
  transactionId: string;
  userId: string;
  type: 'tokenization' | 'lending' | 'staking' | 'liquidation';
  amount: number;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
  gasUsed?: number;
  processingTime?: number;
  riskScore?: number;
}

interface SuspiciousActivity {
  userId: string;
  activityType: 'rapid_transactions' | 'large_amounts' | 'unusual_patterns' | 'failed_attempts';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

interface UserAccount {
  userId: string;
  status: 'active' | 'suspended' | 'under_review';
  suspensionReason?: string;
  suspendedAt?: Date;
  normalHours: number[];
  transactionHistory: TransactionMetrics[];
}

// Mock suspicious activity detection service
class SuspiciousActivityDetector {
  private users: Map<string, UserAccount> = new Map();
  private suspiciousActivities: SuspiciousActivity[] = [];
  private transactionHistory: TransactionMetrics[] = [];
  private amountPercentiles: Map<number, number> = new Map();

  constructor() {
    // Initialize with some baseline percentiles for testing
    this.amountPercentiles.set(95, 100000);
    this.amountPercentiles.set(99, 500000);
  }

  addUser(user: UserAccount): void {
    this.users.set(user.userId, user);
  }

  setAmountPercentile(percentile: number, amount: number): void {
    this.amountPercentiles.set(percentile, amount);
  }

  async processTransaction(transaction: TransactionMetrics): Promise<void> {
    this.transactionHistory.push(transaction);
    
    // Update user transaction history
    const user = this.users.get(transaction.userId);
    if (user) {
      user.transactionHistory.push(transaction);
    }

    // Check for suspicious activity
    await this.checkSuspiciousActivity(transaction);
  }

  private async checkSuspiciousActivity(transaction: TransactionMetrics): Promise<void> {
    const suspiciousActivities: SuspiciousActivity[] = [];

    // Check for rapid transactions (more than 10 in 1 minute)
    const recentTransactions = this.getUserRecentTransactions(transaction.userId, 60);
    if (recentTransactions.length > 10) {
      suspiciousActivities.push({
        userId: transaction.userId,
        activityType: 'rapid_transactions',
        severity: 'high',
        description: `User performed ${recentTransactions.length} transactions in 1 minute`,
        timestamp: new Date(),
        metadata: { transactionCount: recentTransactions.length, timeWindow: 60 }
      });
    }

    // Check for unusually large amounts (> 95th percentile)
    const percentile95 = this.amountPercentiles.get(95) || 100000;
    if (transaction.amount > percentile95) {
      suspiciousActivities.push({
        userId: transaction.userId,
        activityType: 'large_amounts',
        severity: 'medium',
        description: `Transaction amount ${transaction.amount} exceeds 95th percentile (${percentile95})`,
        timestamp: new Date(),
        metadata: { amount: transaction.amount, percentile95 }
      });
    }

    // Check for unusual patterns (transactions outside normal hours)
    const hour = transaction.timestamp.getHours();
    const user = this.users.get(transaction.userId);
    if (user && user.normalHours.length > 0 && !user.normalHours.includes(hour)) {
      if (hour < 6 || hour > 22) { // Only flag if truly unusual hours
        suspiciousActivities.push({
          userId: transaction.userId,
          activityType: 'unusual_patterns',
          severity: 'low',
          description: `Transaction at unusual hour: ${hour}`,
          timestamp: new Date(),
          metadata: { hour, normalHours: user.normalHours }
        });
      }
    }

    // Check for repeated failed attempts
    if (transaction.status === 'failed') {
      const failedCount = this.getUserFailedTransactions(transaction.userId, 300); // 5 minutes
      if (failedCount >= 5) {
        suspiciousActivities.push({
          userId: transaction.userId,
          activityType: 'failed_attempts',
          severity: 'critical',
          description: `${failedCount} failed transaction attempts in 5 minutes`,
          timestamp: new Date(),
          metadata: { failedCount, timeWindow: 300 }
        });
      }
    }

    // Store suspicious activities and take action
    for (const activity of suspiciousActivities) {
      await this.recordSuspiciousActivity(activity);
    }
  }

  private getUserRecentTransactions(userId: string, seconds: number): TransactionMetrics[] {
    const since = new Date(Date.now() - seconds * 1000);
    return this.transactionHistory.filter(t => 
      t.userId === userId && t.timestamp >= since
    );
  }

  private getUserFailedTransactions(userId: string, seconds: number): number {
    const since = new Date(Date.now() - seconds * 1000);
    return this.transactionHistory.filter(t => 
      t.userId === userId && 
      t.status === 'failed' && 
      t.timestamp >= since
    ).length;
  }

  private async recordSuspiciousActivity(activity: SuspiciousActivity): Promise<void> {
    this.suspiciousActivities.push(activity);

    // Requirement 6.3: Flag transactions for review and suspend accounts when necessary
    if (activity.severity === 'high' || activity.severity === 'critical') {
      await this.suspendUserAccount(activity.userId, activity);
    }
  }

  private async suspendUserAccount(userId: string, activity: SuspiciousActivity): Promise<void> {
    const user = this.users.get(userId);
    if (user && user.status === 'active') {
      user.status = 'suspended';
      user.suspensionReason = `Suspicious activity detected: ${activity.description}`;
      user.suspendedAt = new Date();
    }
  }

  // Public methods for testing
  getSuspiciousActivities(): SuspiciousActivity[] {
    return [...this.suspiciousActivities];
  }

  getUserStatus(userId: string): 'active' | 'suspended' | 'under_review' | 'not_found' {
    const user = this.users.get(userId);
    return user ? user.status : 'not_found';
  }

  getSuspiciousActivitiesForUser(userId: string): SuspiciousActivity[] {
    return this.suspiciousActivities.filter(a => a.userId === userId);
  }

  clearHistory(): void {
    this.suspiciousActivities = [];
    this.transactionHistory = [];
    this.users.clear();
  }
}

// Property-based test generators
const userIdArb = fc.string({ minLength: 5, maxLength: 20 });
const transactionTypeArb = fc.constantFrom('tokenization', 'lending', 'staking', 'liquidation');
const transactionStatusArb = fc.constantFrom('pending', 'completed', 'failed');
const amountArb = fc.integer({ min: 100, max: 1000000 });
const timestampArb = fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') });

const transactionArb = fc.record({
  transactionId: fc.string({ minLength: 10, maxLength: 30 }),
  userId: userIdArb,
  type: transactionTypeArb,
  amount: amountArb,
  timestamp: timestampArb,
  status: transactionStatusArb,
  gasUsed: fc.option(fc.integer({ min: 21000, max: 500000 })),
  processingTime: fc.option(fc.integer({ min: 100, max: 5000 })),
  riskScore: fc.option(fc.float({ min: 0, max: 1 }))
}) as fc.Arbitrary<TransactionMetrics>;

const userAccountArb = fc.record({
  userId: userIdArb,
  status: fc.constantFrom('active', 'suspended', 'under_review'),
  normalHours: fc.array(fc.integer({ min: 0, max: 23 }), { minLength: 3, maxLength: 12 }),
  transactionHistory: fc.constant([])
}) as fc.Arbitrary<Omit<UserAccount, 'transactionHistory'> & { transactionHistory: TransactionMetrics[] }>;

describe('Suspicious Activity Detection Property Tests', () => {
  let detector: SuspiciousActivityDetector;

  beforeEach(() => {
    detector = new SuspiciousActivityDetector();
  });

  /**
   * Property 25: Suspicious activity response
   * For any detected suspicious activity, appropriate flags should be set 
   * and affected accounts should be suspended when necessary
   */
  test('Property 25: Rapid transaction detection and response', async () => {
    await fc.assert(fc.asyncProperty(
      userIdArb,
      fc.integer({ min: 5, max: 20 }),
      async (userId, transactionCount) => {
        // Create fresh detector for each test run
        const testDetector = new SuspiciousActivityDetector();
        
        // Add user account
        testDetector.addUser({
          userId,
          status: 'active',
          normalHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          transactionHistory: []
        });

        // Generate rapid transactions within 1 minute
        const baseTime = new Date();
        const transactions: TransactionMetrics[] = [];
        
        for (let i = 0; i < transactionCount; i++) {
          transactions.push({
            transactionId: `tx_${i}_${Date.now()}`,
            userId,
            type: 'lending',
            amount: 1000,
            timestamp: new Date(baseTime.getTime() + i * 100), // 100ms apart instead of 1 second
            status: 'completed'
          });
        }

        // Process all transactions
        await Promise.all(transactions.map(tx => testDetector.processTransaction(tx)));
        
        const suspiciousActivities = testDetector.getSuspiciousActivitiesForUser(userId);
        const userStatus = testDetector.getUserStatus(userId);

        if (transactionCount > 10) {
          // Should detect rapid transactions
          const rapidTransactionActivity = suspiciousActivities.find(
            a => a.activityType === 'rapid_transactions'
          );
          expect(rapidTransactionActivity).toBeDefined();
          expect(rapidTransactionActivity?.severity).toBe('high');
          expect(rapidTransactionActivity?.metadata.transactionCount).toBeGreaterThan(10);
          
          // Should suspend account for high severity
          expect(userStatus).toBe('suspended');
        } else {
          // Should not detect rapid transactions
          const rapidTransactionActivity = suspiciousActivities.find(
            a => a.activityType === 'rapid_transactions'
          );
          expect(rapidTransactionActivity).toBeUndefined();
          
          // Should not suspend account
          expect(userStatus).toBe('active');
        }
      }
    ), { numRuns: 100 });
  });

  test('Property 25: Large amount detection and response', async () => {
    await fc.assert(fc.asyncProperty(
      userIdArb,
      fc.integer({ min: 1000, max: 2000000 }),
      async (userId, transactionAmount) => {
        // Create fresh detector for each test run
        const testDetector = new SuspiciousActivityDetector();
        testDetector.setAmountPercentile(95, 100000);
        
        // Add user account
        testDetector.addUser({
          userId,
          status: 'active',
          normalHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          transactionHistory: []
        });

        const transaction: TransactionMetrics = {
          transactionId: `tx_${Date.now()}`,
          userId,
          type: 'lending',
          amount: transactionAmount,
          timestamp: new Date(),
          status: 'completed'
        };

        await testDetector.processTransaction(transaction);
        
        const suspiciousActivities = testDetector.getSuspiciousActivitiesForUser(userId);
        const userStatus = testDetector.getUserStatus(userId);

        if (transactionAmount > 100000) {
          // Should detect large amount
          const largeAmountActivity = suspiciousActivities.find(
            a => a.activityType === 'large_amounts'
          );
          expect(largeAmountActivity).toBeDefined();
          expect(largeAmountActivity?.severity).toBe('medium');
          expect(largeAmountActivity?.metadata.amount).toBe(transactionAmount);
          
          // Medium severity should not suspend account
          expect(userStatus).toBe('active');
        } else {
          // Should not detect large amount
          const largeAmountActivity = suspiciousActivities.find(
            a => a.activityType === 'large_amounts'
          );
          expect(largeAmountActivity).toBeUndefined();
          
          // Should not suspend account
          expect(userStatus).toBe('active');
        }
      }
    ), { numRuns: 100 });
  });

  test('Property 25: Failed attempts detection and critical response', async () => {
    await fc.assert(fc.asyncProperty(
      userIdArb,
      fc.integer({ min: 1, max: 10 }),
      async (userId, failedAttempts) => {
        // Create fresh detector for each test run
        const testDetector = new SuspiciousActivityDetector();
        
        // Add user account
        testDetector.addUser({
          userId,
          status: 'active',
          normalHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          transactionHistory: []
        });

        // Generate failed transactions within 5 minutes
        const baseTime = new Date();
        const transactions: TransactionMetrics[] = [];
        
        for (let i = 0; i < failedAttempts; i++) {
          transactions.push({
            transactionId: `tx_failed_${i}_${Date.now()}`,
            userId,
            type: 'lending',
            amount: 1000,
            timestamp: new Date(baseTime.getTime() + i * 10000), // 10 seconds apart
            status: 'failed'
          });
        }

        // Process all failed transactions
        await Promise.all(transactions.map(tx => testDetector.processTransaction(tx)));
        
        const suspiciousActivities = testDetector.getSuspiciousActivitiesForUser(userId);
        const userStatus = testDetector.getUserStatus(userId);

        if (failedAttempts >= 5) {
          // Should detect failed attempts
          const failedAttemptsActivity = suspiciousActivities.find(
            a => a.activityType === 'failed_attempts'
          );
          expect(failedAttemptsActivity).toBeDefined();
          expect(failedAttemptsActivity?.severity).toBe('critical');
          expect(failedAttemptsActivity?.metadata.failedCount).toBeGreaterThanOrEqual(5);
          
          // Critical severity should suspend account
          expect(userStatus).toBe('suspended');
        } else {
          // Should not detect failed attempts as suspicious
          const failedAttemptsActivity = suspiciousActivities.find(
            a => a.activityType === 'failed_attempts'
          );
          expect(failedAttemptsActivity).toBeUndefined();
          
          // Should not suspend account
          expect(userStatus).toBe('active');
        }
      }
    ), { numRuns: 100 });
  });

  test('Property 25: Unusual patterns detection for off-hours transactions', async () => {
    await fc.assert(fc.asyncProperty(
      userIdArb,
      fc.integer({ min: 0, max: 23 }),
      async (userId, transactionHour) => {
        // Create fresh detector for each test run
        const testDetector = new SuspiciousActivityDetector();
        
        // Add user with normal business hours
        const normalHours = [9, 10, 11, 12, 13, 14, 15, 16, 17];
        testDetector.addUser({
          userId,
          status: 'active',
          normalHours,
          transactionHistory: []
        });

        // Create transaction at specific hour
        const transactionTime = new Date();
        transactionTime.setHours(transactionHour, 0, 0, 0);
        
        const transaction: TransactionMetrics = {
          transactionId: `tx_${Date.now()}`,
          userId,
          type: 'lending',
          amount: 1000,
          timestamp: transactionTime,
          status: 'completed'
        };

        await testDetector.processTransaction(transaction);
        
        const suspiciousActivities = testDetector.getSuspiciousActivitiesForUser(userId);
        const userStatus = testDetector.getUserStatus(userId);

        const isUnusualHour = !normalHours.includes(transactionHour) && 
                             (transactionHour < 6 || transactionHour > 22);

        if (isUnusualHour) {
          // Should detect unusual patterns
          const unusualPatternActivity = suspiciousActivities.find(
            a => a.activityType === 'unusual_patterns'
          );
          expect(unusualPatternActivity).toBeDefined();
          expect(unusualPatternActivity?.severity).toBe('low');
          expect(unusualPatternActivity?.metadata.hour).toBe(transactionHour);
          
          // Low severity should not suspend account
          expect(userStatus).toBe('active');
        } else {
          // Should not detect unusual patterns
          const unusualPatternActivity = suspiciousActivities.find(
            a => a.activityType === 'unusual_patterns'
          );
          expect(unusualPatternActivity).toBeUndefined();
          
          // Should not suspend account
          expect(userStatus).toBe('active');
        }
      }
    ), { numRuns: 100 });
  });

  test('Property 25: Multiple suspicious activities compound response', async () => {
    await fc.assert(fc.asyncProperty(
      userIdArb,
      fc.integer({ min: 11, max: 20 }), // Ensure rapid transactions
      fc.integer({ min: 150000, max: 500000 }), // Ensure large amount
      async (userId, rapidCount, largeAmount) => {
        // Create fresh detector for each test run
        const testDetector = new SuspiciousActivityDetector();
        testDetector.setAmountPercentile(95, 100000);
        
        // Add user account
        testDetector.addUser({
          userId,
          status: 'active',
          normalHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          transactionHistory: []
        });

        // Generate rapid transactions with one large amount
        const baseTime = new Date();
        const transactions: TransactionMetrics[] = [];
        
        for (let i = 0; i < rapidCount; i++) {
          transactions.push({
            transactionId: `tx_${i}_${Date.now()}`,
            userId,
            type: 'lending',
            amount: i === 0 ? largeAmount : 1000, // First transaction is large
            timestamp: new Date(baseTime.getTime() + i * 100), // 100ms apart
            status: 'completed'
          });
        }

        await Promise.all(transactions.map(tx => testDetector.processTransaction(tx)));
        
        const suspiciousActivities = testDetector.getSuspiciousActivitiesForUser(userId);
        const userStatus = testDetector.getUserStatus(userId);

        // Should detect both rapid transactions and large amounts
        const rapidActivity = suspiciousActivities.find(
          a => a.activityType === 'rapid_transactions'
        );
        const largeAmountActivity = suspiciousActivities.find(
          a => a.activityType === 'large_amounts'
        );

        expect(rapidActivity).toBeDefined();
        expect(rapidActivity?.severity).toBe('high');
        expect(largeAmountActivity).toBeDefined();
        expect(largeAmountActivity?.severity).toBe('medium');

        // Should have at least 2 suspicious activities
        expect(suspiciousActivities.length).toBeGreaterThanOrEqual(2);

        // Should suspend account due to high severity rapid transactions
        expect(userStatus).toBe('suspended');
      }
    ), { numRuns: 100 });
  });

  test('Property 25: Suspicious activity metadata completeness', async () => {
    await fc.assert(fc.asyncProperty(
      transactionArb,
      async (transaction) => {
        // Create fresh detector for each test run
        const testDetector = new SuspiciousActivityDetector();
        testDetector.setAmountPercentile(95, 50000); // Lower threshold for testing
        
        // Add user account
        testDetector.addUser({
          userId: transaction.userId,
          status: 'active',
          normalHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          transactionHistory: []
        });

        await testDetector.processTransaction(transaction);
        
        const suspiciousActivities = testDetector.getSuspiciousActivitiesForUser(transaction.userId);

        // For any detected suspicious activity, metadata should be complete
        suspiciousActivities.forEach(activity => {
          expect(activity.userId).toBe(transaction.userId);
          expect(activity.activityType).toMatch(/^(rapid_transactions|large_amounts|unusual_patterns|failed_attempts)$/);
          expect(activity.severity).toMatch(/^(low|medium|high|critical)$/);
          expect(activity.description).toBeTruthy();
          expect(activity.timestamp).toBeInstanceOf(Date);
          expect(activity.metadata).toBeDefined();
          expect(typeof activity.metadata).toBe('object');

          // Verify activity-specific metadata
          switch (activity.activityType) {
            case 'rapid_transactions':
              expect(activity.metadata.transactionCount).toBeGreaterThan(10);
              expect(activity.metadata.timeWindow).toBe(60);
              break;
            case 'large_amounts':
              expect(activity.metadata.amount).toBe(transaction.amount);
              expect(activity.metadata.percentile95).toBeDefined();
              break;
            case 'unusual_patterns':
              expect(activity.metadata.hour).toBeGreaterThanOrEqual(0);
              expect(activity.metadata.hour).toBeLessThanOrEqual(23);
              expect(Array.isArray(activity.metadata.normalHours)).toBe(true);
              break;
            case 'failed_attempts':
              expect(activity.metadata.failedCount).toBeGreaterThanOrEqual(5);
              expect(activity.metadata.timeWindow).toBe(300);
              break;
          }
        });
      }
    ), { numRuns: 100 });
  });
});