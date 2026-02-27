import { useEffect } from 'react';
import { 
  loadUserPreferences, 
  saveUserPreferences,
  getTheme, 
  setTheme,
  getLanguage,
  setLanguage,
  getFullName,
  setFullName,
  getUsername,
  setUsername,
  getEmail,
  setEmail,
  getPhone,
  setPhone,
  getCountry,
  setCountry,
  getTimezone,
  setTimezone,
  getDefaultCurrency,
  setDefaultCurrency,
  getQrCodeSize,
  setQrCodeSize,
  getShowBalance,
  setShowBalance,
  getEnableTwoFactor,
  setEnableTwoFactor,
  getPreferredPaymentMethod,
  setPreferredPaymentMethod,
  getAutoLockEnabled,
  setAutoLockEnabled,
  getAutoLockTimeout,
  setAutoLockTimeout,
  getNotificationsEnabled,
  setNotificationsEnabled,
  getSoundEffectsEnabled,
  setSoundEffectsEnabled,
  isPinSetupCompleted,
  setPinSetupCompleted,
  getDisableContactCollection,
  setDisableContactCollection,
  getCustomerPaysFee,
  setCustomerPaysFee,
  getOpenPayFeeAccount,
  setOpenPayFeeAccount,
  shouldPersistPreferences,
  updateMultiplePreferences,
  resetAllPreferences
} from '@/lib/userPreferencesStorage';

// Auto-save preferences to localStorage whenever they change
export const useAutoSavePreferences = () => {
  useEffect(() => {
    // This hook ensures preferences are automatically saved
    // when any of the setter functions are called
    // The individual setter functions already handle saving
  }, []);
};

// Load and apply all preferences on app startup
export const useLoadAndApplyPreferences = () => {
  useEffect(() => {
    if (!shouldPersistPreferences()) return;

    // Load all preferences
    const prefs = loadUserPreferences();
    
    // Apply theme
    if (prefs.theme) {
      setTheme(prefs.theme);
    }
    
    // Apply language
    if (prefs.language) {
      setLanguage(prefs.language);
    }
    
    // Auto-apply any other preferences that need immediate effect
    // This ensures all settings are restored from localStorage
    
    console.log('Loaded user preferences:', prefs);
  }, []);
};

// Sync preferences with user profile from database
export const useSyncPreferencesWithProfile = (userProfile: any) => {
  useEffect(() => {
    if (!userProfile || !shouldPersistPreferences()) return;

    // Sync profile data with preferences
    const updates: any = {};
    
    if (userProfile.full_name && !getFullName()) {
      updates.fullName = userProfile.full_name;
    }
    
    if (userProfile.username && !getUsername()) {
      updates.username = userProfile.username;
    }
    
    if (userProfile.email && !getEmail()) {
      updates.email = userProfile.email;
    }
    
    if (userProfile.phone && !getPhone()) {
      updates.phone = userProfile.phone;
    }
    
    if (Object.keys(updates).length > 0) {
      saveUserPreferences(updates);
      console.log('Synced profile preferences:', updates);
    }
  }, [userProfile]);
};

// Export a combined hook for convenience
export const useUserPreferences = () => {
  useAutoSavePreferences();
  useLoadAndApplyPreferences();
  
  return {
    // Getters
    getTheme,
    getLanguage,
    getFullName,
    getUsername,
    getEmail,
    getPhone,
    getCountry,
    getTimezone,
    getDefaultCurrency,
    getQrCodeSize,
    getShowBalance,
    getEnableTwoFactor,
    getPreferredPaymentMethod,
    getAutoLockEnabled,
    getAutoLockTimeout,
    getNotificationsEnabled,
    getSoundEffectsEnabled,
    isPinSetupCompleted,
    getDisableContactCollection,
    getCustomerPaysFee,
    getOpenPayFeeAccount,
    shouldPersistPreferences,
    
    // Setters
    setTheme,
    setLanguage,
    setFullName,
    setUsername,
    setEmail,
    setPhone,
    setCountry,
    setTimezone,
    setDefaultCurrency,
    setQrCodeSize,
    setShowBalance,
    setEnableTwoFactor,
    setPreferredPaymentMethod,
    setAutoLockEnabled,
    setAutoLockTimeout,
    setNotificationsEnabled,
    setSoundEffectsEnabled,
    setPinSetupCompleted,
    setDisableContactCollection,
    setCustomerPaysFee,
    setOpenPayFeeAccount,
    
    // Utilities
    updateMultiplePreferences: updateMultiplePreferences,
    resetAllPreferences: resetAllPreferences,
    useSyncPreferencesWithProfile: useSyncPreferencesWithProfile,
  };
};
