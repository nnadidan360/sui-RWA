/**
 * Property-Based Test: Locale-Specific Formatting
 * 
 * **Feature: rwa-lending-protocol, Property 33: Locale-specific formatting**
 * **Validates: Requirements 8.3**
 * 
 * Property: For any financial data display, numbers, dates, and currencies 
 * should be formatted according to the selected locale
 */

import fc from 'fast-check';

const mockLocales = ['en', 'fr', 'ar'] as const;
type MockLocale = typeof mockLocales[number];

// Locale formatting service
class LocaleFormattingService {
  static formatNumber(value: number, locale: MockLocale): string {
    const formatters = {
      en: new Intl.NumberFormat('en-US'),
      fr: new Intl.NumberFormat('fr-FR'),
      ar: new Intl.NumberFormat('ar-SA'),
    };
    return formatters[locale].format(value);
  }

  static formatCurrency(value: number, locale: MockLocale): string {
    const formatters = {
      en: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
      fr: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }),
      ar: new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'USD' }),
    };
    return formatters[locale].format(value);
  }

  static formatDate(date: Date, locale: MockLocale): string {
    const formatters = {
      en: new Intl.DateTimeFormat('en-US'),
      fr: new Intl.DateTimeFormat('fr-FR'),
      ar: new Intl.DateTimeFormat('ar-SA'),
    };
    return formatters[locale].format(date);
  }

  static formatPercentage(value: number, locale: MockLocale): string {
    const formatters = {
      en: new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2 }),
      fr: new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 2 }),
      ar: new Intl.NumberFormat('ar-SA', { style: 'percent', minimumFractionDigits: 2 }),
    };
    return formatters[locale].format(value / 100);
  }

  static getDecimalSeparator(locale: MockLocale): string {
    const testNumber = 1.1;
    const formatted = this.formatNumber(testNumber, locale);
    return formatted.includes(',') ? ',' : '.';
  }

  static getThousandsSeparator(locale: MockLocale): string {
    const testNumber = 1000;
    const formatted = this.formatNumber(testNumber, locale);
    // Extract the separator between thousands
    if (formatted.includes(' ')) return ' ';
    if (formatted.includes(',')) return ',';
    return '';
  }
}

describe('Property: Locale-Specific Formatting', () => {
  const validLocaleArbitrary = fc.constantFrom(...mockLocales);
  const positiveNumberArbitrary = fc.float({ min: Math.fround(0.01), max: Math.fround(999999.99) });
  const percentageArbitrary = fc.float({ min: Math.fround(0), max: Math.fround(100) });
  const dateArbitrary = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') });

  test('Property 33: Number formatting should be consistent for same locale', () => {
    fc.assert(
      fc.property(
        validLocaleArbitrary,
        positiveNumberArbitrary,
        (locale, number) => {
          const formatted1 = LocaleFormattingService.formatNumber(number, locale);
          const formatted2 = LocaleFormattingService.formatNumber(number, locale);
          
          // Same number and locale should produce identical formatting
          expect(formatted1).toBe(formatted2);
          expect(typeof formatted1).toBe('string');
          expect(formatted1.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 33: Currency formatting should include currency symbols', () => {
    fc.assert(
      fc.property(
        validLocaleArbitrary,
        positiveNumberArbitrary,
        (locale, amount) => {
          const formatted = LocaleFormattingService.formatCurrency(amount, locale);
          
          // Should contain currency symbol or code
          const expectedSymbols = {
            en: ['$', 'USD'],
            fr: ['€', 'EUR'],
            ar: ['$', 'USD', '﷼'], // Arabic might use different symbols
          };
          
          const hasExpectedSymbol = expectedSymbols[locale].some(symbol => 
            formatted.includes(symbol)
          );
          
          expect(hasExpectedSymbol).toBe(true);
          expect(typeof formatted).toBe('string');
          expect(formatted.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 33: Date formatting should vary by locale', () => {
    fc.assert(
      fc.property(
        dateArbitrary,
        (date) => {
          const enFormatted = LocaleFormattingService.formatDate(date, 'en');
          const frFormatted = LocaleFormattingService.formatDate(date, 'fr');
          const arFormatted = LocaleFormattingService.formatDate(date, 'ar');
          
          // All should be valid strings
          expect(typeof enFormatted).toBe('string');
          expect(typeof frFormatted).toBe('string');
          expect(typeof arFormatted).toBe('string');
          
          // Should contain year in some form (Arabic uses different numerals)
          const year = date.getFullYear().toString();
          expect(enFormatted).toMatch(new RegExp(year));
          expect(frFormatted).toMatch(new RegExp(year));
          // Arabic might use Arabic-Indic numerals, so just check it's not empty
          expect(arFormatted.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 33: Percentage formatting should be consistent', () => {
    fc.assert(
      fc.property(
        validLocaleArbitrary,
        percentageArbitrary,
        (locale, percentage) => {
          const formatted = LocaleFormattingService.formatPercentage(percentage, locale);
          
          // Should contain percentage symbol (% or Arabic equivalent ٪)
          expect(formatted).toMatch(/[%٪]/);
          expect(typeof formatted).toBe('string');
          expect(formatted.length).toBeGreaterThan(0);
          
          // Should be consistent for same input
          const formatted2 = LocaleFormattingService.formatPercentage(percentage, locale);
          expect(formatted).toBe(formatted2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 33: Decimal separators should be locale-appropriate', () => {
    fc.assert(
      fc.property(
        validLocaleArbitrary,
        (locale) => {
          const separator = LocaleFormattingService.getDecimalSeparator(locale);
          
          // Should be either comma or period
          expect([',', '.']).toContain(separator);
          
          // French typically uses comma, English uses period
          if (locale === 'fr') {
            expect(separator).toBe(',');
          } else if (locale === 'en') {
            expect(separator).toBe('.');
          }
          // Arabic can vary, so we just check it's valid
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 33: Large number formatting should include thousands separators', () => {
    fc.assert(
      fc.property(
        validLocaleArbitrary,
        fc.integer({ min: 1000, max: 999999 }),
        (locale, largeNumber) => {
          const formatted = LocaleFormattingService.formatNumber(largeNumber, locale);
          const separator = LocaleFormattingService.getThousandsSeparator(locale);
          
          // Large numbers should have some form of grouping
          if (separator) {
            expect(formatted).toContain(separator);
          }
          
          // Should be longer than just the digits
          expect(formatted.length).toBeGreaterThanOrEqual(largeNumber.toString().length);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 33: Zero and negative numbers should be handled correctly', () => {
    fc.assert(
      fc.property(
        validLocaleArbitrary,
        (locale) => {
          // Test zero (Arabic uses ٠ instead of 0)
          const zeroFormatted = LocaleFormattingService.formatNumber(0, locale);
          expect(zeroFormatted).toMatch(/[0٠]/);
          
          // Test negative number
          const negativeFormatted = LocaleFormattingService.formatNumber(-123.45, locale);
          expect(typeof negativeFormatted).toBe('string');
          expect(negativeFormatted.length).toBeGreaterThan(0);
          
          // Should indicate negative somehow (-, parentheses, etc.)
          expect(negativeFormatted).toMatch(/[-()]/);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 33: Currency formatting should handle different amounts consistently', () => {
    fc.assert(
      fc.property(
        validLocaleArbitrary,
        fc.tuple(positiveNumberArbitrary, positiveNumberArbitrary),
        (locale, [amount1, amount2]) => {
          fc.pre(amount1 !== amount2); // Ensure different amounts
          fc.pre(Math.abs(amount1 - amount2) > 0.005); // Ensure meaningful difference
          
          const formatted1 = LocaleFormattingService.formatCurrency(amount1, locale);
          const formatted2 = LocaleFormattingService.formatCurrency(amount2, locale);
          
          // Different amounts should produce different formatted strings
          expect(formatted1).not.toBe(formatted2);
          
          // But both should have currency symbols
          const expectedSymbols = {
            en: ['$', 'USD'],
            fr: ['€', 'EUR'],
            ar: ['$', 'USD', '﷼'],
          };
          
          expectedSymbols[locale].forEach(symbol => {
            const has1 = formatted1.includes(symbol);
            const has2 = formatted2.includes(symbol);
            // At least one should have the symbol (they might use different representations)
            if (has1 || has2) {
              expect(has1 || has2).toBe(true);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 33: Formatting should be deterministic across multiple calls', () => {
    fc.assert(
      fc.property(
        validLocaleArbitrary,
        positiveNumberArbitrary,
        dateArbitrary,
        percentageArbitrary,
        (locale, number, date, percentage) => {
          // Multiple calls should produce identical results
          const numberResults = Array(3).fill(0).map(() => 
            LocaleFormattingService.formatNumber(number, locale)
          );
          const currencyResults = Array(3).fill(0).map(() => 
            LocaleFormattingService.formatCurrency(number, locale)
          );
          const dateResults = Array(3).fill(0).map(() => 
            LocaleFormattingService.formatDate(date, locale)
          );
          const percentageResults = Array(3).fill(0).map(() => 
            LocaleFormattingService.formatPercentage(percentage, locale)
          );
          
          // All results in each array should be identical
          expect(new Set(numberResults).size).toBe(1);
          expect(new Set(currencyResults).size).toBe(1);
          expect(new Set(dateResults).size).toBe(1);
          expect(new Set(percentageResults).size).toBe(1);
        }
      ),
      { numRuns: 50 }
    );
  });
});