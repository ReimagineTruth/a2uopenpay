export type AppThemeMode = "light" | "dark" | "system";

export const APP_THEME_STORAGE_KEY = "openpay_app_theme";

const isThemeMode = (value: string | null): value is AppThemeMode => 
  value === "light" || value === "dark" || value === "system";

export const getStoredAppTheme = (): AppThemeMode => {
  if (typeof window === "undefined") return "system";
  
  // Try to get from new preferences system first
  try {
    const { getTheme } = require("./userPreferencesStorage");
    const theme = getTheme();
    if (isThemeMode(theme)) return theme;
  } catch (error) {
    // Fallback to old method if new system not available
    const saved = localStorage.getItem(APP_THEME_STORAGE_KEY);
    if (isThemeMode(saved)) return saved;
  }
  
  return "system";
};

export const applyAppTheme = (theme: AppThemeMode) => {
  if (typeof document === "undefined") return;
  
  let actualTheme: "light" | "dark";
  
  if (theme === "system") {
    actualTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } else {
    actualTheme = theme;
  }
  
  document.documentElement.classList.toggle("dark", actualTheme === "dark");
  document.documentElement.style.colorScheme = actualTheme;
};

export const persistAndApplyAppTheme = (theme: AppThemeMode) => {
  if (typeof window !== "undefined") {
    // Save to new preferences system
    try {
      const { setTheme } = require("./userPreferencesStorage");
      setTheme(theme);
    } catch (error) {
      // Fallback to old method
      localStorage.setItem(APP_THEME_STORAGE_KEY, theme);
    }
  }
  applyAppTheme(theme);
};

