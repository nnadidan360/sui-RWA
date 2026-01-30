import { createNavigation } from 'next-intl/navigation';

export const locales = ['en', 'fr', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeConfig = {
  en: {
    code: 'en',
    name: 'English',
    direction: 'ltr' as const,
    dateFormat: 'MM/dd/yyyy',
    numberFormat: {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    } as Intl.NumberFormatOptions,
    currencyFormat: {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    } as Intl.NumberFormatOptions,
  },
  fr: {
    code: 'fr',
    name: 'Français',
    direction: 'ltr' as const,
    dateFormat: 'dd/MM/yyyy',
    numberFormat: {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    } as Intl.NumberFormatOptions,
    currencyFormat: {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    } as Intl.NumberFormatOptions,
  },
  ar: {
    code: 'ar',
    name: 'العربية',
    direction: 'rtl' as const,
    dateFormat: 'dd/MM/yyyy',
    numberFormat: {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    } as Intl.NumberFormatOptions,
    currencyFormat: {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    } as Intl.NumberFormatOptions,
  },
} as const;

export const { Link, redirect, usePathname, useRouter } = createNavigation({ locales });

export interface TranslationNamespace {
  common: any;
  dashboard: any;
  lending: any;
  staking: any;
  admin: any;
  errors: any;
  assets: any;
}

export const namespaces = ['common', 'dashboard', 'lending', 'staking', 'admin', 'errors', 'assets'] as const;
export type Namespace = (typeof namespaces)[number];