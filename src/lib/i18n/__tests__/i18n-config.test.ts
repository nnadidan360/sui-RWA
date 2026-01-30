// Mock next-intl to avoid ES module issues
jest.mock('@/lib/i18n/config', () => ({
  locales: ['en', 'fr', 'ar'],
  defaultLocale: 'en',
  localeConfig: {
    en: { direction: 'ltr', name: 'English' },
    fr: { direction: 'ltr', name: 'Français' },
    ar: { direction: 'rtl', name: 'العربية' },
  },
}));

import { 
  getLocaleConfiguration, 
  isRTLLocale, 
  getSupportedLocales, 
  isValidLocale, 
  getFallbackLocale,
  formatFinancialAmount,
  formatLocalizedDate,
  getTextDirection
} from '../utils';
import { locales, defaultLocale, localeConfig } from '../config';

describe('I18n Configuration', () => {
  test('should have correct locale configuration', () => {
    expect(locales).toEqual(['en', 'fr', 'ar']);
    expect(defaultLocale).toBe('en');
    expect(Object.keys(localeConfig)).toEqual(['en', 'fr', 'ar']);
  });

  test('should identify RTL locales correctly', () => {
    expect(isRTLLocale('ar')).toBe(true);
    expect(isRTLLocale('en')).toBe(false);
    expect(isRTLLocale('fr')).toBe(false);
  });

  test('should validate locales correctly', () => {
    expect(isValidLocale('en')).toBe(true);
    expect(isValidLocale('fr')).toBe(true);
    expect(isValidLocale('ar')).toBe(true);
    expect(isValidLocale('de')).toBe(false);
    expect(isValidLocale('invalid')).toBe(false);
  });

  test('should return correct fallback locale', () => {
    expect(getFallbackLocale()).toBe('en');
  });

  test('should get supported locales', () => {
    const supportedLocales = getSupportedLocales();
    expect(supportedLocales).toContain('en');
    expect(supportedLocales).toContain('fr');
    expect(supportedLocales).toContain('ar');
  });

  test('should get locale configuration', () => {
    const enConfig = getLocaleConfiguration('en');
    expect(enConfig.direction).toBe('ltr');
    expect(enConfig.name).toBe('English');
    
    const arConfig = getLocaleConfiguration('ar');
    expect(arConfig.direction).toBe('rtl');
    expect(arConfig.name).toBe('العربية');
  });

  test('should get text direction', () => {
    expect(getTextDirection('en')).toBe('ltr');
    expect(getTextDirection('fr')).toBe('ltr');
    expect(getTextDirection('ar')).toBe('rtl');
  });

  test('should format financial amounts correctly', () => {
    const amount = 1234.56;
    
    const enFormatted = formatFinancialAmount(amount, 'en');
    expect(enFormatted).toMatch(/\$1,234\.56/);
    
    const frFormatted = formatFinancialAmount(amount, 'fr');
    expect(frFormatted).toMatch(/1\s?234,56\s?€/);
  });

  test('should format dates correctly', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    
    const enFormatted = formatLocalizedDate(date, 'en');
    expect(enFormatted).toMatch(/Jan 15, 2024/);
    
    const frFormatted = formatLocalizedDate(date, 'fr');
    expect(frFormatted).toMatch(/15 janv\. 2024/);
  });
});