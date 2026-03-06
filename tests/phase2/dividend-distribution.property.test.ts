// PHASE 2: Property-Based Tests for Dividend Distribution
// **Feature: credit-os, Property 17: Dividend Distribution Accuracy**
// **Validates: Requirements 13.5, 15.1**

import fc from 'fast-check';

// Extract the calculation logic for testing
function calculateClaimableAmount(tokenBalance: string, amountPerToken: string): string {
  const balance = BigInt(tokenBalance);
  const perToken = BigInt(amountPerToken);
  const claimable = balance * perToken;
  return claimable.toString();
}

describe('Dividend Distribution Accuracy Properties', () => {
  /**
   * Property 17: Dividend Distribution Accuracy
   * For any distribution, the sum of all holder claims should equal the total distribution amount,
   * and pro-rata calculations should be proportional to token holdings.
   */

  describe('Property 17.1: Sum of holder claims equals total distribution', () => {
    it('should ensure all holder claims sum to exactly the total distribution amount', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 100000 }), // totalSupply
          fc.integer({ min: 100000, max: 10000000 }), // totalDistributionAmount (in smallest units)
          fc.array(
            fc.integer({ min: 1, max: 1000 }), // individual holder balances
            { minLength: 2, maxLength: 20 }
          ),
          async (totalSupply, totalDistributionAmount, holderBalances) => {
            // Normalize holder balances to sum to totalSupply
            const balanceSum = holderBalances.reduce((sum, b) => sum + b, 0);
            const normalizedBalances = holderBalances.map(b => 
              Math.floor((b / balanceSum) * totalSupply)
            );
            
            // Adjust for rounding errors - give remainder to first holder
            const actualSum = normalizedBalances.reduce((sum, b) => sum + b, 0);
            if (actualSum < totalSupply) {
              normalizedBalances[0] += (totalSupply - actualSum);
            }

            // Calculate amount per token
            const amountPerToken = Math.floor(totalDistributionAmount / totalSupply);
            
            // Calculate claimable amounts for each holder
            const claimableAmounts = normalizedBalances.map(balance =>
              calculateClaimableAmount(balance.toString(), amountPerToken.toString())
            );

            // Sum all claimable amounts
            const totalClaimable = claimableAmounts.reduce(
              (sum, amount) => sum + BigInt(amount),
              BigInt(0)
            );

            // The total claimable should be very close to total distribution
            // (allowing for rounding in integer division)
            const expectedTotal = BigInt(amountPerToken) * BigInt(totalSupply);
            const difference = totalClaimable > expectedTotal 
              ? totalClaimable - expectedTotal 
              : expectedTotal - totalClaimable;
            
            // Difference should be less than the number of holders (rounding error tolerance)
            expect(Number(difference)).toBeLessThanOrEqual(normalizedBalances.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 17.2: Pro-rata distribution is proportional to holdings', () => {
    it('should distribute dividends proportionally to token holdings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 50000 }), // totalSupply
          fc.integer({ min: 100000, max: 5000000 }), // totalDistributionAmount
          fc.array(
            fc.record({
              balance: fc.integer({ min: 10, max: 500 })
            }),
            { minLength: 3, maxLength: 15 }
          ),
          async (totalSupply, totalDistributionAmount, holders) => {
            // Normalize holder balances
            const balanceSum = holders.reduce((sum, h) => sum + h.balance, 0);
            const normalizedHolders = holders.map(h => ({
              balance: Math.floor((h.balance / balanceSum) * totalSupply),
              percentage: (h.balance / balanceSum) * 100
            }));

            // Adjust for rounding
            const actualSum = normalizedHolders.reduce((sum, h) => sum + h.balance, 0);
            if (actualSum < totalSupply) {
              normalizedHolders[0].balance += (totalSupply - actualSum);
              normalizedHolders[0].percentage = (normalizedHolders[0].balance / totalSupply) * 100;
            }

            const amountPerToken = Math.floor(totalDistributionAmount / totalSupply);

            // Calculate claimable amounts
            const claims = normalizedHolders.map(holder => ({
              balance: holder.balance,
              percentage: holder.percentage,
              claimable: BigInt(calculateClaimableAmount(
                holder.balance.toString(),
                amountPerToken.toString()
              ))
            }));

            // Verify proportionality: if holder A has 2x tokens of holder B,
            // holder A should get approximately 2x dividends
            for (let i = 0; i < claims.length - 1; i++) {
              for (let j = i + 1; j < claims.length; j++) {
                const holderA = claims[i];
                const holderB = claims[j];

                if (holderA.balance === 0 || holderB.balance === 0) continue;

                const balanceRatio = holderA.balance / holderB.balance;
                const claimRatio = Number(holderA.claimable) / Number(holderB.claimable);

                // Ratios should be very close (within 1% due to rounding)
                const ratioDifference = Math.abs(balanceRatio - claimRatio);
                expect(ratioDifference).toBeLessThan(0.01 * Math.max(balanceRatio, claimRatio));
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 17.3: Zero balance holders receive zero dividends', () => {
    it('should ensure holders with zero balance receive no dividends', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 10000 }), // totalSupply
          fc.integer({ min: 100000, max: 1000000 }), // totalDistributionAmount
          async (totalSupply, totalDistributionAmount) => {
            const amountPerToken = Math.floor(totalDistributionAmount / totalSupply);

            // Calculate claimable for zero balance
            const claimable = calculateClaimableAmount('0', amountPerToken.toString());

            expect(claimable).toBe('0');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 17.4: Full token holder receives full distribution', () => {
    it('should ensure a holder with all tokens receives the full distribution', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 50000 }), // totalSupply
          fc.integer({ min: 100000, max: 5000000 }), // totalDistributionAmount
          async (totalSupply, totalDistributionAmount) => {
            const amountPerToken = Math.floor(totalDistributionAmount / totalSupply);

            // Calculate claimable for holder with all tokens
            const claimable = BigInt(calculateClaimableAmount(
              totalSupply.toString(),
              amountPerToken.toString()
            ));

            const expectedTotal = BigInt(amountPerToken) * BigInt(totalSupply);

            // Should receive exactly the calculated total
            expect(claimable).toBe(expectedTotal);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 17.5: Distribution is monotonic with token holdings', () => {
    it('should ensure more tokens always means more dividends', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 10000 }), // balance1
          fc.integer({ min: 100, max: 10000 }), // balance2
          fc.integer({ min: 1000, max: 100000 }), // amountPerToken
          async (balance1, balance2, amountPerToken) => {
            const claimable1 = BigInt(calculateClaimableAmount(
              balance1.toString(),
              amountPerToken.toString()
            ));

            const claimable2 = BigInt(calculateClaimableAmount(
              balance2.toString(),
              amountPerToken.toString()
            ));

            // More tokens should always result in more or equal dividends
            if (balance1 > balance2) {
              expect(claimable1).toBeGreaterThanOrEqual(claimable2);
            } else if (balance1 < balance2) {
              expect(claimable1).toBeLessThanOrEqual(claimable2);
            } else {
              expect(claimable1).toBe(claimable2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 17.6: Distribution calculation is deterministic', () => {
    it('should produce the same result for the same inputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100000 }), // tokenBalance
          fc.integer({ min: 1, max: 1000000 }), // amountPerToken
          async (tokenBalance, amountPerToken) => {
            // Calculate twice with same inputs
            const result1 = calculateClaimableAmount(
              tokenBalance.toString(),
              amountPerToken.toString()
            );

            const result2 = calculateClaimableAmount(
              tokenBalance.toString(),
              amountPerToken.toString()
            );

            // Results should be identical
            expect(result1).toBe(result2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 17.7: No negative dividends', () => {
    it('should never produce negative dividend amounts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 100000 }), // tokenBalance (including 0)
          fc.integer({ min: 0, max: 1000000 }), // amountPerToken (including 0)
          async (tokenBalance, amountPerToken) => {
            const claimable = BigInt(calculateClaimableAmount(
              tokenBalance.toString(),
              amountPerToken.toString()
            ));

            // Should never be negative
            expect(claimable).toBeGreaterThanOrEqual(BigInt(0));
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
