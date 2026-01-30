import { getRequestConfig } from 'next-intl/server';

// Can be imported from a shared config
const locales = ['en', 'fr', 'ar'] as const;

export default getRequestConfig(async ({ locale }) => {
  // Use the locale from the URL or default to 'en'
  const currentLocale = locale || 'en';
  
  // Load messages dynamically
  let messages;
  try {
    messages = (await import(`./src/messages/${currentLocale}.json`)).default;
  } catch (error) {
    console.error(`Failed to load messages for locale: ${currentLocale}`, error);
    // Fallback to English messages
    messages = (await import(`./src/messages/en.json`)).default;
  }
  
  return {
    locale: currentLocale,
    messages,
    timeZone: 'UTC',
    now: new Date(),
    formats: {
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
          currency: currentLocale === 'fr' ? 'EUR' : 'USD',
        },
      },
    },
  };
});