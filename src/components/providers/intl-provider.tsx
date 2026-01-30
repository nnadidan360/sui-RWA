'use client';

import { NextIntlClientProvider } from 'next-intl';
import { ReactNode } from 'react';

interface IntlProviderProps {
  children: ReactNode;
  locale: string;
  messages: any;
  timeZone?: string;
  now?: Date;
}

export function IntlProvider({ 
  children, 
  locale, 
  messages, 
  timeZone = 'UTC',
  now = new Date()
}: IntlProviderProps) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={timeZone}
      now={now}
      formats={{
        dateTime: {
          short: {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          },
          long: {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
          },
        },
        number: {
          precise: {
            maximumFractionDigits: 10,
          },
          currency: {
            style: 'currency',
            currency: locale === 'fr' ? 'EUR' : 'USD',
          },
        },
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}