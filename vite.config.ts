// Import path module for file path resolution
import path from 'path';
// Import defineConfig and loadEnv from Vite
import { defineConfig, loadEnv } from 'vite';
// Import React plugin for Vite to handle React components
import react from '@vitejs/plugin-react';

// Reference to Tauri Vite configuration documentation
// https://v2.tauri.app/start/frontend/vite/
// Get the Tauri dev host from environment variables (if set)
const host = process.env.TAURI_DEV_HOST;

// Export default Vite configuration with mode-dependent settings
export default defineConfig(({ mode }) => {
    // Load environment variables for current mode
    const env = loadEnv(mode, '.', '');
    // Check if running in production mode
    const isProduction = mode === 'production';
    
    // Return configuration object
    return {
      // Set base path - use relative path for production, root for development
      base: isProduction ? './' : '/',

      // Tauri dev server configuration
      // Tauri dev server config
      server: {
        // Development server port number
        port: 3000,
        // Server host address (0.0.0.0 allows external connections)
        host: host || '0.0.0.0',
        // Fail if the port is already in use
        strictPort: true,
        // Hot module replacement configuration for Tauri
        hmr: host ? { protocol: 'ws', host, port: 3000 } : undefined,
      },

      // Tauri expects a fixed port, fail if busy
      // Clear terminal screen on build
      clearScreen: false,

      // Load React plugin for JSX and React optimization
      plugins: [react()],
      // Define global constant variables available to the application
      define: {
        // Expose Gemini API key as a constant (from env variables)
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        // Also expose under alternative name
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      // Module resolution configuration
      resolve: {
        // Path aliases for easier imports (@ refers to project root)
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },

      // Env variables starting with TAURI_ are exposed to the frontend
      // Specify which environment variables to expose to the client
      envPrefix: ['VITE_', 'TAURI_'],
    };
});
