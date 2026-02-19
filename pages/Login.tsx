import React, { useState } from 'react';
import { COLORS } from '../constants';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { StorageService } from '../services/storage';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
        const user = await StorageService.verifyCredentials(username, password);
        if (user) {
            sessionStorage.setItem('nhw_user', username);
            onLogin();
        } else {
            setError('Invalid username or password');
        }
    } catch (err) {
        setError('Login failed. Please try again.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: COLORS.cream }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div 
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: COLORS.cream, color: COLORS.mediumGreen }}
          >
            <ShieldCheck size={32} />
          </div>
          <h1 
            className="text-2xl font-bold mb-2"
            style={{ color: COLORS.darkText }}
          >
            Natural Health World
          </h1>
          <p className="text-gray-500">Sign in to access the system</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:outline-none transition-all"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-opacity-50 focus:outline-none transition-all"
              style={{ '--tw-ring-color': COLORS.sageGreen } as React.CSSProperties}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-white font-semibold shadow-md hover:shadow-lg transition-all transform active:scale-95 flex justify-center items-center"
            style={{ backgroundColor: COLORS.mediumGreen }}
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Login'}
          </button>
        </form>
        <p className="text-xs text-center text-gray-400 mt-4">Default: admin / admin123</p>
      </div>
    </div>
  );
};

export default Login;