'use client';

import { ReactNode } from 'react';

interface LocaleLayoutProps {
  children: ReactNode;
}

export function LocaleLayout({ children }: LocaleLayoutProps) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}