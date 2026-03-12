// Import React for component creation
import React from 'react';
// Import icon components from lucide-react for various empty states
import { Package, Users, FileText, ShoppingCart, BarChart3, Search } from 'lucide-react';

// Interface defining props for the EmptyState component
interface EmptyStateProps {
  // Optional custom icon component
  icon?: React.ElementType;
  // Main title text for the empty state
  title: string;
  // Optional description text
  description?: string;
  // Optional action button configuration
  action?: {
    label: string;
    onClick: () => void;
  };
  // Predefined type determines icon and gradient color
  type?: 'inventory' | 'customers' | 'invoices' | 'billing' | 'analytics' | 'search' | 'generic';
}

// Configuration object mapping empty state types to icons and gradient colors
const typeConfig: Record<string, { icon: React.ElementType; gradient: string }> = {
  // Configuration for inventory empty state
  inventory: { icon: Package, gradient: 'from-green-100 to-emerald-50' },
  // Configuration for customers empty state
  customers: { icon: Users, gradient: 'from-purple-100 to-indigo-50' },
  // Configuration for invoices empty state
  invoices: { icon: FileText, gradient: 'from-blue-100 to-cyan-50' },
  // Configuration for billing empty state
  billing: { icon: ShoppingCart, gradient: 'from-amber-100 to-yellow-50' },
  // Configuration for analytics empty state
  analytics: { icon: BarChart3, gradient: 'from-indigo-100 to-purple-50' },
  // Configuration for search empty state
  search: { icon: Search, gradient: 'from-gray-100 to-gray-50' },
  // Default generic configuration
  generic: { icon: Package, gradient: 'from-gray-100 to-gray-50' },
};

// EmptyState component function
const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, type = 'generic' }) => {
  // Get configuration for the specified type (or default to generic)
  const config = typeConfig[type] || typeConfig.generic;
  // Use custom icon if provided, otherwise use the one from config
  const Icon = icon || config.icon;

  // Return the JSX for the empty state display
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fadeIn">
      {/* Illustration Circle - outer gradient container */}
      <div className={`w-28 h-28 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center mb-6 shadow-inner`}>
        <div className="w-20 h-20 rounded-full bg-white/60 flex items-center justify-center shadow-sm">
          <Icon size={36} className="text-gray-400" strokeWidth={1.5} />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-700 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400 text-center max-w-xs mb-4">{description}</p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm text-sm font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

// Export EmptyState as default export
export default EmptyState;
