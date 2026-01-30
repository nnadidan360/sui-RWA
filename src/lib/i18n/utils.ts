import { useTranslations, useFormatter } from 'next-intl';
import { localeConfig, type Locale } from './config';

// ICU message format utilities
export function useICUTranslations() {
  const t = useTranslations();
  const format = useFormatter();

  // Format currency with locale-specific settings
  const formatCurrency = (
    amount: number,
    currency?: string,
    locale?: Locale
  ) => {
    return format.number(amount, {
      style: 'currency',
      currency: currency || (locale === 'fr' ? 'EUR' : 'USD'),
    });
  };

  // Format number with locale-specific settings
  const formatNumber = (
    number: number,
    options?: Intl.NumberFormatOptions
  ) => {
    return format.number(number, options);
  };

  // Format date with locale-specific settings
  const formatDate = (
    date: Date | string | number,
    formatOptions?: any
  ) => {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    return format.dateTime(dateObj, formatOptions);
  };

  // Format relative time (e.g., "2 hours ago")
  const formatRelativeTime = (date: Date | string | number) => {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    return format.relativeTime(dateObj);
  };

  // ICU pluralization helper
  const formatPlural = (
    count: number,
    key: string,
    options?: Record<string, any>
  ) => {
    return t(key, { count, ...options });
  };

  // Format percentage
  const formatPercentage = (value: number, decimals: number = 2) => {
    return format.number(value / 100, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return {
    t,
    format,
    formatCurrency,
    formatNumber,
    formatDate,
    formatRelativeTime,
    formatPlural,
    formatPercentage,
  };
}

// Utility to get locale-specific configuration
export function getLocaleConfiguration(locale: Locale) {
  return localeConfig[locale];
}

// Utility to check if a locale is RTL
export function isRTLLocale(locale: Locale): boolean {
  return localeConfig[locale].direction === 'rtl';
}

// Utility to get supported locales
export function getSupportedLocales() {
  return Object.keys(localeConfig) as Locale[];
}

// Utility to validate locale
export function isValidLocale(locale: string): locale is Locale {
  return locale in localeConfig;
}

// Utility to get fallback locale
export function getFallbackLocale(): Locale {
  return 'en';
}

// Utility to format financial amounts with proper locale formatting
export function formatFinancialAmount(
  amount: number,
  locale: Locale,
  currency?: string,
  options?: Intl.NumberFormatOptions
) {
  const config = localeConfig[locale];
  const targetCurrency = currency || config.currencyFormat.currency;
  
  return new Intl.NumberFormat(locale, {
    ...config.currencyFormat,
    currency: targetCurrency,
    ...options,
  }).format(amount);
}

// Utility to format dates with locale-specific patterns
export function formatLocalizedDate(
  date: Date | string | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
) {
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date;
  
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(dateObj);
}

// Utility to get text direction for a locale
export function getTextDirection(locale: Locale): 'ltr' | 'rtl' {
  return localeConfig[locale].direction;
}

// Utility to create ICU message with pluralization
export function createPluralMessage(
  count: number,
  messages: {
    zero?: string;
    one: string;
    other: string;
  }
): string {
  if (count === 0 && messages.zero) {
    return messages.zero;
  }
  
  return count === 1 ? messages.one : messages.other;
}

// Utility to handle missing translations gracefully
export function safeTranslate(
  key: string,
  fallback: string,
  translator: (key: string) => string
): string {
  try {
    const translation = translator(key);
    return translation === key ? fallback : translation;
  } catch {
    return fallback;
  }
}