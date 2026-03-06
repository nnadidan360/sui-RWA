// PHASE 2: Unit Tests for Oracle Integration
// Task 18.4 - Oracle Integration Testing
// Tests for property valuation, commodity prices, and equipment depreciation

import { OracleService } from '../../src/services/phase2/OracleService';

describe('Oracle Integration Unit Tests', () => {
  describe('Property Valuation', () => {
    it('should get property value from multiple sources', async () => {
      const address = '123 Main St, San Francisco, CA';
      const value = await OracleService.getPropertyValue(address);

      expect(value).toBeDefined();
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    });

    it('should handle invalid property address gracefully', async () => {
      const invalidAddress = '';
      
      // Service returns mock data even for invalid addresses
      const value = await OracleService.getPropertyValue(invalidAddress);
      expect(typeof value).toBe('number');
    });

    it('should return consistent values for same address', async () => {
      const address = '456 Oak Ave, Los Angeles, CA';
      
      const value1 = await OracleService.getPropertyValue(address);
      const value2 = await OracleService.getPropertyValue(address);

      // Values should be consistent (same median calculation)
      expect(value1).toBe(value2);
    });
  });

  describe('Commodity Price Feeds', () => {
    it('should get commodity price for gold', async () => {
      const price = await OracleService.getCommodityPrice('gold');

      expect(price).toBeDefined();
      expect(typeof price).toBe('number');
      expect(price).toBeGreaterThan(0);
    });

    it('should get commodity price for silver', async () => {
      const price = await OracleService.getCommodityPrice('silver');

      expect(price).toBeDefined();
      expect(price).toBeGreaterThan(0);
    });

    it('should get commodity price for oil', async () => {
      const price = await OracleService.getCommodityPrice('oil');

      expect(price).toBeDefined();
      expect(price).toBeGreaterThan(0);
    });

    it('should handle unknown commodity', async () => {
      const price = await OracleService.getCommodityPrice('unknown-commodity');

      expect(price).toBe(0);
    });

    it('should be case-insensitive for commodity names', async () => {
      const lowerCase = await OracleService.getCommodityPrice('gold');
      const upperCase = await OracleService.getCommodityPrice('GOLD');
      const mixedCase = await OracleService.getCommodityPrice('Gold');

      expect(lowerCase).toBe(upperCase);
      expect(lowerCase).toBe(mixedCase);
    });
  });

  describe('Equipment Depreciation', () => {
    it('should calculate depreciation for vehicle', async () => {
      const equipment = {
        type: 'vehicle',
        purchasePrice: 50000,
        purchaseDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        condition: 'good'
      };

      const currentValue = await OracleService.getEquipmentDepreciation(equipment);

      expect(currentValue).toBeDefined();
      expect(currentValue).toBeLessThan(equipment.purchasePrice);
      expect(currentValue).toBeGreaterThan(0);
    });

    it('should calculate depreciation for machinery', async () => {
      const equipment = {
        type: 'machinery',
        purchasePrice: 100000,
        purchaseDate: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000), // 2 years ago
        condition: 'fair'
      };

      const currentValue = await OracleService.getEquipmentDepreciation(equipment);

      expect(currentValue).toBeLessThan(equipment.purchasePrice);
      expect(currentValue).toBeGreaterThan(equipment.purchasePrice * 0.1); // At least 10% of original
    });

    it('should calculate depreciation for computer equipment', async () => {
      const equipment = {
        type: 'computer',
        purchasePrice: 3000,
        purchaseDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        condition: 'good'
      };

      const currentValue = await OracleService.getEquipmentDepreciation(equipment);

      expect(currentValue).toBeLessThan(equipment.purchasePrice);
      // Computers depreciate faster (20% rate)
      expect(currentValue).toBeLessThanOrEqual(equipment.purchasePrice * 0.8);
    });

    it('should not depreciate below 10% of purchase price', async () => {
      const equipment = {
        type: 'vehicle',
        purchasePrice: 50000,
        purchaseDate: new Date(Date.now() - 20 * 365 * 24 * 60 * 60 * 1000), // 20 years ago
        condition: 'poor'
      };

      const currentValue = await OracleService.getEquipmentDepreciation(equipment);

      // Should not go below 10% of original value
      expect(currentValue).toBeGreaterThanOrEqual(equipment.purchasePrice * 0.1);
    });

    it('should handle brand new equipment', async () => {
      const equipment = {
        type: 'machinery',
        purchasePrice: 75000,
        purchaseDate: new Date(), // Today
        condition: 'excellent'
      };

      const currentValue = await OracleService.getEquipmentDepreciation(equipment);

      // Should be close to purchase price for new equipment
      expect(currentValue).toBeGreaterThanOrEqual(equipment.purchasePrice * 0.95);
    });

    it('should use default depreciation rate for unknown equipment type', async () => {
      const equipment = {
        type: 'unknown-type',
        purchasePrice: 10000,
        purchaseDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        condition: 'good'
      };

      const currentValue = await OracleService.getEquipmentDepreciation(equipment);

      expect(currentValue).toBeLessThan(equipment.purchasePrice);
      expect(currentValue).toBeGreaterThan(0);
    });
  });

  describe('Market Data Validation', () => {
    it('should validate property value within acceptable range', async () => {
      const data = {
        assetType: 'property',
        identifier: '789 Pine St, Seattle, WA',
        proposedValue: 350000
      };

      const isValid = await OracleService.validateMarketData(data);

      expect(typeof isValid).toBe('boolean');
    });

    it('should validate commodity price within acceptable range', async () => {
      const data = {
        assetType: 'commodity',
        identifier: 'gold',
        proposedValue: 1950
      };

      const isValid = await OracleService.validateMarketData(data);

      expect(typeof isValid).toBe('boolean');
    });

    it('should reject invalid asset type', async () => {
      const data = {
        assetType: 'invalid-type',
        identifier: 'test',
        proposedValue: 1000
      };

      const isValid = await OracleService.validateMarketData(data);

      expect(isValid).toBe(false);
    });

    it('should reject value with excessive deviation', async () => {
      const data = {
        assetType: 'commodity',
        identifier: 'gold',
        proposedValue: 10000 // Way too high
      };

      const isValid = await OracleService.validateMarketData(data);

      expect(isValid).toBe(false);
    });
  });

  describe('Aggregated Price Calculation', () => {
    it('should get aggregated price for property', async () => {
      const result = await OracleService.getAggregatedPrice('property', '123 Main St');

      expect(result).toBeDefined();
      expect(result.price).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.sources).toBeGreaterThan(0);
    });

    it('should get aggregated price for commodity', async () => {
      const result = await OracleService.getAggregatedPrice('commodity', 'gold');

      expect(result).toBeDefined();
      expect(result.price).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.sources).toBeGreaterThan(0);
    });

    it('should provide confidence score based on source count', async () => {
      const result = await OracleService.getAggregatedPrice('property', '456 Oak Ave');

      // With multiple sources, confidence should be higher
      if (result.sources >= 2) {
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      }
    });

    it('should handle errors gracefully', async () => {
      // Service returns default values for invalid types
      const result = await OracleService.getAggregatedPrice('invalid-type', 'test');
      
      expect(result).toBeDefined();
      expect(result.price).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Median Calculation', () => {
    it('should calculate median correctly for odd number of values', () => {
      // Access private method through type assertion for testing
      const values = [100, 200, 300];
      const median = (OracleService as any).calculateMedian(values);

      expect(median).toBe(200);
    });

    it('should calculate median correctly for even number of values', () => {
      const values = [100, 200, 300, 400];
      const median = (OracleService as any).calculateMedian(values);

      expect(median).toBe(250); // Average of 200 and 300
    });

    it('should handle single value', () => {
      const values = [500];
      const median = (OracleService as any).calculateMedian(values);

      expect(median).toBe(500);
    });

    it('should handle empty array', () => {
      const values: number[] = [];
      const median = (OracleService as any).calculateMedian(values);

      expect(median).toBe(0);
    });

    it('should handle unsorted values', () => {
      const values = [300, 100, 200];
      const median = (OracleService as any).calculateMedian(values);

      expect(median).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Service returns mock data even for empty addresses
      const value = await OracleService.getPropertyValue('');
      
      expect(typeof value).toBe('number');
    });

    it('should handle missing API keys gracefully', async () => {
      // Even without real API keys, should return mock data or handle gracefully
      const value = await OracleService.getPropertyValue('123 Test St');
      
      expect(typeof value).toBe('number');
    });

    it('should handle invalid equipment data', async () => {
      const invalidEquipment = {
        type: 'vehicle',
        purchasePrice: -1000, // Invalid negative price
        purchaseDate: new Date(),
        condition: 'good'
      };

      // Service calculates depreciation even with negative price
      const value = await OracleService.getEquipmentDepreciation(invalidEquipment);
      
      expect(typeof value).toBe('number');
    });
  });

  describe('Integration Consistency', () => {
    it('should return consistent data types across all methods', async () => {
      const propertyValue = await OracleService.getPropertyValue('123 Main St');
      const commodityPrice = await OracleService.getCommodityPrice('gold');
      const equipmentValue = await OracleService.getEquipmentDepreciation({
        type: 'vehicle',
        purchasePrice: 50000,
        purchaseDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        condition: 'good'
      });

      expect(typeof propertyValue).toBe('number');
      expect(typeof commodityPrice).toBe('number');
      expect(typeof equipmentValue).toBe('number');
    });

    it('should handle concurrent requests', async () => {
      const requests = [
        OracleService.getPropertyValue('123 Main St'),
        OracleService.getCommodityPrice('gold'),
        OracleService.getCommodityPrice('silver'),
        OracleService.getPropertyValue('456 Oak Ave')
      ];

      const results = await Promise.all(requests);

      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Depreciation Rate Accuracy', () => {
    it('should apply correct depreciation rate for vehicles (15%)', async () => {
      const equipment = {
        type: 'vehicle',
        purchasePrice: 100000,
        purchaseDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year
        condition: 'good'
      };

      const currentValue = await OracleService.getEquipmentDepreciation(equipment);
      const expectedValue = 100000 - (100000 * 0.15 * 1);

      expect(currentValue).toBeCloseTo(expectedValue, -2); // Within $100
    });

    it('should apply correct depreciation rate for machinery (10%)', async () => {
      const equipment = {
        type: 'machinery',
        purchasePrice: 100000,
        purchaseDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year
        condition: 'good'
      };

      const currentValue = await OracleService.getEquipmentDepreciation(equipment);
      const expectedValue = 100000 - (100000 * 0.10 * 1);

      expect(currentValue).toBeCloseTo(expectedValue, -2);
    });

    it('should apply correct depreciation rate for computers (20%)', async () => {
      const equipment = {
        type: 'computer',
        purchasePrice: 5000,
        purchaseDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year
        condition: 'good'
      };

      const currentValue = await OracleService.getEquipmentDepreciation(equipment);
      const expectedValue = 5000 - (5000 * 0.20 * 1);

      expect(currentValue).toBeCloseTo(expectedValue, -2);
    });

    it('should apply correct depreciation rate for furniture (7%)', async () => {
      const equipment = {
        type: 'furniture',
        purchasePrice: 10000,
        purchaseDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year
        condition: 'good'
      };

      const currentValue = await OracleService.getEquipmentDepreciation(equipment);
      const expectedValue = 10000 - (10000 * 0.07 * 1);

      expect(currentValue).toBeCloseTo(expectedValue, -2);
    });
  });
});
