import React from 'react';
import { Package, Users, FileText, ShoppingCart, BarChart3, Search } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  type?: 'inventory' | 'customers' | 'invoices' | 'billing' | 'analytics' | 'search' | 'generic';
}

const typeConfig: Record<string, { icon: React.ElementType; gradient: string }> = {
  inventory: { icon: Package, gradient: 'from-green-100 to-emerald-50' },
  customers: { icon: Users, gradient: 'from-purple-100 to-indigo-50' },
  invoices: { icon: FileText, gradient: 'from-blue-100 to-cyan-50' },
  billing: { icon: ShoppingCart, gradient: 'from-amber-100 to-yellow-50' },
  analytics: { icon: BarChart3, gradient: 'from-indigo-100 to-purple-50' },
  search: { icon: Search, gradient: 'from-gray-100 to-gray-50' },
  generic: { icon: Package, gradient: 'from-gray-100 to-gray-50' },
};

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, type = 'generic' }) => {
  const config = typeConfig[type] || typeConfig.generic;
  const Icon = icon || config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fadeIn">
      {/* Illustration Circle */}
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

export default EmptyState;
