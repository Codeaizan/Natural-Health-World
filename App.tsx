// Import React hooks for state management, effects, and refs
import React, { useState, useEffect, useRef, useCallback, Component } from 'react';
// Import Login component for authentication screen
import Login from './pages/Login';
// Import Layout component that wraps authenticated pages
import Layout from './components/Layout';
// Import Dashboard page component
import Dashboard from './pages/Dashboard';
// Import Billing page component
import Billing from './pages/Billing';
// Import Invoices page component
import Invoices from './pages/Invoices';
// Import Inventory page component
import Inventory from './pages/Inventory';
// Import Customers page component
import Customers from './pages/Customers';
// Import Forecasting page component
import Forecasting from './pages/Forecasting';
// Import TaxCompliance page component
import TaxCompliance from './pages/TaxCompliance';
// Import Analytics page component
import Analytics from './pages/Analytics';
// Import Reports page component
import Reports from './pages/Reports';
// Import Settings page component
import Settings from './pages/Settings';
// Import AuditLogs page component
import AuditLogs from './pages/AuditLogs';
// Import TallyExport page component
import TallyExport from './pages/TallyExport';
// Import FirstRunSetup page component
import FirstRunSetup from './pages/FirstRunSetup';
// Import ThemeProvider for theme styling
import { ThemeProvider } from './services/theme';
// Import ToastProvider and useToast hook for notifications
import { ToastProvider, useToast } from './components/Toast';
// Import AuditLogService for logging user actions
import { AuditLogService } from './services/auditLog';
// Import StorageService for data persistence
import { StorageService } from './services/storage';
// Import setup check functions from data path service
import { isFirstRunComplete, setDataPath, ensureDataFolders } from './services/dataPath';

// Helper function to check if the application is running in Tauri desktop environment
const isTauri = (): boolean => !!(window as any).__TAURI_INTERNALS__;

// Main App component that handles routing, authentication, and application state
const App: React.FC = () => {
  // State to track if user is authenticated
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  // State to track active tab/page
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  // State to track if initial setup is complete (null = loading, true/false = determined)
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null); // null = loading
  // Ref to store inactivity timer for session timeout
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Get toast notification functions from context
  const toast = useToast();

  // Effect to check if first-run setup has been completed
  // Check first-run setup status
  useEffect(() => {
    // If not in Tauri environment, skip setup check and go directly to dash
    if (!isTauri()) {
      // In browser mode, skip setup
      setSetupComplete(true);
      return;
    }
    // Define async function to check setup status
    // Small delay to allow DB to initialize
    const checkSetup = async () => {
      try {
        // Wait briefly for DB to be ready
        // Wait briefly for DB to be ready to prevent race conditions
        await new Promise(resolve => setTimeout(resolve, 300));
        // Check if first-run setup is complete
        const done = await isFirstRunComplete();
        // If setup is done, ensure all data folders exist
        if (done) {
          await ensureDataFolders();
        }
        // Update setup status state
        setSetupComplete(done);
      // If any error occurs, mark setup as incomplete to show setup screen
      } catch {
        setSetupComplete(false);
      }
    };
    // Call the setup check function
    checkSetup();
  }, []);

  // Effect to restore user session from session storage on component mount
  // Session Persistence
  useEffect(() => {
    // Try to get auth token from session storage
    const session = sessionStorage.getItem('nhw_auth');
    // If valid session exists, set authenticated state to true
    if (session === 'true') setIsAuthenticated(true);
  }, []);

  // Handler function to process user login
  // Define handlers BEFORE effects that reference them (avoids TDZ)
  const handleLogin = () => {
    // Set authenticated state to true
    setIsAuthenticated(true);
    // Store auth token in session storage
    sessionStorage.setItem('nhw_auth', 'true');
  };

  // Handler function to process user logout with memoization
  const handleLogout = useCallback(() => {
    // Log the logout action to audit log
    AuditLogService.log('auth', 'User Logout', `User logged out`);
    // Set authenticated state to false
    setIsAuthenticated(false);
    // Remove auth token from session storage
    sessionStorage.removeItem('nhw_auth');
    // Remove user info from session storage
    sessionStorage.removeItem('nhw_user');
    // Reset active tab to dashboard
    setActiveTab('dashboard');
  }, []);

  // Effect to perform automatic backups periodically when user is authenticated
  // Auto Backup Loop
  useEffect(() => {
    // Only run backup if user is authenticated
    if (isAuthenticated) {
        // Perform backup immediately
        StorageService.performAutoBackup().catch(e => console.error('Backup error:', e));
        // Set up interval to perform backup every hour (60 * 60 * 1000 milliseconds)
        const interval = setInterval(() => {
            // Perform backup on interval
            StorageService.performAutoBackup().catch(e => console.error('Backup error:', e));
        }, 60 * 60 * 1000); 
        // Return cleanup function to clear interval on component unmount or when auth changes
        return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Effect to handle inactivity timeout - logs out user after 30 minutes of no activity
  // Inactivity Logic
  useEffect(() => {
      // Only set up inactivity handler if user is authenticated
      if (isAuthenticated) {
          // Define function to reset the inactivity timer on user activity
          const resetTimer = () => {
              // Clear existing timer if one is running
              if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
              // Set new timer for 30 minutes of inactivity
              inactivityTimer.current = setTimeout(() => {
                  // Show warning toast when session is about to expire
                  toast.warning('Session Expired', 'You have been logged out due to inactivity.');
                  // Log out the user
                  handleLogout();
              }, 30 * 60 * 1000); // 30 Minutes
          };

          // Add event listeners for mouse, keyboard, and click activity
          // Track mouse movement for activity detection
          window.addEventListener('mousemove', resetTimer);
          // Track keyboard input for activity detection
          window.addEventListener('keydown', resetTimer);
          // Track mouse clicks for activity detection
          window.addEventListener('click', resetTimer);
          
          // Initialize timer on first mount or auth change
          resetTimer(); // Start

          // Return cleanup function to remove event listeners
          return () => {
              window.removeEventListener('mousemove', resetTimer);
              window.removeEventListener('keydown', resetTimer);
              window.removeEventListener('click', resetTimer);
              if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
          };
      }
  }, [isAuthenticated, handleLogout, toast]);

  // Handler function called when first-run setup is completed
  const handleSetupComplete = async (dataPath: string) => {
    // Store the data path selected by user
    await setDataPath(dataPath);
    // Create necessary folder structure for data storage
    await ensureDataFolders();
    // Mark setup as complete
    setSetupComplete(true);
  };

  // Show loading screen while checking first-run setup status
  // Show loading while checking first-run status
  if (setupComplete === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Show first-run setup screen if setup is not yet complete
  // Show first-run setup if not completed
  if (!setupComplete) {
    return <FirstRunSetup onComplete={handleSetupComplete} />;
  }

  // Show login screen if user is not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Function to render the appropriate page component based on active tab
  const renderContent = () => {
    // Switch on the active tab value
    switch (activeTab) {
      // Render Dashboard when active tab is dashboard
      case 'dashboard': return <Dashboard />;
      // Render Billing page when active tab is billing
      case 'billing': return <Billing />;
      // Render Invoices page when active tab is invoices
      case 'invoices': return <Invoices />;
      // Render Inventory page when active tab is inventory
      case 'inventory': return <Inventory />;
      // Render Customers page when active tab is customers
      case 'customers': return <Customers />;
      // Render Forecasting page when active tab is forecasting
      case 'forecasting': return <Forecasting />;
      // Render TaxCompliance page when active tab is tax-compliance
      case 'tax-compliance': return <TaxCompliance />;
      // Render Analytics page when active tab is analytics
      case 'analytics': return <Analytics />;
      // Render Reports page when active tab is reports
      case 'reports': return <Reports />;
      // Render AuditLogs page when active tab is audit-logs
      case 'audit-logs': return <AuditLogs />;
      // Render TallyExport page when active tab is tally-export
      case 'tally-export': return <TallyExport />;
      // Render Settings page when active tab is settings
      case 'settings': return <Settings />;
      // Default to Dashboard for unrecognized tabs
      default: return <Dashboard />;
    }
  };

  // Render main application with Layout wrapper and dynamic page content
  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab} 
      onLogout={handleLogout}
    >
      {renderContent()}
    </Layout>
  );
};

// Error Boundary class component — catches any unhandled JS errors in child components
// and displays a recovery UI instead of crashing the entire application to a blank screen.
interface EBProps { children: React.ReactNode; }
interface EBState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
            <div className="text-red-500 text-5xl mb-4">⚠</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
            <p className="text-gray-500 mb-4 text-sm">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); }}
              className="px-6 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 mr-2"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Main application component with all required providers (Theme, Toast, and ErrorBoundary)
const AppWithProviders: React.FC = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default AppWithProviders;