import React from 'react';
import { COLORS } from '../constants';
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
  Archive
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, onLogout }) => {
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
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside 
        className="w-64 flex-shrink-0 flex flex-col shadow-lg transition-all duration-300 no-print"
        style={{ backgroundColor: COLORS.cream }}
      >
        <div className="p-6 border-b border-gray-200/50">
          <h1 
            className="text-2xl font-bold"
            style={{ color: COLORS.mediumGreen }}
          >
            NH World
          </h1>
          <p className="text-xs text-gray-600 mt-1">Billing & Inventory</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onTabChange(item.id)}
                    className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors duration-200 font-medium ${
                      isActive 
                        ? 'text-white shadow-md' 
                        : 'text-gray-700 hover:bg-white/50'
                    }`}
                    style={{ 
                        backgroundColor: isActive ? COLORS.mediumGreen : 'transparent',
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

        <div className="p-4 border-t border-gray-200/50">
          <button
            onClick={onLogout}
            className="w-full flex items-center px-4 py-2 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={20} className="mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        <header 
            className="h-16 flex items-center px-8 shadow-sm z-10 no-print"
            style={{ backgroundColor: COLORS.white }}
        >
          <h2 
            className="text-xl font-semibold"
            style={{ color: COLORS.darkText }}
          >
            {menuItems.find(i => i.id === activeTab)?.label}
          </h2>
        </header>

        <div className="flex-1 overflow-auto p-8 relative" id="printable-area-wrapper">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
