import React, { useState, useEffect, useRef, useCallback } from 'react';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing';
import Invoices from './pages/Invoices';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Forecasting from './pages/Forecasting';
import TaxCompliance from './pages/TaxCompliance';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import AuditLogs from './pages/AuditLogs';
import TallyExport from './pages/TallyExport';
import FirstRunSetup from './pages/FirstRunSetup';
import { ThemeProvider } from './services/theme';
import { ToastProvider, useToast } from './components/Toast';
import { AuditLogService } from './services/auditLog';
import { StorageService } from './services/storage';
import { isFirstRunComplete, setDataPath, ensureDataFolders } from './services/dataPath';

const isTauri = (): boolean => !!(window as any).__TAURI_INTERNALS__;

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null); // null = loading
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();

  // Check first-run setup status
  useEffect(() => {
    if (!isTauri()) {
      // In browser mode, skip setup
      setSetupComplete(true);
      return;
    }
    // Small delay to allow DB to initialize
    const checkSetup = async () => {
      try {
        // Wait briefly for DB to be ready
        await new Promise(resolve => setTimeout(resolve, 300));
        const done = await isFirstRunComplete();
        if (done) {
          await ensureDataFolders();
        }
        setSetupComplete(done);
      } catch {
        setSetupComplete(false);
      }
    };
    checkSetup();
  }, []);

  // Session Persistence
  useEffect(() => {
    const session = sessionStorage.getItem('nhw_auth');
    if (session === 'true') setIsAuthenticated(true);
  }, []);

  // Define handlers BEFORE effects that reference them (avoids TDZ)
  const handleLogin = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('nhw_auth', 'true');
  };

  const handleLogout = useCallback(() => {
    AuditLogService.log('auth', 'User Logout', `User logged out`);
    setIsAuthenticated(false);
    sessionStorage.removeItem('nhw_auth');
    sessionStorage.removeItem('nhw_user');
    setActiveTab('dashboard');
  }, []);

  // Auto Backup Loop
  useEffect(() => {
    if (isAuthenticated) {
        StorageService.performAutoBackup().catch(e => console.error('Backup error:', e));
        const interval = setInterval(() => {
            StorageService.performAutoBackup().catch(e => console.error('Backup error:', e));
        }, 60 * 60 * 1000); 
        return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Inactivity Logic
  useEffect(() => {
      if (isAuthenticated) {
          const resetTimer = () => {
              if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
              inactivityTimer.current = setTimeout(() => {
                  toast.warning('Session Expired', 'You have been logged out due to inactivity.');
                  handleLogout();
              }, 30 * 60 * 1000); // 30 Minutes
          };

          window.addEventListener('mousemove', resetTimer);
          window.addEventListener('keydown', resetTimer);
          window.addEventListener('click', resetTimer);
          
          resetTimer(); // Start

          return () => {
              window.removeEventListener('mousemove', resetTimer);
              window.removeEventListener('keydown', resetTimer);
              window.removeEventListener('click', resetTimer);
              if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
          };
      }
  }, [isAuthenticated, handleLogout, toast]);

  const handleSetupComplete = async (dataPath: string) => {
    await setDataPath(dataPath);
    await ensureDataFolders();
    setSetupComplete(true);
  };

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

  // Show first-run setup if not completed
  if (!setupComplete) {
    return <FirstRunSetup onComplete={handleSetupComplete} />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'billing': return <Billing />;
      case 'invoices': return <Invoices />;
      case 'inventory': return <Inventory />;
      case 'customers': return <Customers />;
      case 'forecasting': return <Forecasting />;
      case 'tax-compliance': return <TaxCompliance />;
      case 'analytics': return <Analytics />;
      case 'reports': return <Reports />;
      case 'audit-logs': return <AuditLogs />;
      case 'tally-export': return <TallyExport />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

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

const AppWithProviders: React.FC = () => (
  <ThemeProvider>
    <ToastProvider>
      <App />
    </ToastProvider>
  </ThemeProvider>
);

export default AppWithProviders;