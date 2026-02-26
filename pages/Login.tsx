import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import { useTheme } from '../services/theme';
import { Loader2, Lock } from 'lucide-react';
import { StorageService } from '../services/storage';
import { AuditLogService } from '../services/auditLog';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { isDark } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 2 * 60 * 1000; // 2 minutes

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;
  const isFormValid = username.trim().length > 0 && password.length >= 6;

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      if (Date.now() >= lockoutUntil) {
        setLockoutUntil(null);
        setAttempts(0);
        setError('');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Lockout check
    if (isLockedOut) {
      const secsLeft = Math.ceil((lockoutUntil! - Date.now()) / 1000);
      setError(`Too many failed attempts. Try again in ${secsLeft}s.`);
      return;
    }

    // Validate inputs
    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setError('Please enter your username.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    
    try {
        const user = await StorageService.verifyCredentials(trimmedUser, password);
        if (user) {
            setAttempts(0);
            sessionStorage.setItem('nhw_user', trimmedUser);
            AuditLogService.log('auth', 'User Login', `User "${trimmedUser}" logged in successfully`);
            onLogin();
        } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            AuditLogService.log('auth', 'Login Failed', `Failed login attempt for username "${trimmedUser}" (attempt ${newAttempts})`);
            if (newAttempts >= MAX_ATTEMPTS) {
              const until = Date.now() + LOCKOUT_DURATION_MS;
              setLockoutUntil(until);
              setError(`Too many failed attempts. Account locked for 2 minutes.`);
            } else {
              setError(`Invalid username or password. ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`);
            }
        }
    } catch (err) {
        console.error('Login error:', err);
        setError('Login failed. Please try again.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div 
      className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${isDark ? 'bg-gray-900' : ''}`}
      style={{ backgroundColor: isDark ? undefined : COLORS.cream }}
    >
      <div className={`rounded-2xl shadow-xl w-full max-w-md p-8 transition-colors duration-300 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="text-center mb-8">
          <img 
            src="/assets/logo.jpeg" 
            alt="Natural Health World" 
            className="w-24 h-24 rounded-2xl object-cover shadow-md mx-auto mb-4"
          />
          <h1 
            className={`text-2xl font-bold mb-2 ${isDark ? 'text-gray-100' : ''}`}
            style={{ color: isDark ? undefined : COLORS.darkText }}
          >
            Natural Health World
          </h1>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Sign in to access the system</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              disabled={isLockedOut}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:outline-none transition-all disabled:opacity-50 disabled:bg-gray-100"
              style={{ '--tw-ring-color': COLORS.sageGreen } as React.CSSProperties}
              placeholder="admin"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
              disabled={isLockedOut}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:outline-none transition-all disabled:opacity-50 disabled:bg-gray-100"
              style={{ '--tw-ring-color': COLORS.sageGreen } as React.CSSProperties}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded flex items-center justify-center gap-2">
              {isLockedOut && <Lock size={14} />}
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !isFormValid || isLockedOut}
            className="w-full py-3 rounded-lg text-white font-semibold shadow-md hover:shadow-lg transition-all transform active:scale-95 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            style={{ backgroundColor: COLORS.mediumGreen }}
          >
            {loading ? <Loader2 className="animate-spin" /> : isLockedOut ? 'Locked' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;