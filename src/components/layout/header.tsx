'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Menu } from 'lucide-react';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';
// Wallet connection removed for Sui account abstraction
import { clsx } from 'clsx';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const t = useTranslations('dashboard');
  const assetsT = useTranslations('assets');
  const lendingT = useTranslations('lending');
  const stakingT = useTranslations('staking');
  const commonT = useTranslations('common');

  return (
    <header className="bg-white dark:bg-gray-900/50 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
      <div className="px-6">
        <div className="flex justify-between items-center h-16">
          {/* Mobile menu button and title */}
          <div className={clsx("flex items-center space-x-4", isRTL && "space-x-reverse")}>
            <button
              type="button"
              className="lg:hidden p-2 rounded-md text-gray-500 dark:text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={onMenuClick}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex-shrink-0">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Astake
              </h1>
            </div>
          </div>

          {/* Navigation Links - Hidden on mobile */}
          <nav className={clsx("hidden md:flex items-center space-x-8", isRTL && "space-x-reverse")}>
            <a
              href={`/${locale === 'en' ? '' : locale}`}
              className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {t('title')}
            </a>
            <a
              href={`/${locale === 'en' ? '' : locale + '/'}assets`}
              className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {assetsT('title')}
            </a>
            <a
              href={`/${locale === 'en' ? '' : locale + '/'}lending`}
              className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {lendingT('title')}
            </a>
            <a
              href={`/${locale === 'en' ? '' : locale + '/'}staking`}
              className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {stakingT('title')}
            </a>
          </nav>

          {/* Right side controls */}
          <div className={clsx("flex items-center space-x-4", isRTL && "space-x-reverse")}>
            {/* Theme Switcher */}
            <ThemeSwitcher />
            
            {/* Language Switcher */}
            <LanguageSwitcher />
          </div>
        </div>
      </div> 
    </header>
  );
}