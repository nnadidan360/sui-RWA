'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { locales, defaultLocale, type Locale, localeConfig } from '@/lib/i18n/config';

const LOCALE_STORAGE_KEY = 'preferred-locale';

export function useLocale() {
  const router = useRouter();
  const pathname = usePathname();
  const [currentLocale, setCurrentLocale] = useState<Locale>(defaultLocale);
  const [isLoading, setIsLoading] = useState(true);

  // Detect browser language
  const detectBrowserLanguage = (): Locale => {
    if (typeof window === 'undefined') return defaultLocale;
    
    const browserLang = navigator.language.split('-')[0] as Locale;
    return locales.includes(browserLang) ? browserLang : defaultLocale;
  };

  // Get stored language preference
  const getStoredLocale = (): Locale | null => {
    if (typeof window === 'undefined') return null;
    
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale;
    return stored && locales.includes(stored) ? stored : null;
  };

  // Store language preference
  const storeLocale = (locale: Locale) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  };

  // Extract locale from pathname
  const getLocaleFromPath = (): Locale => {
    const segments = pathname.split('/');
    const pathLocale = segments[1] as Locale;
    return locales.includes(pathLocale) ? pathLocale : defaultLocale;
  };

  // Initialize locale
  useEffect(() => {
    const pathLocale = getLocaleFromPath();
    const storedLocale = getStoredLocale();
    const browserLocale = detectBrowserLanguage();

    // Priority: URL > Stored > Browser > Default
    const initialLocale = pathLocale !== defaultLocale 
      ? pathLocale 
      : storedLocale || browserLocale;

    setCurrentLocale(initialLocale);
    
    // If no locale in URL and we have a preference, redirect
    if (pathLocale === defaultLocale && initialLocale !== defaultLocale) {
      const newPath = `/${initialLocale}${pathname}`;
      router.replace(newPath);
    }
    
    setIsLoading(false);
  }, [pathname, router]);

  // Change locale
  const changeLocale = (newLocale: Locale) => {
    if (!locales.includes(newLocale)) return;

    setCurrentLocale(newLocale);
    storeLocale(newLocale);

    // Update URL
    const currentPathLocale = getLocaleFromPath();
    let newPath = pathname;

    if (currentPathLocale !== defaultLocale) {
      // Replace existing locale in path
      newPath = pathname.replace(`/${currentPathLocale}`, `/${newLocale}`);
    } else {
      // Add locale to path
      newPath = `/${newLocale}${pathname}`;
    }

    // Remove default locale from path if it's the new locale
    if (newLocale === defaultLocale) {
      newPath = newPath.replace(`/${defaultLocale}`, '') || '/';
    }

    router.push(newPath);
  };

  // Get locale configuration
  const getLocaleConfig = (locale?: Locale) => {
    return localeConfig[locale || currentLocale];
  };

  // Format number according to locale
  const formatNumber = (
    number: number, 
    options?: Intl.NumberFormatOptions,
    locale?: Locale
  ) => {
    const targetLocale = locale || currentLocale;
    const config = getLocaleConfig(targetLocale);
    
    return new Intl.NumberFormat(targetLocale, {
      ...config.numberFormat,
      ...options,
    }).format(number);
  };

  // Format currency according to locale
  const formatCurrency = (
    amount: number,
    options?: Intl.NumberFormatOptions,
    locale?: Locale
  ) => {
    const targetLocale = locale || currentLocale;
    const config = getLocaleConfig(targetLocale);
    
    return new Intl.NumberFormat(targetLocale, {
      ...config.currencyFormat,
      ...options,
    }).format(amount);
  };

  // Format date according to locale
  const formatDate = (
    date: Date | string | number,
    options?: Intl.DateTimeFormatOptions,
    locale?: Locale
  ) => {
    const targetLocale = locale || currentLocale;
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    return new Intl.DateTimeFormat(targetLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    }).format(dateObj);
  };

  return {
    currentLocale,
    locales,
    defaultLocale,
    isLoading,
    changeLocale,
    getLocaleConfig,
    formatNumber,
    formatCurrency,
    formatDate,
    isRTL: getLocaleConfig().direction === 'rtl',
  };
}