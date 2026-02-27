// Comprehensive User Preferences Storage System
// Handles all user preferences with localStorage and cookie management

export interface UserPreferences {
  // Security preferences
  pinSetupCompleted?: boolean;
  securityPasswordEnabled?: boolean;
  biometricEnabled?: boolean;
  
  // UI preferences
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  
  // Privacy and consent
  cookiesAccepted?: boolean;
  analyticsConsent?: boolean;
  marketingConsent?: boolean;
  
  // App behavior
  autoLockEnabled?: boolean;
  autoLockTimeout?: number; // in minutes
  notificationsEnabled?: boolean;
  soundEffectsEnabled?: boolean;
  
  // Payment links preferences
  disableContactCollection?: boolean;
  customerPaysFee?: boolean; // true = customer pays 2% fee, false = merchant handles fee
  openPayFeeAccount?: string; // Account to receive fees: OPEA68BB7A9F964994A199A15786D680FA
  
  // Timestamps
  lastUpdated?: string;
}

export interface CookieConsentOptions {
  necessary: boolean; // Always true for essential functionality
  functional: boolean; // For preferences, themes, etc.
  analytics: boolean; // For usage tracking
  marketing: boolean; // For promotional content
}

const PREFERENCES_KEY = 'openpay_user_preferences';
const COOKIE_CONSENT_KEY = 'openpay_cookie_consent';
const CONSENT_TIMESTAMP_KEY = 'openpay_consent_timestamp';

// Default preferences
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  language: 'en',
  autoLockEnabled: true,
  autoLockTimeout: 15,
  notificationsEnabled: true,
  soundEffectsEnabled: true,
  cookiesAccepted: false,
  analyticsConsent: false,
  marketingConsent: false,
  // Payment links defaults
  disableContactCollection: false,
  customerPaysFee: true, // By default, customer pays fee
  openPayFeeAccount: 'OPEA68BB7A9F964994A199A15786D680FA',
};

// Default cookie consent
const DEFAULT_CONSENT: CookieConsentOptions = {
  necessary: true, // Essential cookies are always enabled
  functional: false,
  analytics: false,
  marketing: false,
};

// Storage functions
export const loadUserPreferences = (): UserPreferences => {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (!stored) return DEFAULT_PREFERENCES;
    
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch (error) {
    console.error('Failed to load user preferences:', error);
    return DEFAULT_PREFERENCES;
  }
};

export const saveUserPreferences = (preferences: Partial<UserPreferences>): void => {
  if (typeof window === "undefined") return;
  
  try {
    const current = loadUserPreferences();
    const updated = {
      ...current,
      ...preferences,
      lastUpdated: new Date().toISOString(),
    };
    
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save user preferences:', error);
  }
};

export const updateUserPreference = <K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K]
): void => {
  saveUserPreferences({ [key]: value });
};

// Cookie consent management
export const loadCookieConsent = (): CookieConsentOptions => {
  if (typeof window === "undefined") return DEFAULT_CONSENT;
  
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) return DEFAULT_CONSENT;
    
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_CONSENT, ...parsed };
  } catch (error) {
    console.error('Failed to load cookie consent:', error);
    return DEFAULT_CONSENT;
  }
};

export const saveCookieConsent = (consent: Partial<CookieConsentOptions>): void => {
  if (typeof window === "undefined") return;
  
  try {
    const current = loadCookieConsent();
    const updated = { ...current, ...consent };
    
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(updated));
    localStorage.setItem(CONSENT_TIMESTAMP_KEY, new Date().toISOString());
    
    // Update user preferences to reflect consent
    saveUserPreferences({
      cookiesAccepted: true,
      analyticsConsent: updated.analytics,
      marketingConsent: updated.marketing,
    });
  } catch (error) {
    console.error('Failed to save cookie consent:', error);
  }
};

export const hasAcceptedCookies = (): boolean => {
  if (typeof window === "undefined") return false;
  
  const consent = loadCookieConsent();
  const timestamp = localStorage.getItem(CONSENT_TIMESTAMP_KEY);
  
  // Check if user has made a consent decision
  return timestamp !== null && (consent.functional || consent.analytics || consent.marketing);
};

export const canUseFunctionalCookies = (): boolean => {
  const consent = loadCookieConsent();
  return hasAcceptedCookies() && consent.functional;
};

export const canUseAnalyticsCookies = (): boolean => {
  const consent = loadCookieConsent();
  return hasAcceptedCookies() && consent.analytics;
};

export const canUseMarketingCookies = (): boolean => {
  const consent = loadCookieConsent();
  return hasAcceptedCookies() && consent.marketing;
};

// Clear all preferences (for logout/reset)
export const clearAllUserPreferences = (): void => {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.removeItem(PREFERENCES_KEY);
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    localStorage.removeItem(CONSENT_TIMESTAMP_KEY);
  } catch (error) {
    console.error('Failed to clear user preferences:', error);
  }
};

// Export individual preference getters/setters for convenience
export const getTheme = (): string => {
  return loadUserPreferences().theme || 'light';
};

export const setTheme = (theme: 'light' | 'dark' | 'system'): void => {
  updateUserPreference('theme', theme);
};

export const getLanguage = (): string => {
  return loadUserPreferences().language || 'en';
};

export const setLanguage = (language: string): void => {
  updateUserPreference('language', language);
};

export const isPinSetupCompleted = (): boolean => {
  return loadUserPreferences().pinSetupCompleted || false;
};

export const setPinSetupCompleted = (completed: boolean): void => {
  updateUserPreference('pinSetupCompleted', completed);
};

// Payment links preference functions
export const getDisableContactCollection = (): boolean => {
  return loadUserPreferences().disableContactCollection || false;
};

export const setDisableContactCollection = (disabled: boolean): void => {
  updateUserPreference('disableContactCollection', disabled);
};

export const getCustomerPaysFee = (): boolean => {
  return loadUserPreferences().customerPaysFee !== false; // Default to true if undefined
};

export const setCustomerPaysFee = (customerPays: boolean): void => {
  updateUserPreference('customerPaysFee', customerPays);
};

export const getOpenPayFeeAccount = (): string => {
  return loadUserPreferences().openPayFeeAccount || 'OPEA68BB7A9F964994A199A15786D680FA';
};

export const setOpenPayFeeAccount = (account: string): void => {
  updateUserPreference('openPayFeeAccount', account);
};

// Helper to check if we should persist preferences
export const shouldPersistPreferences = (): boolean => {
  return canUseFunctionalCookies();
};
