import React, { useState, useEffect } from 'react'; // React core + hooks for local state (useState) and side-effects/timers (useEffect)
import { COLORS } from '../constants';               // App-wide colour palette (sageGreen, mediumGreen, cream, etc.)
import { Loader2, Lock } from 'lucide-react';        // Lucide icons: spinning loader for the submit button and padlock for lockout state
import { StorageService } from '../services/storage'; // Unified storage service — provides verifyCredentials to authenticate against SQLite or IndexedDB
import { AuditLogService } from '../services/auditLog'; // Audit log service — records successful/failed login events for traceability

// Props contract for the Login component
interface LoginProps {
  onLogin: () => void; // Callback invoked by the parent (App.tsx) when authentication succeeds — triggers navigation to the main app
}

// Login page component — handles username/password form, brute-force lockout, and audit logging
// SHA-256 hash of the default 'admin123' password — used to detect if password was never changed
const DEFAULT_ADMIN_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');               // Controlled input value for the username field
  const [password, setPassword] = useState('');               // Controlled input value for the password field
  const [error, setError] = useState('');                     // Error message displayed below the form on failed login or lockout
  const [loading, setLoading] = useState(false);              // true while the async credential verification is in progress
  const [attempts, setAttempts] = useState(0);                // Running count of consecutive failed login attempts
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null); // Unix timestamp (ms) when the lockout expires; null = not locked out
  // Forced password change state — shown when admin logs in with default password
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const MAX_ATTEMPTS = 5;                          // Number of consecutive failures before the account is locked
  const LOCKOUT_DURATION_MS = 2 * 60 * 1000;      // Lockout duration = 2 minutes in milliseconds

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil; // true if a lockout is active and hasn't expired yet
  const isFormValid = username.trim().length > 0 && password.length >= 6; // true only when both fields meet minimum requirements

  // Countdown timer for lockout
  useEffect(() => {          // Side-effect: run a 1-second interval to auto-clear the lockout once time expires
    if (!lockoutUntil) return; // Skip setting up the interval if there is no active lockout
    const interval = setInterval(() => { // Check every second whether the lockout has expired
      if (Date.now() >= lockoutUntil) {  // Lockout time has passed
        setLockoutUntil(null);           // Clear the lockout timestamp — unlocks the form
        setAttempts(0);                  // Reset the failed attempts counter
        setError('');                    // Clear the lockout error message
      }
    }, 1000); // Poll every 1000 ms
    return () => clearInterval(interval); // Cleanup: stop the interval when the component unmounts or lockoutUntil changes
  }, [lockoutUntil]); // Re-run whenever lockoutUntil changes (new lockout set or cleared)

  const handleSubmit = async (e: React.FormEvent) => { // Form submit handler — async because credential verification may hit a SQLite DB
    e.preventDefault(); // Prevent the default browser form submission (page reload)
    setError('');        // Clear any previous error message before a new attempt

    // Lockout check
    if (isLockedOut) { // Reject immediately if still within the lockout window
      const secsLeft = Math.ceil((lockoutUntil! - Date.now()) / 1000); // Remaining lockout time in whole seconds
      setError(`Too many failed attempts. Try again in ${secsLeft}s.`); // Show countdown in the error message
      return; // Stop further processing — don't hit the DB while locked out
    }

    // Validate inputs
    const trimmedUser = username.trim(); // Strip leading/trailing whitespace from the username
    if (!trimmedUser) {                  // Guard: empty username after trimming
      setError('Please enter your username.');
      return;
    }
    if (password.length < 6) {           // Guard: password too short
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true); // Show the spinner on the submit button while verifying credentials
    
    try {
        const user = await StorageService.verifyCredentials(trimmedUser, password); // Hash the password and compare against stored hash in the DB
        if (user) { // Credentials matched — authentication successful
            setAttempts(0);                                                          // Reset failed attempts counter on success
            // Check if user is still using the default admin password
            if (user.username === 'admin' && user.passwordHash === DEFAULT_ADMIN_HASH) {
              setMustChangePassword(true); // Show forced password change form
              return;
            }
            sessionStorage.setItem('nhw_user', trimmedUser);                        // Persist the logged-in username for the session (cleared when the browser closes)
            AuditLogService.log('auth', 'User Login', `User "${trimmedUser}" logged in successfully`); // Record the successful login in the audit trail
            onLogin();                                                               // Notify the parent component to unlock the main app UI
        } else { // Credentials did not match — incorrect username or password
            const newAttempts = attempts + 1;                                        // Increment the failed attempts counter
            setAttempts(newAttempts);                                                // Update state with the new count
            AuditLogService.log('auth', 'Login Failed', `Failed login attempt for username "${trimmedUser}" (attempt ${newAttempts})`); // Log the failure for security audit
            if (newAttempts >= MAX_ATTEMPTS) { // Threshold reached — trigger lockout
              const until = Date.now() + LOCKOUT_DURATION_MS;                       // Compute the lockout expiry timestamp
              setLockoutUntil(until);                                                // Activate the lockout
              setError(`Too many failed attempts. Account locked for 2 minutes.`);  // Inform the user they are locked out
            } else { // Still below threshold — show remaining attempts
              setError(`Invalid username or password. ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`);
            }
        }
    } catch (err) {
        console.error('Login error:', err);            // Log unexpected errors to the console for debugging
        setError('Login failed. Please try again.');   // Generic error message for the user
    } finally {
        setLoading(false); // Always hide the spinner when the async operation completes (success or failure)
    }
  };

  // Handler for forced password change after first login with default credentials
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword === 'admin123') {
      setError('Please choose a different password than the default.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setChangingPassword(true);
    try {
      const hash = await StorageService.hashPassword(newPassword);
      await StorageService.saveUser({ username: 'admin', passwordHash: hash, role: 'admin', lastLogin: new Date().toISOString() });
      AuditLogService.log('auth', 'Password Changed', 'Admin changed default password on first login');
      sessionStorage.setItem('nhw_user', 'admin');
      AuditLogService.log('auth', 'User Login', 'User "admin" logged in successfully');
      onLogin();
    } catch (err) {
      console.error('Password change error:', err);
      setError('Failed to change password. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: COLORS.cream }}
    >
      <div className="rounded-2xl shadow-xl w-full max-w-md p-8 bg-white">
        <div className="text-center mb-8">
          <img 
            src="/assets/logo.jpeg"
            alt="Natural Health World"
            className="w-24 h-24 rounded-2xl object-cover shadow-md mx-auto mb-4"
          />
          <h1 
            className="text-2xl font-bold mb-2"
            style={{ color: COLORS.darkText }}
          >
            Natural Health World
          </h1>
          <p className="text-gray-500">
            {mustChangePassword ? 'Please set a new password to continue' : 'Sign in to access the system'}
          </p>
        </div>

        {mustChangePassword ? (
          <form onSubmit={handlePasswordChange} className="space-y-6" noValidate>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>Security Notice:</strong> You are using the default password. Please change it now to secure your account.
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:outline-none transition-all"
                style={{ '--tw-ring-color': COLORS.sageGreen } as React.CSSProperties}
                placeholder="Enter new password (min 6 chars)"
                minLength={6}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:outline-none transition-all"
                style={{ '--tw-ring-color': COLORS.sageGreen } as React.CSSProperties}
                placeholder="Re-enter new password"
                minLength={6}
              />
            </div>
            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</div>
            )}
            <button
              type="submit"
              disabled={changingPassword || newPassword.length < 6 || confirmPassword.length < 6}
              className="w-full py-3 rounded-lg text-white font-semibold shadow-md hover:shadow-lg transition-all transform active:scale-95 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: COLORS.mediumGreen }}
            >
              {changingPassword ? <Loader2 className="animate-spin" /> : 'Set New Password & Login'}
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6" noValidate> {/* Login form; noValidate disables browser built-in validation so we control errors */}
          <div> {/* Username field group */}
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label> {/* Visible label for accessibility */}
            <input
              type="text"                                // Plain text input (not password masked)
              value={username}                           // Controlled: value driven by state
              onChange={(e) => setUsername(e.target.value)} // Update state on every keystroke
              required                                   // HTML attribute for form validation semantics
              autoComplete="username"                    // Hint to browsers to offer saved usernames
              disabled={isLockedOut}                     // Grey out field during lockout
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:outline-none transition-all disabled:opacity-50 disabled:bg-gray-100" // Full-width rounded input with focus ring
              style={{ '--tw-ring-color': COLORS.sageGreen } as React.CSSProperties} // Override Tailwind's ring colour with brand sage green
              placeholder="admin"                        // Hint showing the default username
            />
          </div>
          <div> {/* Password field group */}
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label> {/* Visible label for accessibility */}
            <input
              type="password"                            // Password input — masks characters
              value={password}                           // Controlled: value driven by state
              onChange={(e) => setPassword(e.target.value)} // Update state on every keystroke
              required                                   // HTML attribute for form validation semantics
              minLength={6}                              // HTML min-length attribute (also validated in handleSubmit)
              autoComplete="current-password"            // Hint to browsers to offer saved passwords
              disabled={isLockedOut}                     // Grey out field during lockout
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:outline-none transition-all disabled:opacity-50 disabled:bg-gray-100" // Full-width rounded input with focus ring
              style={{ '--tw-ring-color': COLORS.sageGreen } as React.CSSProperties} // Override Tailwind's ring colour with brand sage green
              placeholder="••••••••"                     // Masked placeholder dots
            />
          </div>

          {error && ( // Conditionally render the error message block only when there is an error
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded flex items-center justify-center gap-2"> {/* Red alert box */}
              {isLockedOut && <Lock size={14} />} {/* Show padlock icon only when account is locked */}
              {error} {/* The error message text */}
            </div>
          )}

          <button
            type="submit"                      // Submit the form when clicked
            disabled={loading || !isFormValid || isLockedOut} // Disable during loading, invalid input, or lockout
            className="w-full py-3 rounded-lg text-white font-semibold shadow-md hover:shadow-lg transition-all transform active:scale-95 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none" // Full-width green submit button with press animation
            style={{ backgroundColor: COLORS.mediumGreen }} // Brand medium green background
          >
            {loading ? <Loader2 className="animate-spin" /> : isLockedOut ? 'Locked' : 'Login'} {/* Spinner while loading, "Locked" text during lockout, "Login" otherwise */}
          </button>
        </form>
        )}
      </div>
    </div>
  );
};

export default Login; // Export the Login component as the default export for use in App.tsx routing