/**
 * Admin-specific locale-aware formatting utilities
 */

import { useLocale, useTranslations } from 'next-intl';
import { localeConfig } from './config';

export function useAdminFormatting() {
  const locale = useLocale();
  const t = useTranslations('admin.formatting');
  const config = localeConfig[locale as keyof typeof localeConfig];

  const formatCurrency = (amount: number): string => {
    try {
      return new Intl.NumberFormat(locale, config.currencyFormat).format(amount);
    } catch (error) {
      // Fallback to template-based formatting
      return t('currency', { amount: amount.toFixed(2) });
    }
  };

  const formatNumber = (value: number): string => {
    try {
      return new Intl.NumberFormat(locale, config.numberFormat).format(value);
    } catch (error) {
      // Fallback to template-based formatting
      return t('number', { value: value.toString() });
    }
  };

  const formatPercentage = (value: number): string => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      }).format(value / 100);
    } catch (error) {
      // Fallback to template-based formatting
      return t('percentage', { value: value.toFixed(1) });
    }
  };

  const formatDate = (date: Date): string => {
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
    } catch (error) {
      // Fallback to template-based formatting
      return t('date', { date: date.toLocaleDateString() });
    }
  };

  const formatTime = (date: Date): string => {
    try {
      return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(date);
    } catch (error) {
      // Fallback to template-based formatting
      return t('time', { time: date.toLocaleTimeString() });
    }
  };

  const formatDateTime = (date: Date): string => {
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (error) {
      // Fallback to template-based formatting
      return t('datetime', { 
        date: date.toLocaleDateString(), 
        time: date.toLocaleTimeString() 
      });
    }
  };

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return formatDate(date);
  };

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  return {
    formatCurrency,
    formatNumber,
    formatPercentage,
    formatDate,
    formatTime,
    formatDateTime,
    formatRelativeTime,
    formatFileSize,
    locale,
    isRTL: config.direction === 'rtl',
  };
}

/**
 * Utility function to get pluralization for different locales
 */
export function getPlural(count: number, locale: string): string {
  if (locale === 'ar') {
    // Arabic pluralization rules
    if (count === 0) return '';
    if (count === 1) return '';
    if (count === 2) return 'ان';
    if (count >= 3 && count <= 10) return 'ات';
    return 'ة';
  } else if (locale === 'fr') {
    // French pluralization rules
    return count > 1 ? 's' : '';
  } else {
    // English pluralization rules
    return count !== 1 ? 's' : '';
  }
}

/**
 * Format admin-specific metrics with proper localization
 */
export function formatAdminMetric(
  value: number, 
  type: 'currency' | 'percentage' | 'number' | 'users' | 'assets',
  locale: string
): string {
  const config = localeConfig[locale as keyof typeof localeConfig];
  
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat(locale, config.currencyFormat).format(value);
    case 'percentage':
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value / 100);
    case 'number':
    case 'users':
    case 'assets':
      return new Intl.NumberFormat(locale, config.numberFormat).format(value);
    default:
      return value.toString();
  }
}