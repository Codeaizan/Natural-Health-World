// Import React and the createContext/useContext/useEffect hooks
import React, { createContext, useContext, useEffect } from 'react';

// The app only supports light mode; this type ensures only 'light' is assignable
type Theme = 'light';

// Shape of the context value provided to all consumers
interface ThemeContextType {
  theme: Theme;          // Current theme name — always 'light'
  toggleTheme: () => void; // No-op stub kept for API compatibility
  isDark: boolean;       // Always false — kept for conditional styling guards
}

// Create the context with safe light-mode defaults so consumers never crash
// even if accidentally used outside a provider
const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',       // Default: light mode
  toggleTheme: () => {}, // Default: no-op toggle
  isDark: false,         // Default: not dark
});

// Convenience hook — call this inside any component to read theme values
export const useTheme = () => useContext(ThemeContext);

// Provider component — wrap the app root with this to supply theme context
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // On mount, scrub any leftover 'dark' class and persisted theme key.
  // Always light mode — ensure .dark class is never present
  useEffect(() => {
    document.documentElement.classList.remove('dark'); // Remove Tailwind dark-mode class from <html>
    localStorage.removeItem('nhw_theme');              // Clear any stale theme preference stored by the user
  }, []); // Empty dependency array = run once on initial mount only

  // Provide a static light-mode context value to all descendant components
  return (
    <ThemeContext.Provider value={{ theme: 'light', toggleTheme: () => {}, isDark: false }}>
      {children} {/* Render all child components inside the provider */}
    </ThemeContext.Provider>
  );
};
