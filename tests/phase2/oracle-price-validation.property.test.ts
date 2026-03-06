// PHASE 2: Property-Based Tests for Oracle Price Validation
// **Feature: credit-os, Property 20: Oracle Price Validation**
// **Validates: Requirements 16.2, 16.5**

import fc from 'fast-check';

// Calculate median from array of numbers
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  
  return sorted[mid];
}

// Validate price against oracle data
function validatePrice(proposedValue: number, oracleValue: number, maxDeviation: number = 0.10): boolean {
  if (oracleValue === 0) return false;
  
  const deviation = Math.abs(proposedValue - oracleValue) / oracleValue;
  return deviation <= maxDeviation;
}

// Aggregate prices from multiple sources
function aggregatePrices(prices: number[]): { price: number; confidence: number; sources: number } {
  if (prices.length === 0) {
    return { price: 0, confidence: 0, sources: 0 };
  }

  const median = calculateMedian(prices);
  
  // Confidence increases with more sources
  let confidence = 0.5;
  if (prices.length >= 2) confidence = 0.7;
  if (prices.length >= 3) confidence = 0.9;
  if (prices.length >= 5) confidence = 0.95;

  return {
    price: median,
    confidence,
    sources: prices.length
  };
}

// Detect outliers in price data
function detectOutliers(prices: number[], threshold: number = 0.20): number[] {
  if (prices.length < 3) return [];

  const median = calculateMedian(prices);
  const outliers: number[] = [];

  for (const price of prices) {
    const deviation = Math.abs(price - median) / median;
    if (deviation > threshold) {
      outliers.push(price);
    }
  }

  return outliers;
}

// Calculate price variance
function calculateVariance(prices: number[]): number {
  if (prices.length === 0) return 0;

  const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / prices.length;

  return variance;
}

describe('Oracle Price Validation Properties', () => {
  /**
   * Property 20: Oracle Price Validation
   * Multi-source oracle aggregation should produce consistent, validated prices
   * with appropriate confidence scores and outlier detection.
   */

  describe('Property 20.1: Median calculation is correct', () => {
    it('should calculate median correctly for any array of prices', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1000, max: 1000000 }), { minLength: 1, maxLength: 20 }),
          async (prices) => {
            const median = calculateMedian(prices);

            // Median should be within the range of values
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            expect(median).toBeGreaterThanOrEqual(min);
            expect(median).toBeLessThanOrEqual(max);

            // For single value, median equals that value
            if (prices.length === 1) {
              expect(median).toBe(prices[0]);
            }

            // Median should be a number
            expect(typeof median).toBe('number');
            expect(isNaN(median)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 20.2: Median is stable under permutation', () => {
    it('should produce same median regardless of input order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1000, max: 100000 }), { minLength: 3, maxLength: 10 }),
          async (prices) => {
            const median1 = calculateMedian(prices);
            
            // Shuffle the array
            const shuffled = [...prices].sort(() => Math.random() - 0.5);
            const median2 = calculateMedian(shuffled);

            // Reverse the array
            const reversed = [...prices].reverse();
            const median3 = calculateMedian(reversed);

            // All medians should be equal
            expect(median1).toBe(median2);
            expect(median1).toBe(median3);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 20.3: Price validation detects deviations', () => {
    it('should correctly validate prices within acceptable deviation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10000, max: 1000000 }), // oracleValue
          fc.float({ min: Math.fround(0.8), max: Math.fround(1.2) }), // multiplier
          async (oracleValue, multiplier) => {
            const proposedValue = Math.floor(oracleValue * multiplier);
            const isValid = validatePrice(proposedValue, oracleValue, 0.10);

            const actualDeviation = Math.abs(proposedValue - oracleValue) / oracleValue;

            // If deviation <= 10%, should be valid
            if (actualDeviation <= 0.10) {
              expect(isValid).toBe(true);
            }

            // If deviation > 10%, should be invalid
            if (actualDeviation > 0.10) {
              expect(isValid).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 20.4: Confidence increases with more sources', () => {
    it('should assign higher confidence with more price sources', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }), // number of sources
          fc.integer({ min: 10000, max: 100000 }), // base price
          async (sourceCount, basePrice) => {
            // Generate prices with small variations
            const prices = Array.from({ length: sourceCount }, (_, i) => 
              basePrice + (i * 100)
            );

            const result = aggregatePrices(prices);

            // More sources should mean higher confidence
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.confidence).toBeLessThanOrEqual(1);

            if (sourceCount === 1) {
              expect(result.confidence).toBeLessThan(0.7);
            }

            if (sourceCount >= 3) {
              expect(result.confidence).toBeGreaterThanOrEqual(0.7);
            }

            if (sourceCount >= 5) {
              expect(result.confidence).toBeGreaterThanOrEqual(0.9);
            }

            // Sources count should match
            expect(result.sources).toBe(sourceCount);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 20.5: Outlier detection identifies extreme values', () => {
    it('should detect prices that deviate significantly from median', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 50000, max: 100000 }), // base price
          fc.integer({ min: 3, max: 8 }), // number of normal prices
          async (basePrice, normalCount) => {
            // Create normal prices clustered around base
            const normalPrices = Array.from({ length: normalCount }, () => 
              basePrice + (Math.random() * 2000 - 1000)
            );

            // Add an outlier (50% higher)
            const outlierPrice = basePrice * 1.5;
            const allPrices = [...normalPrices, outlierPrice];

            const outliers = detectOutliers(allPrices, 0.20);

            // Should detect at least one outlier
            expect(outliers.length).toBeGreaterThan(0);

            // The extreme outlier should be detected
            expect(outliers).toContain(outlierPrice);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 20.6: Empty price array handled gracefully', () => {
    it('should handle empty price arrays without errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const emptyPrices: number[] = [];

            const median = calculateMedian(emptyPrices);
            expect(median).toBe(0);

            const aggregated = aggregatePrices(emptyPrices);
            expect(aggregated.price).toBe(0);
            expect(aggregated.confidence).toBe(0);
            expect(aggregated.sources).toBe(0);

            const outliers = detectOutliers(emptyPrices);
            expect(outliers).toEqual([]);

            const variance = calculateVariance(emptyPrices);
            expect(variance).toBe(0);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 20.7: Price aggregation is deterministic', () => {
    it('should produce consistent results for same inputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 10000, max: 100000 }), { minLength: 2, maxLength: 10 }),
          async (prices) => {
            const result1 = aggregatePrices(prices);
            const result2 = aggregatePrices(prices);

            expect(result1.price).toBe(result2.price);
            expect(result1.confidence).toBe(result2.confidence);
            expect(result1.sources).toBe(result2.sources);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 20.8: Validation is symmetric', () => {
    it('should validate equally whether proposed is higher or lower', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 50000, max: 500000 }), // oracle value
          fc.float({ min: Math.fround(0.01), max: Math.fround(0.09) }), // deviation within threshold
          async (oracleValue, deviation) => {
            // Skip if deviation is NaN or invalid
            if (isNaN(deviation) || !isFinite(deviation)) return;

            const higherValue = Math.floor(oracleValue * (1 + deviation));
            const lowerValue = Math.floor(oracleValue * (1 - deviation));

            const higherValid = validatePrice(higherValue, oracleValue, 0.10);
            const lowerValid = validatePrice(lowerValue, oracleValue, 0.10);

            // Both should be valid (within 10% threshold)
            expect(higherValid).toBe(true);
            expect(lowerValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 20.9: Variance reflects price consistency', () => {
    it('should calculate higher variance for inconsistent prices', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 50000, max: 100000 }), // base price
          async (basePrice) => {
            // Consistent prices (low variance)
            const consistentPrices = [basePrice, basePrice + 100, basePrice + 200];
            const consistentVariance = calculateVariance(consistentPrices);

            // Inconsistent prices (high variance)
            const inconsistentPrices = [basePrice, basePrice * 0.5, basePrice * 1.5];
            const inconsistentVariance = calculateVariance(inconsistentPrices);

            // Inconsistent should have higher variance
            expect(inconsistentVariance).toBeGreaterThan(consistentVariance);

            // Variance should be non-negative
            expect(consistentVariance).toBeGreaterThanOrEqual(0);
            expect(inconsistentVariance).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 20.10: Zero oracle value rejects validation', () => {
    it('should reject validation when oracle value is zero', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000000 }), // proposed value
          async (proposedValue) => {
            const isValid = validatePrice(proposedValue, 0);

            // Should always be invalid with zero oracle value
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 20.11: Aggregation preserves price range', () => {
    it('should produce aggregated price within input range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 10000, max: 100000 }), { minLength: 2, maxLength: 10 }),
          async (prices) => {
            const result = aggregatePrices(prices);

            const min = Math.min(...prices);
            const max = Math.max(...prices);

            // Aggregated price should be within range
            expect(result.price).toBeGreaterThanOrEqual(min);
            expect(result.price).toBeLessThanOrEqual(max);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 20.12: Outlier detection threshold is configurable', () => {
    it('should detect more outliers with stricter threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 40000, max: 60000 }), { minLength: 5, maxLength: 10 }),
          async (prices) => {
            // Add some variation
            const variedPrices = prices.map((p, i) => p + (i * 1000));

            const lenientOutliers = detectOutliers(variedPrices, 0.30);
            const strictOutliers = detectOutliers(variedPrices, 0.10);

            // Stricter threshold should detect same or more outliers
            expect(strictOutliers.length).toBeGreaterThanOrEqual(lenientOutliers.length);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
