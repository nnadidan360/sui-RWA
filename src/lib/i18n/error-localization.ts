import { locales, defaultLocale, type Locale } from './config';

// Error message localization service
export class ErrorLocalizationService {
  private static errorMessages = {
    en: {
      'NETWORK_ERROR': 'Network error. Please check your connection.',
      'WALLET_CONNECTION_ERROR': 'Wallet connection error. Please reconnect your wallet.',
      'TRANSACTION_FAILED': 'Transaction failed. Please try again.',
      'VALIDATION_ERROR': 'Validation error. Please check your input.',
      'AUTHENTICATION_FAILED': 'Authentication failed. Please log in again.',
      'AUTHORIZATION_DENIED': "You don't have permission to perform this action.",
      'RESOURCE_NOT_FOUND': 'The requested resource was not found.',
      'SERVER_ERROR': 'Server error. Please try again later.',
      'REQUEST_TIMEOUT': 'Request timed out. Please try again.',
      'INSUFFICIENT_FUNDS': 'Insufficient funds for this transaction.',
      'INVALID_AMOUNT': 'Invalid amount entered.',
      'MINIMUM_AMOUNT_ERROR': 'Amount is below the minimum required.',
      'MAXIMUM_AMOUNT_ERROR': 'Amount exceeds the maximum allowed.',
      'ASSET_NOT_FOUND': 'Asset not found.',
      'LOAN_NOT_FOUND': 'Loan not found.',
      'INVALID_COLLATERAL': 'Invalid collateral provided.',
      'LIQUIDATION_RISK': 'This action would put your position at risk of liquidation.',
      'GENERIC_ERROR': 'An unexpected error occurred. Please try again.',
    },
    fr: {
      'NETWORK_ERROR': 'Erreur réseau. Veuillez vérifier votre connexion.',
      'WALLET_CONNECTION_ERROR': 'Erreur de connexion du portefeuille. Veuillez reconnecter votre portefeuille.',
      'TRANSACTION_FAILED': 'La transaction a échoué. Veuillez réessayer.',
      'VALIDATION_ERROR': 'Erreur de validation. Veuillez vérifier votre saisie.',
      'AUTHENTICATION_FAILED': "L'authentification a échoué. Veuillez vous reconnecter.",
      'AUTHORIZATION_DENIED': "Vous n'avez pas la permission d'effectuer cette action.",
      'RESOURCE_NOT_FOUND': "La ressource demandée n'a pas été trouvée.",
      'SERVER_ERROR': 'Erreur serveur. Veuillez réessayer plus tard.',
      'REQUEST_TIMEOUT': "Délai d'attente dépassé. Veuillez réessayer.",
      'INSUFFICIENT_FUNDS': 'Fonds insuffisants pour cette transaction.',
      'INVALID_AMOUNT': 'Montant invalide saisi.',
      'MINIMUM_AMOUNT_ERROR': 'Le montant est inférieur au minimum requis.',
      'MAXIMUM_AMOUNT_ERROR': 'Le montant dépasse le maximum autorisé.',
      'ASSET_NOT_FOUND': 'Actif non trouvé.',
      'LOAN_NOT_FOUND': 'Prêt non trouvé.',
      'INVALID_COLLATERAL': 'Garantie invalide fournie.',
      'LIQUIDATION_RISK': 'Cette action mettrait votre position en risque de liquidation.',
      'GENERIC_ERROR': 'Une erreur inattendue s\'est produite. Veuillez réessayer.',
    },
    ar: {
      'NETWORK_ERROR': 'خطأ في الشبكة. يرجى التحقق من اتصالك.',
      'WALLET_CONNECTION_ERROR': 'خطأ في اتصال المحفظة. يرجى إعادة توصيل محفظتك.',
      'TRANSACTION_FAILED': 'فشلت المعاملة. يرجى المحاولة مرة أخرى.',
      'VALIDATION_ERROR': 'خطأ في التحقق. يرجى التحقق من إدخالك.',
      'AUTHENTICATION_FAILED': 'فشل في المصادقة. يرجى تسجيل الدخول مرة أخرى.',
      'AUTHORIZATION_DENIED': 'ليس لديك إذن لتنفيذ هذا الإجراء.',
      'RESOURCE_NOT_FOUND': 'لم يتم العثور على المورد المطلوب.',
      'SERVER_ERROR': 'خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقاً.',
      'REQUEST_TIMEOUT': 'انتهت مهلة الطلب. يرجى المحاولة مرة أخرى.',
      'INSUFFICIENT_FUNDS': 'أموال غير كافية لهذه المعاملة.',
      'INVALID_AMOUNT': 'مبلغ غير صحيح تم إدخاله.',
      'MINIMUM_AMOUNT_ERROR': 'المبلغ أقل من الحد الأدنى المطلوب.',
      'MAXIMUM_AMOUNT_ERROR': 'المبلغ يتجاوز الحد الأقصى المسموح.',
      'ASSET_NOT_FOUND': 'لم يتم العثور على الأصل.',
      'LOAN_NOT_FOUND': 'لم يتم العثور على القرض.',
      'INVALID_COLLATERAL': 'ضمان غير صحيح مقدم.',
      'LIQUIDATION_RISK': 'هذا الإجراء سيعرض مركزك لخطر التصفية.',
      'GENERIC_ERROR': 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
    },
  };

  static getLocalizedErrorMessage(
    errorCode: string, 
    locale: Locale = defaultLocale,
    fallbackMessage?: string
  ): string {
    // Validate locale
    if (!locales.includes(locale)) {
      locale = defaultLocale;
    }

    // Get localized message
    const localizedMessage = this.errorMessages[locale]?.[errorCode as keyof typeof this.errorMessages[typeof locale]];
    
    if (localizedMessage) {
      return localizedMessage;
    }

    // Fallback to English if not found in requested locale
    if (locale !== 'en') {
      const englishMessage = this.errorMessages.en[errorCode as keyof typeof this.errorMessages.en];
      if (englishMessage) {
        return englishMessage;
      }
    }

    // Use provided fallback or generic error
    return fallbackMessage || this.errorMessages[locale].GENERIC_ERROR || this.errorMessages.en.GENERIC_ERROR;
  }

  static getAllErrorCodes(): string[] {
    return Object.keys(this.errorMessages.en);
  }

  static isErrorCodeSupported(errorCode: string): boolean {
    return errorCode in this.errorMessages.en;
  }

  static getAvailableLocales(): Locale[] {
    return [...locales];
  }

  static hasTranslationForLocale(errorCode: string, locale: Locale): boolean {
    return !!(this.errorMessages[locale]?.[errorCode as keyof typeof this.errorMessages[typeof locale]]);
  }

  // Context-aware error message selection
  static getContextualErrorMessage(
    errorCode: string,
    context: {
      locale?: Locale;
      userType?: 'admin' | 'user';
      feature?: 'lending' | 'staking' | 'assets' | 'auth';
      severity?: 'low' | 'medium' | 'high' | 'critical';
    } = {}
  ): string {
    const { locale = defaultLocale, userType, feature, severity } = context;

    // Get base localized message
    let message = this.getLocalizedErrorMessage(errorCode, locale);

    // Add contextual information if needed
    if (severity === 'critical') {
      const criticalPrefix = {
        en: 'CRITICAL: ',
        fr: 'CRITIQUE: ',
        ar: 'حرج: ',
      };
      message = criticalPrefix[locale] + message;
    }

    return message;
  }

  // Batch localization for multiple errors
  static getLocalizedErrorMessages(
    errorCodes: string[],
    locale: Locale = defaultLocale
  ): Record<string, string> {
    const result: Record<string, string> = {};
    
    errorCodes.forEach(code => {
      result[code] = this.getLocalizedErrorMessage(code, locale);
    });

    return result;
  }
}

// Error message hook for React components
export function useLocalizedError(locale: Locale = defaultLocale) {
  return {
    getErrorMessage: (errorCode: string, fallback?: string) => 
      ErrorLocalizationService.getLocalizedErrorMessage(errorCode, locale, fallback),
    
    getContextualError: (errorCode: string, context: Parameters<typeof ErrorLocalizationService.getContextualErrorMessage>[1]) =>
      ErrorLocalizationService.getContextualErrorMessage(errorCode, { ...context, locale }),
    
    isSupported: (errorCode: string) => 
      ErrorLocalizationService.isErrorCodeSupported(errorCode),
    
    hasTranslation: (errorCode: string) =>
      ErrorLocalizationService.hasTranslationForLocale(errorCode, locale),
  };
}