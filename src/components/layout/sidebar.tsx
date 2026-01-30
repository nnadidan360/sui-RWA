'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { 
  Home, 
  Coins, 
  CreditCard, 
  Shield, 
  X,
  FileText,
  BarChart3,
  Zap
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const t = useTranslations('dashboard');
  const stakingT = useTranslations('staking');
  const assetsT = useTranslations('assets');
  const lendingT = useTranslations('lending');
  const adminT = useTranslations('admin');
  const commonT = useTranslations('common');

  const navigation = [
    { name: t('title'), href: `/${locale === 'en' ? '' : locale}`, icon: Home },
    { name: stakingT('title'), href: `/${locale === 'en' ? '' : locale + '/'}staking`, icon: Zap },
    { name: assetsT('title'), href: `/${locale === 'en' ? '' : locale + '/'}assets`, icon: Coins },
    { name: lendingT('title'), href: `/${locale === 'en' ? '' : locale + '/'}lending`, icon: CreditCard },
    // { name: t('portfolio'), href: `/${locale === 'en' ? '' : locale + '/'}portfolio`, icon: BarChart3 },
    // { name: commonT('documentation'), href: `/${locale === 'en' ? '' : locale + '/'}docs`, icon: FileText },
  ];

  const adminNavigation = [
    { name: adminT('title'), href: `/${locale === 'en' ? '' : locale + '/'}admin`, icon: Shield },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/80 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={clsx(
        'fixed inset-y-0 z-50 w-72 bg-white dark:bg-black border-gray-200 dark:border-gray-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0',
        isRTL ? 'right-0 border-l' : 'left-0 border-r',
        isOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-20 items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
            <div className={clsx("flex items-center space-x-3", isRTL && "space-x-reverse")}>
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-gray-900 dark:text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Astake</h1>
                <p className="text-xs text-gray-500 dark:text-gray-600 dark:text-gray-400">Liquid Staking & Lending</p>
              </div>
            </div>
            <button
              type="button"
              className="lg:hidden p-2 rounded-md text-gray-500 dark:text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (item.href === `/${locale === 'en' ? '' : locale}` && pathname === '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={clsx(
                    'flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                    isRTL && 'flex-row-reverse',
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-600/20 text-blue-600 dark:text-gray-900 dark:text-white border border-blue-500/30'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  )}
                  onClick={() => onClose()}
                >
                  <item.icon className={clsx("h-5 w-5", isRTL ? "ml-3" : "mr-3")} />
                  {item.name}
                  {isActive && (
                    <div className={clsx("w-2 h-2 bg-blue-500 rounded-full", isRTL ? "mr-auto" : "ml-auto")}></div>
                  )}
                </Link>
              );
            })}

            {/* Divider */}
            <div className="my-6 border-t border-gray-200 dark:border-gray-800"></div>

            {/* Admin Section */}
            <div className="space-y-2">
              <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {adminT('title')}
              </p>
              {adminNavigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={clsx(
                      'flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                      isRTL && 'flex-row-reverse',
                      isActive
                        ? 'bg-gradient-to-r from-red-500/20 to-orange-600/20 text-red-600 dark:text-gray-900 dark:text-white border border-red-500/30'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50'
                    )}
                    onClick={() => onClose()}
                  >
                    <item.icon className={clsx("h-5 w-5", isRTL ? "ml-3" : "mr-3")} />
                    {item.name}
                    {isActive && (
                      <div className={clsx("w-2 h-2 bg-red-500 rounded-full", isRTL ? "mr-auto" : "ml-auto")}></div>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-600/10 border border-blue-500/20 rounded-xl p-4">
              <div className={clsx("flex items-center space-x-3", isRTL && "space-x-reverse")}>
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Security First</p>
                  <p className="text-xs text-gray-500 dark:text-gray-600 dark:text-gray-400">External wallet custody</p>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">Version 0.1.0</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}