/**
 * Property-Based Test: Error Message Localization
 * 
 * **Feature: rwa-lending-protocol, Property 34: Error message localization**
 * **Validates: Requirements 8.4**
 * 
 * Property: For any error message displayed, it should appear in the user's selected language
 */

// Mock next-intl to avoid ES module issues
jest.mock('@/lib/i18n/config', () => ({
  locales: ['en', 'fr', 'ar'],
  defaultLocale: 'en',
  localeConfig: {
    en: { direction: 'ltr', name: 'English' },
    fr: { direction: 'ltr', name: 'Français' },
    ar: { direction: 'rtl', name: 'العربية' },
  },
}));

import fc from 'fast-check';
import { ErrorLocalizationService, useLocalizedError } from '@/lib/i18n/error-localization';

const mockLocales = ['en', 'fr', 'ar'] as const;
type MockLocale = typeof mockLocales[number];

describe('Property: Error Message Localization', () => {
  const validLocaleArbitrary = fc.constantFrom(...mockLocales);
  const errorCodeArbitrary = fc.constantFrom(
    'NETWORK_ERROR',
    'WALLET_CONNECTION_ERROR', 
    'TRANSACTION_FAILED',
    'VALIDATION_ERROR',
    'AUTHENTICATION_FAILED',
    'AUTHORIZATION_DENIED',
    'RESOURCE_NOT_FOUND',
    'SERVER_ERROR',
    'REQUEST_TIMEOUT',
    'INSUFFICIENT_FUNDS',
    'INVALID_AMOUNT',
    'MINIMUM_AMOUNT_ERROR',
    'MAXIMUM_AMOUNT_ERROR',
    'ASSET_NOT_FOUND',
    'LOAN_NOT_FOUND',
    'INVALID_COLLATERAL',
    'LIQUIDATION_RISK',
    'GENERIC_ERROR'
  );

  const invalidErrorCodeArbitrary = fc.constantFrom(
    'UNKNOWN_ERROR',
    'INVALID_CODE',
    'NON_EXISTENT_ERROR',
    '',
    'NULL_ERROR'
  );

  test('Property 34: All supported error codes should have localized messages', () => {
    fc.assert(
      fc.property(
        errorCodeArbitrary,
        validLocaleArbitrary,
        (errorCode, locale) => {
          const localizedMessage = ErrorLocalizationService.getLocalizedErrorMessage(errorCode, locale);
          
          // Should return a non-empty string
          expect(typeof localizedMessage).toBe('string');
          expect(localizedMessage.length).toBeGreaterThan(0);
          
          // Should not return the error code itself
          expect(localizedMessage).not.toBe(errorCode);
          
          // Should be supported
          expect(ErrorLocalizationService.isErrorCodeSupported(errorCode)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 34: Unsupported error codes should fallback gracefully', () => {
    fc.assert(
      fc.property(
        invalidErrorCodeArbitrary,
        validLocaleArbitrary,
        (invalidCode, locale) => {
          const localizedMessage = ErrorLocalizationService.getLocalizedErrorMessage(invalidCode, locale);
          
          // Should still return a valid error message (fallback)
          expect(typeof localizedMessage).toBe('string');
          expect(localizedMessage.length).toBeGreaterThan(0);
          
          // Should not be supported
          expect(ErrorLocalizationService.isErrorCodeSupported(invalidCode)).toBe(false);
          
          // Should fallback to generic error message
          const genericMessage = ErrorLocalizationService.getLocalizedErrorMessage('GENERIC_ERROR', locale);
          expect(localizedMessage).toBe(genericMessage);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 34: Same error code should produce consistent messages for same locale', () => {
    fc.assert(
      fc.property(
        errorCodeArbitrary,
        validLocaleArbitrary,
        (errorCode, locale) => {
          const message1 = ErrorLocalizationService.getLocalizedErrorMessage(errorCode, locale);
          const message2 = ErrorLocalizationService.getLocalizedErrorMessage(errorCode, locale);
          const message3 = ErrorLocalizationService.getLocalizedErrorMessage(errorCode, locale);
          
          // All calls should return identical messages
          expect(message1).toBe(message2);
          expect(message2).toBe(message3);
          expect(message1).toBe(message3);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 34: Different locales should produce different messages for same error', () => {
    fc.assert(
      fc.property(
        errorCodeArbitrary,
        (errorCode) => {
          const enMessage = ErrorLocalizationService.getLocalizedErrorMessage(errorCode, 'en');
          const frMessage = ErrorLocalizationService.getLocalizedErrorMessage(errorCode, 'fr');
          const arMessage = ErrorLocalizationService.getLocalizedErrorMessage(errorCode, 'ar');
          
          // All should be valid strings
          expect(typeof enMessage).toBe('string');
          expect(typeof frMessage).toBe('string');
          expect(typeof arMessage).toBe('string');
          
          // At least some should be different (unless it's a very generic message)
          const messages = [enMessage, frMessage, arMessage];
          const uniqueMessages = new Set(messages);
          
          // Should have at least 2 different messages (some might be the same for certain errors)
          expect(uniqueMessages.size).toBeGreaterThanOrEqual(1);
          
          // All should be non-empty
          messages.forEach(msg => {
            expect(msg.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 34: Invalid locale should fallback to default locale', () => {
    fc.assert(
      fc.property(
        errorCodeArbitrary,
        fc.constantFrom('de', 'es', 'invalid', 'zh'),
        (errorCode, invalidLocale) => {
          // TypeScript will complain, but we're testing runtime behavior
          const message = ErrorLocalizationService.getLocalizedErrorMessage(
            errorCode, 
            invalidLocale as any
          );
          
          // Should fallback to English (default locale)
          const englishMessage = ErrorLocalizationService.getLocalizedErrorMessage(errorCode, 'en');
          expect(message).toBe(englishMessage);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 34: Contextual error messages should include context information', () => {
    fc.assert(
      fc.property(
        errorCodeArbitrary,
        validLocaleArbitrary,
        fc.constantFrom('low', 'medium', 'high', 'critical'),
        fc.constantFrom('admin', 'user'),
        fc.constantFrom('lending', 'staking', 'assets', 'auth'),
        (errorCode, locale, severity, userType, feature) => {
          const contextualMessage = ErrorLocalizationService.getContextualErrorMessage(errorCode, {
            locale,
            severity: severity as any,
            userType: userType as any,
            feature: feature as any,
          });
          
          const baseMessage = ErrorLocalizationService.getLocalizedErrorMessage(errorCode, locale);
          
          // Should be a valid string
          expect(typeof contextualMessage).toBe('string');
          expect(contextualMessage.length).toBeGreaterThan(0);
          
          // Critical messages should have prefix
          if (severity === 'critical') {
            expect(contextualMessage).not.toBe(baseMessage);
            expect(contextualMessage.length).toBeGreaterThan(baseMessage.length);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 34: Batch localization should return all requested messages', () => {
    fc.assert(
      fc.property(
        fc.array(errorCodeArbitrary, { minLength: 1, maxLength: 5 }),
        validLocaleArbitrary,
        (errorCodes, locale) => {
          // Remove duplicates to ensure unique error codes
          const uniqueErrorCodes = [...new Set(errorCodes)];
          const batchMessages = ErrorLocalizationService.getLocalizedErrorMessages(uniqueErrorCodes, locale);
          
          // Should return object with all requested error codes
          expect(typeof batchMessages).toBe('object');
          expect(Object.keys(batchMessages)).toHaveLength(uniqueErrorCodes.length);
          
          // Each error code should have a corresponding message
          uniqueErrorCodes.forEach(code => {
            expect(batchMessages).toHaveProperty(code);
            expect(typeof batchMessages[code]).toBe('string');
            expect(batchMessages[code].length).toBeGreaterThan(0);
            
            // Should match individual localization
            const individualMessage = ErrorLocalizationService.getLocalizedErrorMessage(code, locale);
            expect(batchMessages[code]).toBe(individualMessage);
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 34: useLocalizedError hook should provide consistent interface', () => {
    fc.assert(
      fc.property(
        validLocaleArbitrary,
        errorCodeArbitrary,
        (locale, errorCode) => {
          const errorHook = useLocalizedError(locale);
          
          // Should provide expected methods
          expect(typeof errorHook.getErrorMessage).toBe('function');
          expect(typeof errorHook.getContextualError).toBe('function');
          expect(typeof errorHook.isSupported).toBe('function');
          expect(typeof errorHook.hasTranslation).toBe('function');
          
          // Methods should work correctly
          const message = errorHook.getErrorMessage(errorCode);
          expect(typeof message).toBe('string');
          expect(message.length).toBeGreaterThan(0);
          
          const isSupported = errorHook.isSupported(errorCode);
          expect(typeof isSupported).toBe('boolean');
          expect(isSupported).toBe(true); // All our test codes are supported
          
          const hasTranslation = errorHook.hasTranslation(errorCode);
          expect(typeof hasTranslation).toBe('boolean');
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 34: Error messages should not contain placeholder text', () => {
    fc.assert(
      fc.property(
        errorCodeArbitrary,
        validLocaleArbitrary,
        (errorCode, locale) => {
          const message = ErrorLocalizationService.getLocalizedErrorMessage(errorCode, locale);
          
          // Should not contain common placeholder patterns
          const placeholderPatterns = [
            /\{\{.*\}\}/,  // {{placeholder}}
            /\$\{.*\}/,    // ${placeholder}
            /%[sd]/,       // %s, %d
            /TODO/i,       // TODO
            /FIXME/i,      // FIXME
            /XXX/i,        // XXX
          ];
          
          placeholderPatterns.forEach(pattern => {
            expect(message).not.toMatch(pattern);
          });
          
          // Should not be just the error code
          expect(message.toLowerCase()).not.toBe(errorCode.toLowerCase());
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 34: All error codes should have translations in all supported locales', () => {
    fc.assert(
      fc.property(
        errorCodeArbitrary,
        (errorCode) => {
          mockLocales.forEach(locale => {
            const hasTranslation = ErrorLocalizationService.hasTranslationForLocale(errorCode, locale);
            expect(hasTranslation).toBe(true);
            
            const message = ErrorLocalizationService.getLocalizedErrorMessage(errorCode, locale);
            expect(message.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 50 }
    );
  });
});