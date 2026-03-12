// React core plus the specific hooks used throughout this file
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
// lucide-react icons used to visually distinguish each toast type
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

// --- Types ---
// The four severity levels a toast notification can have
type ToastType = 'success' | 'error' | 'warning' | 'info';

// Data structure for a single toast notification displayed on screen
interface Toast {
  id: string;        // Unique identifier used to locate and dismiss the toast (e.g. "toast_1709...ab3")
  type: ToastType;   // Severity level controls colour scheme and icon
  title: string;     // Primary bold heading shown inside the toast card
  message?: string;  // Optional secondary description line below the title
  duration?: number; // How long (ms) the toast stays visible before auto-dismissing; 0 = persistent
}

// Configuration options passed to the confirm() method to build a modal dialog
interface ConfirmOptions {
  title: string;          // Modal heading text (e.g. "Delete product?")
  message: string;        // Body text explaining the action and its consequences
  confirmText?: string;   // Label for the confirm button (defaults to "Confirm")
  cancelText?: string;    // Label for the cancel button (defaults to "Cancel")
  danger?: boolean;       // When true, styles the confirm button red to signal a destructive action
  /** If set, user must type this string to confirm */
  requiredInput?: string; // When provided, the confirm button is disabled until the user types this exact string
}

// The value shape exposed through ToastContext — all methods consumers can call
interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void; // Generic toast creator
  success: (title: string, message?: string) => void;  // Shorthand for showToast('success', ...)
  error: (title: string, message?: string) => void;    // Shorthand with a longer 6 s duration
  warning: (title: string, message?: string) => void;  // Shorthand with a 5 s duration
  info: (title: string, message?: string) => void;     // Shorthand for informational messages
  confirm: (options: ConfirmOptions) => Promise<boolean>; // Shows a blocking modal; resolves true/false
}

// The React context that distributes toast functions to all descendant components
const ToastContext = createContext<ToastContextType | null>(null);

// Custom hook — call this inside any component to access all toast/confirm methods
export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext); // Read the context value set by the nearest ToastProvider
  if (!ctx) throw new Error('useToast must be used within ToastProvider'); // Guard: crash early with a clear message
  return ctx; // Return the context value if the hook is used correctly
};

// --- Icons ---
// Maps each toast type to the lucide-react icon component that best represents it
const iconMap: Record<ToastType, React.ElementType> = {
  success: CheckCircle,    // Green check circle — action completed successfully
  error: XCircle,          // Red X circle — something went wrong
  warning: AlertTriangle,  // Amber triangle — requires attention but not a failure
  info: Info,              // Blue info circle — neutral informational message
};

// Maps each toast type to Tailwind CSS colour classes for background, border, icon and text
const colorMap: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: {
    bg: 'bg-green-50',        // Light green card background
    border: 'border-green-400', // Green left/full border accent
    icon: 'text-green-500',    // Icon colour
    text: 'text-green-800',    // Title and message text colour
  },
  error: {
    bg: 'bg-red-50',          // Light red card background for errors
    border: 'border-red-400',
    icon: 'text-red-500',
    text: 'text-red-800',
  },
  warning: {
    bg: 'bg-amber-50',         // Amber tones for warnings
    border: 'border-amber-400',
    icon: 'text-amber-500',
    text: 'text-amber-800',
  },
  info: {
    bg: 'bg-blue-50',          // Blue tones for informational toasts
    border: 'border-blue-400',
    icon: 'text-blue-500',
    text: 'text-blue-800',
  },
};

// --- Toast Item (single toast) ---
// Renders one toast card; handles its own auto-dismiss timer and exit animation
const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false); // When true, slide-out transition plays before removal

  useEffect(() => {
    const duration = toast.duration ?? 4000; // Default auto-dismiss time is 4 000 ms (4 seconds)
    if (duration <= 0) return; // Zero or negative duration means the toast is persistent — skip timer
    // Start a timer to trigger the exit animation, then remove the toast after it completes
    const timer = setTimeout(() => {
      setIsExiting(true); // Begin the slide-out CSS transition
      setTimeout(() => onDismiss(toast.id), 300); // After 300 ms animation, remove the toast from state
    }, duration);
    return () => clearTimeout(timer); // Clean up the timer if the toast is dismissed manually first
  }, [toast.id, toast.duration, onDismiss]); // Re-run only if the toast identity or duration changes

  // Manual close: same two-step animation as the auto-dismiss timer
  const handleDismiss = () => {
    setIsExiting(true); // Start the exit animation
    setTimeout(() => onDismiss(toast.id), 300); // Remove after the 300 ms transition finishes
  };

  const Icon = iconMap[toast.type];    // Pick the lucide icon for this toast's severity
  const colors = colorMap[toast.type]; // Pick the Tailwind colour classes for this toast's severity

  return (
    <div
      className={`flex items-start gap-3 w-80 p-4 rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-300 ${colors.bg} ${colors.border} ${
        isExiting ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0' // Slide right and fade on exit
      }`}
      style={{ animation: isExiting ? undefined : 'slideInRight 0.3s ease-out' }} // Entry animation (keyframe defined in provider)
    >
      {/* Severity icon — mt-0.5 vertically aligns it with the title text */}
      <Icon size={20} className={`mt-0.5 flex-shrink-0 ${colors.icon}`} />
      {/* Text block: title (bold) and optional message (smaller, lighter) */}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${colors.text}`}>{toast.title}</p>
        {toast.message && ( // Only render the message paragraph if a message was provided
          <p className={`text-xs mt-0.5 opacity-80 ${colors.text}`}>{toast.message}</p>
        )}
      </div>
      {/* Close button — opacity dims until hovered to keep the UI clean */}
      <button onClick={handleDismiss} className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity">
        <X size={14} className={colors.text} />
      </button>
    </div>
  );
};

// --- Confirm Modal ---
// A blocking modal dialog that resolves a Promise<boolean> with the user's choice
const ConfirmModal: React.FC<{
  options: ConfirmOptions;          // Configuration: title, message, button labels, danger flag, required text
  onResolve: (result: boolean) => void; // Callback invoked when the user clicks Confirm (true) or Cancel (false)
}> = ({ options, onResolve }) => {
  const [inputValue, setInputValue] = useState(''); // Tracks what the user has typed in the required-input field
  const [isVisible, setIsVisible] = useState(false); // Controls the scale/opacity enter animation

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true)); // Defer one frame so the browser applies the initial state before animating
  }, []);

  // Trigger the exit animation, then resolve the promise after the transition completes
  const handleClose = (result: boolean) => {
    setIsVisible(false); // Begin the scale-down / fade-out transition
    setTimeout(() => onResolve(result), 200); // Wait for the 200 ms transition, then invoke the callback
  };

  // The confirm button is only enabled when requiredInput is satisfied (or not set)
  const canConfirm = options.requiredInput
    ? inputValue === options.requiredInput // User must type the exact required string
    : true; // No required input — button is always enabled

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center p-4 transition-all duration-200 ${
        isVisible ? 'bg-black/50 backdrop-blur-sm' : 'bg-transparent' // Fade in the backdrop
      }`}
      onClick={() => handleClose(false)} // Clicking the backdrop cancels the confirmation
    >
      {/* Modal card — centred, max-width 448 px, scale animation on enter/exit */}
      <div
        className={`bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-200 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0' // Scale up from slightly shrunken state
        }`}
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside the card from closing the modal
      >
        <div className="p-6">
          {/* Header: icon badge + title */}
          <div className="flex items-center gap-3 mb-3">
            {options.danger ? ( // Danger flag controls which colour icon badge to show
              <div className="p-2 rounded-full bg-red-100"> {/* Red badge for destructive actions */}
                <AlertTriangle size={20} className="text-red-500" />
              </div>
            ) : (
              <div className="p-2 rounded-full bg-blue-100"> {/* Blue badge for safe confirmations */}
                <Info size={20} className="text-blue-500" />
              </div>
            )}
            <h3 className="text-lg font-bold text-gray-800">{options.title}</h3> {/* Modal heading */}
          </div>
          {/* Body message — whitespace-pre-line respects newlines in the message string */}
          <p className="text-sm text-gray-600 ml-11 whitespace-pre-line">{options.message}</p>

          {/* Optional required-input field — only rendered when options.requiredInput is set */}
          {options.requiredInput && (
            <div className="mt-4 ml-11">
              {/* Instruction text showing the exact string the user must type */}
              <p className="text-xs text-gray-500 mb-2">
                Type <span className="font-bold font-mono text-red-600">{options.requiredInput}</span> to confirm:
              </p>
              {/* Controlled text input; autoFocus moves keyboard focus here immediately on open */}
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)} // Mirror typed value into controlled state
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                autoFocus // Immediately focus this input when the modal opens
                placeholder={`Type "${options.requiredInput}" here`} // Hint placeholder
              />
            </div>
          )}
        </div>
        {/* Footer: Cancel and Confirm buttons right-aligned */}
        <div className="flex justify-end gap-3 px-6 pb-6">
          {/* Cancel button — always neutral grey */}
          <button
            onClick={() => handleClose(false)} // Reject the confirmation
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {options.cancelText || 'Cancel'} {/* Use custom label or fall back to 'Cancel' */}
          </button>
          {/* Confirm button — red for danger actions, blue-green for safe ones; disabled when input not met */}
          <button
            onClick={() => handleClose(true)} // Approve the confirmation
            disabled={!canConfirm} // Disable until the required-input condition is satisfied
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              options.danger
                ? 'bg-red-600 hover:bg-red-700'   // Red for destructive actions
                : 'bg-green-600 hover:bg-green-700' // Green for safe actions
            }`}
          >
            {options.confirmText || 'Confirm'} {/* Use custom label or fall back to 'Confirm' */}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Provider ---
// Wraps the app (or a subtree) to supply all toast and confirm functionality via context
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]); // Array of currently visible toast notifications
  // When non-null, a confirm modal is shown; holds the options and the promise resolve callback
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;           // What to display in the modal
    resolve: (val: boolean) => void;   // Function to call with the user's yes/no answer
  } | null>(null);

  // Remove a toast from the visible list by its unique ID
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id)); // Return all toasts except the one being dismissed
  }, []);

  // Add a new toast to the visible list; trims to a maximum of 5 to prevent screen overflow
  const showToast = useCallback((type: ToastType, title: string, message?: string, duration?: number) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; // Unique ID: timestamp + 4 random chars
    setToasts((prev) => [...prev.slice(-4), { id, type, title, message, duration }]); // Keep max 5 toasts (slice keeps the latest 4, then appends the new one)
  }, []);

  // Shorthand helpers — each pre-fills the type and optionally a custom display duration
  const success = useCallback((title: string, message?: string) => showToast('success', title, message), [showToast]);
  const error = useCallback((title: string, message?: string) => showToast('error', title, message, 6000), [showToast]); // Errors stay 6 s
  const warning = useCallback((title: string, message?: string) => showToast('warning', title, message, 5000), [showToast]); // Warnings stay 5 s
  const info = useCallback((title: string, message?: string) => showToast('info', title, message), [showToast]);

  // Display a blocking modal and return a Promise that resolves when the user makes a choice
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ options, resolve }); // Store options + resolve so the modal can call it on close
    });
  }, []);

  // Called by the ConfirmModal when the user clicks Confirm or Cancel
  const handleConfirmResolve = useCallback((result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result); // Resolve the promise with the user's choice (true = confirmed)
      setConfirmState(null);        // Hide the modal by clearing confirmState
    }
  }, [confirmState]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, confirm }}>
      {children} {/* Render the rest of the application inside the provider */}

      {/* Toast Container — fixed top-right corner, above most UI (z-index 300) */}
      <div className="fixed top-4 right-4 z-[300] flex flex-col gap-3 pointer-events-none">
        {/* Render a ToastItem for each active notification */}
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto"> {/* Re-enable pointer events so toasts are clickable */}
            <ToastItem toast={t} onDismiss={dismissToast} />
          </div>
        ))}
      </div>

      {/* Confirm Modal Overlay — only rendered when a confirm() call is pending */}
      {confirmState && (
        <ConfirmModal options={confirmState.options} onResolve={handleConfirmResolve} />
      )}

      {/* Inject the slideInRight keyframe animation used by ToastItem's entry animation */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(1rem); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
};
