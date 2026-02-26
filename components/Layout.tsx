import React, { useState } from 'react';
import { COLORS } from '../constants';
import { useTheme } from '../services/theme';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  TrendingUp,
  FileText,
  LineChart,
  Archive,
  History,
  FileOutput,
  Moon,
  Sun,
  Menu,
  X
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, onLogout }) => {
  const { isDark, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'billing', label: 'Billing', icon: ShoppingCart },
    { id: 'invoices', label: 'Invoices', icon: Archive },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'forecasting', label: 'Forecasting', icon: TrendingUp },
    { id: 'tax-compliance', label: 'Tax Compliance', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: LineChart },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'audit-logs', label: 'Audit Log', icon: History },
    { id: 'tally-export', label: 'Tally Export', icon: FileOutput },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-overlayFade" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex-shrink-0 flex flex-col shadow-lg transition-transform duration-300 no-print ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ backgroundColor: isDark ? '#1e293b' : COLORS.cream }}
      >
        <div className="p-5 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center gap-3">
          <img 
            src="/assets/logo.jpeg" 
            alt="Natural Health World" 
            className="w-12 h-12 rounded-lg object-cover shadow-sm"
          />
          <div>
            <h1 
              className="text-xl font-bold leading-tight"
              style={{ color: isDark ? '#86efac' : COLORS.mediumGreen }}
            >
              NH World
            </h1>
            <p className="text-xs text-gray-600 dark:text-gray-400">Billing & Inventory</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => { onTabChange(item.id); setSidebarOpen(false); }}
                    className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors duration-200 font-medium ${
                      isActive 
                        ? 'text-white shadow-md' 
                        : isDark
                          ? 'text-gray-300 hover:bg-white/10'
                          : 'text-gray-700 hover:bg-white/50'
                    }`}
                    style={{ 
                        backgroundColor: isActive ? (isDark ? '#166534' : COLORS.mediumGreen) : 'transparent',
                    }}
                  >
                    <Icon size={20} className="mr-3" />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50 space-y-2">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center px-4 py-2 rounded-lg transition-colors ${
              isDark
                ? 'text-yellow-300 hover:bg-yellow-900/30'
                : 'text-gray-600 hover:bg-gray-200/60'
            }`}
          >
            {isDark ? <Sun size={20} className="mr-3" /> : <Moon size={20} className="mr-3" />}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button
            onClick={onLogout}
            className={`w-full flex items-center px-4 py-2 rounded-lg transition-colors ${
              isDark
                ? 'text-gray-300 hover:text-red-400 hover:bg-red-900/30'
                : 'text-gray-700 hover:text-red-600 hover:bg-red-50'
            }`}
          >
            <LogOut size={20} className="mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-gray-900 transition-colors duration-300">
        <header 
            className="h-16 flex items-center px-4 lg:px-8 shadow-sm z-10 no-print bg-white dark:bg-gray-800 border-b border-transparent dark:border-gray-700 transition-colors duration-300"
        >
          <button 
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden mr-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Menu size={22} className="text-gray-600 dark:text-gray-300" />
          </button>
          <h2 
            className="text-xl font-semibold"
            style={{ color: isDark ? '#e2e8f0' : COLORS.darkText }}
          >
            {menuItems.find(i => i.id === activeTab)?.label}
          </h2>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8 relative" id="printable-area-wrapper">
          <div key={activeTab} className="animate-pageEnter">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
