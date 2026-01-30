'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Sidebar } from './sidebar';
import { Header } from './header';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const locale = useLocale();
  const isRTL = locale === 'ar';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white">
      {/* Sidebar - Fixed on left for LTR, right for RTL */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main content area */}
      <div className={isRTL ? "lg:pr-72" : "lg:pl-72"}>
        {/* Header - Fixed at top */}
        <Header onMenuClick={() => setSidebarOpen(true)} />
        
        {/* Page content */}
        <main className="min-h-screen bg-gray-50 dark:bg-gradient-to-br dark:from-black dark:via-gray-900 dark:to-black">
          <div className="px-6 py-8">
            {children}
          </div>
        </main>
      </div>
     
    </div>
  );
}