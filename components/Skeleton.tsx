// Import React for component creation
import React from 'react';

// Comment block explaining the Skeleton component system
// Skeleton shimmer components for loading states.
/* ====================================================
   Skeleton shimmer components for loading states.
   Uses a CSS shimmer animation defined in style.css.
   ==================================================== */

// Define the shimmer animation class with gradient animation applied
const shimmerClass = 'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded';

// Generic skeleton block component
/** Generic skeleton block */
// Export generic Skeleton component for flexible sizing
export const Skeleton: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <div className={`${shimmerClass} ${className}`} style={style} />
);

// Skeleton component for stat cards on the Dashboard
/** Skeleton for stat cards on the Dashboard */
// Export skeleton for dashboard stat cards
export const StatCardSkeleton: React.FC = () => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
    <Skeleton className="w-14 h-14 rounded-full mr-4" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
    </div>
  </div>
);

/** Skeleton for the full Dashboard page */
export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-8">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
        <Skeleton className="h-5 w-48 mb-6" />
        <div className="flex items-end gap-3 h-64">
          {[40, 65, 50, 80, 55, 70, 45].map((h, i) => (
            <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80">
        <Skeleton className="h-5 w-36 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/** Skeleton for a table (Inventory, Invoices, etc.) */
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 6, cols = 5 }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    {/* Header */}
    <div className="bg-gray-50 px-4 py-3 flex gap-4">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="px-4 py-3 border-t border-gray-100 flex gap-4 items-center">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className="h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

/** Skeleton for customer cards grid */
export const CardGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-start mb-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
    ))}
  </div>
);

/** Skeleton for the Settings page */
export const SettingsSkeleton: React.FC = () => (
  <div className="space-y-6 max-w-4xl">
    <div className="flex gap-2 mb-6">
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-28 rounded-lg" />)}
    </div>
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded-lg mt-4" />
    </div>
  </div>
);

// Export Skeleton types as default
export default Skeleton;
