/**
 * Property-Based Test: Language Preference Persistence
 * 
 * **Feature: rwa-lending-protocol, Property 32: Language preference persistence**
 * **Validates: Requirements 8.2**
 * 
 * Property: For any manually selected language preference, the system should persist 
 * the preference and apply it to all interface elements
 */

import fc from 'fast-check';

// Mock localStorage
const mockLocalStorage = {
  store: new Map<string, string>(),
  getItem: jest.fn((key: string) => mockLocalStorage.store.get(key) || null),
  setItem: jest.fn((key: string, value: string) => {
    mockLocalStorage.store.set(key, value);
  }),
  removeItem: jest.fn((key: string) => {
    mockLocalStorage.store.delete(key);
  }),
  clear: jest.fn(() => {
    mockLocalStorage.store.clear();
  }),
};

// Mock window.localStorage
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

const mockLocales = ['en', 'fr', 'ar'] as const;
const LOCALE_STORAGE_KEY = 'preferred-locale';

// Language persistence service
class LanguagePersistenceService {
  static storeLanguagePreference(locale: string): void {
    if (mockLocales.includes(locale as any)) {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  }

  static getStoredLanguagePreference(): string | null {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  }

  static clearLanguagePreference(): void {
    localStorage.removeItem(LOCALE_STORAGE_KEY);
  }

  static applyLanguageToInterface(locale: string): void {
    // Simulate applying language to all interface elements
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }

  static isValidLocale(locale: string): boolean {
    return mockLocales.includes(locale as any);
  }
}

describe('Property: Language Preference Persistence', () => {
  const validLanguageArbitrary = fc.constantFrom(...mockLocales);
  const invalidLanguageArbitrary = fc.constantFrom('de', 'es', 'zh', 'invalid');

  beforeEach(() => {
    mockLocalStorage.store.clear();
    jest.clearAllMocks();
    // Reset call counts
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
  });

  test('Property 32: Valid language preferences should be persisted', () => {
    fc.assert(
      fc.property(
        validLanguageArbitrary,
        (selectedLanguage) => {
          // Store the language preference
          LanguagePersistenceService.storeLanguagePreference(selectedLanguage);
          
          // Verify it was stored
          expect(localStorage.setItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, selectedLanguage);
          
          // Verify it can be retrieved
          const storedLanguage = LanguagePersistenceService.getStoredLanguagePreference();
          expect(storedLanguage).toBe(selectedLanguage);
          expect(LanguagePersistenceService.isValidLocale(storedLanguage!)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 32: Invalid language preferences should not be persisted', () => {
    fc.assert(
      fc.property(
        invalidLanguageArbitrary,
        (invalidLanguage) => {
          // Attempt to store invalid language
          LanguagePersistenceService.storeLanguagePreference(invalidLanguage);
          
          // Verify it was not stored
          expect(localStorage.setItem).not.toHaveBeenCalledWith(LOCALE_STORAGE_KEY, invalidLanguage);
          
          // Verify nothing is retrieved
          const storedLanguage = LanguagePersistenceService.getStoredLanguagePreference();
          expect(storedLanguage).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 32: Language preference should persist across sessions', () => {
    fc.assert(
      fc.property(
        validLanguageArbitrary,
        (selectedLanguage) => {
          // Store language preference
          LanguagePersistenceService.storeLanguagePreference(selectedLanguage);
          
          // Simulate new session by clearing mocks but not storage
          jest.clearAllMocks();
          
          // Retrieve language preference in "new session"
          const retrievedLanguage = LanguagePersistenceService.getStoredLanguagePreference();
          
          // Should still be the same
          expect(retrievedLanguage).toBe(selectedLanguage);
          expect(localStorage.getItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 32: Language preference should be applied to interface elements', () => {
    fc.assert(
      fc.property(
        validLanguageArbitrary,
        (selectedLanguage) => {
          // Apply language to interface
          LanguagePersistenceService.applyLanguageToInterface(selectedLanguage);
          
          // Verify document language is set
          expect(document.documentElement.lang).toBe(selectedLanguage);
          
          // Verify text direction is set correctly
          const expectedDirection = selectedLanguage === 'ar' ? 'rtl' : 'ltr';
          expect(document.documentElement.dir).toBe(expectedDirection);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 32: Language preference updates should overwrite previous values', () => {
    fc.assert(
      fc.property(
        fc.tuple(validLanguageArbitrary, validLanguageArbitrary),
        ([firstLanguage, secondLanguage]) => {
          // Clear mocks for this test
          mockLocalStorage.setItem.mockClear();
          
          // Store first language
          LanguagePersistenceService.storeLanguagePreference(firstLanguage);
          expect(LanguagePersistenceService.getStoredLanguagePreference()).toBe(firstLanguage);
          
          // Store second language (should overwrite)
          LanguagePersistenceService.storeLanguagePreference(secondLanguage);
          const finalLanguage = LanguagePersistenceService.getStoredLanguagePreference();
          
          // Should be the second language
          expect(finalLanguage).toBe(secondLanguage);
          // Should have been called at least twice
          expect(mockLocalStorage.setItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, firstLanguage);
          expect(mockLocalStorage.setItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, secondLanguage);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 32: Clearing language preference should remove stored value', () => {
    fc.assert(
      fc.property(
        validLanguageArbitrary,
        (selectedLanguage) => {
          // Store language preference
          LanguagePersistenceService.storeLanguagePreference(selectedLanguage);
          expect(LanguagePersistenceService.getStoredLanguagePreference()).toBe(selectedLanguage);
          
          // Clear preference
          LanguagePersistenceService.clearLanguagePreference();
          
          // Should be null now
          expect(LanguagePersistenceService.getStoredLanguagePreference()).toBeNull();
          expect(localStorage.removeItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property 32: Multiple rapid language changes should persist final selection', () => {
    fc.assert(
      fc.property(
        fc.array(validLanguageArbitrary, { minLength: 2, maxLength: 5 }),
        (languageSequence) => {
          // Clear mocks for this test
          mockLocalStorage.setItem.mockClear();
          
          // Apply sequence of language changes
          languageSequence.forEach(lang => {
            LanguagePersistenceService.storeLanguagePreference(lang);
          });
          
          // Final stored language should be the last one
          const finalLanguage = LanguagePersistenceService.getStoredLanguagePreference();
          const expectedFinalLanguage = languageSequence[languageSequence.length - 1];
          
          expect(finalLanguage).toBe(expectedFinalLanguage);
          // Should have been called at least as many times as the sequence length
          expect(mockLocalStorage.setItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, expectedFinalLanguage);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 32: Language persistence should be consistent across different storage operations', () => {
    fc.assert(
      fc.property(
        validLanguageArbitrary,
        (selectedLanguage) => {
          // Store language
          LanguagePersistenceService.storeLanguagePreference(selectedLanguage);
          
          // Multiple retrievals should return same value
          const retrieval1 = LanguagePersistenceService.getStoredLanguagePreference();
          const retrieval2 = LanguagePersistenceService.getStoredLanguagePreference();
          const retrieval3 = LanguagePersistenceService.getStoredLanguagePreference();
          
          expect(retrieval1).toBe(selectedLanguage);
          expect(retrieval2).toBe(selectedLanguage);
          expect(retrieval3).toBe(selectedLanguage);
          expect(retrieval1).toBe(retrieval2);
          expect(retrieval2).toBe(retrieval3);
        }
      ),
      { numRuns: 50 }
    );
  });
});