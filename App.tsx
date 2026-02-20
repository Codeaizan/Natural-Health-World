import React, { useState, useEffect, useRef } from 'react';
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
import { StorageService } from './services/storage';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Session Persistence
  useEffect(() => {
    const session = sessionStorage.getItem('nhw_auth');
    if (session === 'true') setIsAuthenticated(true);
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
                  alert("Session expired due to inactivity.");
                  handleLogout();
              }, 30 * 60 * 1000); // 30 Minutes
          };

          window.addEventListener('mousemove', resetTimer);
          window.addEventListener('keypress', resetTimer);
          window.addEventListener('click', resetTimer);
          
          resetTimer(); // Start

          return () => {
              window.removeEventListener('mousemove', resetTimer);
              window.removeEventListener('keypress', resetTimer);
              window.removeEventListener('click', resetTimer);
              if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
          };
      }
  }, [isAuthenticated]);

  const handleLogin = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('nhw_auth', 'true');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('nhw_auth');
    sessionStorage.removeItem('nhw_user');
    setActiveTab('dashboard');
  };

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

export default App;