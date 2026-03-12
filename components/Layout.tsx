// Import React and useState hook for state management
import React, { useState } from 'react';
// Import color constants from project constants file
import { COLORS } from '../constants';
// Import icon components from lucide-react for navigation and UI elements
import { 
  // Dashboard icon for the dashboard menu item
  LayoutDashboard, 
  // Shopping cart icon for the billing menu item
  ShoppingCart, 
  // Package icon for the inventory menu item
  Package, 
  // Users icon for the customers menu item
  Users, 
  // Bar chart icon for reports menu item
  BarChart3, 
  // Gear icon for settings menu item
  Settings, 
  // Logout/exit icon for logout button
  LogOut,
  // Up trending arrow icon for forecasting menu item
  TrendingUp,
  // File text icon for tax compliance menu item
  FileText,
  // Line chart icon for analytics menu item
  LineChart,
  // Archive icon for invoices menu item
  Archive,
  // History icon for audit logs menu item
  History,
  // File output icon for tally export menu item
  FileOutput,
  // Hamburger menu icon for mobile navigation
  Menu,
  // Close/X icon for closing modals
  X
} from 'lucide-react';

// Interface defining props for the Layout component
interface LayoutProps {
  // React children elements to render in the main content area
  children: React.ReactNode;
  // Currently active tab/page identifier
  activeTab: string;
  // Callback function when user clicks on a menu item to change tabs
  onTabChange: (tab: string) => void;
  // Callback function to handle user logout
  onLogout: () => void;
}

// Layout component - wraps all authenticated pages with navigation and header
const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, onLogout }) => {
  // State to control sidebar visibility on mobile devices
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Array of menu items configuration with IDs, labels, and icon components
  const menuItems = [
    // Dashboard menu item with dashboard icon
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    // Billing menu item with shopping cart icon
    { id: 'billing', label: 'Billing', icon: ShoppingCart },
    // Invoices menu item with archive icon
    { id: 'invoices', label: 'Invoices', icon: Archive },
    // Inventory menu item with package icon
    { id: 'inventory', label: 'Inventory', icon: Package },
    // Customers menu item with users icon
    { id: 'customers', label: 'Customers', icon: Users },
    // Forecasting menu item with trending up icon
    { id: 'forecasting', label: 'Forecasting', icon: TrendingUp },
    // Tax Compliance menu item with file text icon
    { id: 'tax-compliance', label: 'Tax Compliance', icon: FileText },
    // Analytics menu item with line chart icon
    { id: 'analytics', label: 'Analytics', icon: LineChart },
    // Reports menu item with bar chart icon
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    // Audit Log menu item with history icon
    { id: 'audit-logs', label: 'Audit Log', icon: History },
    // Tally Export menu item with file output icon
    { id: 'tally-export', label: 'Tally Export', icon: FileOutput },
    // Settings menu item with settings/gear icon
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-overlayFade" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar navigation */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex-shrink-0 flex flex-col shadow-lg transition-transform duration-300 no-print ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ backgroundColor: COLORS.cream }}
      >
        {/* Header with logo and branding */}
        <div className="p-5 border-b border-gray-200/50 flex items-center gap-3">
          <img 
            src="/assets/logo.jpeg" 
            alt="Natural Health World" 
            className="w-12 h-12 rounded-lg object-cover shadow-sm"
          />
          <div>
            <h1 
              className="text-xl font-bold leading-tight"
              style={{ color: COLORS.mediumGreen }}
            >
              NH World
            </h1>
            <p className="text-xs text-gray-600">Billing & Inventory</p>
          </div>
        </div>

        {/* Navigation menu */}
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

        {/* Footer with logout */}
        <div className="p-4 border-t border-gray-200/50 space-y-2">
          <button
            onClick={onLogout}
            className="w-full flex items-center px-4 py-2 rounded-lg transition-colors text-gray-700 hover:text-red-600 hover:bg-red-50"
          >
            <LogOut size={20} className="mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        <header 
            className="h-16 flex items-center px-4 lg:px-8 shadow-sm z-10 no-print bg-white border-b border-transparent"
        >
          <button 
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden mr-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu size={22} className="text-gray-600" />
          </button>
          <h2 
            className="text-xl font-semibold"
            style={{ color: COLORS.darkText }}
          >
            {menuItems.find(i => i.id === activeTab)?.label}
          </h2>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-4 lg:p-8 relative" id="printable-area-wrapper">
          <div key={activeTab} className="animate-pageEnter">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

// Export Layout as default export
export default Layout;
