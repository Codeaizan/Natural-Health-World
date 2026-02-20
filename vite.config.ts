import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://v2.tauri.app/start/frontend/vite/
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    
    return {
      base: isProduction ? './' : '/',

      // Tauri dev server config
      server: {
        port: 3000,
        host: host || '0.0.0.0',
        strictPort: true,
        hmr: host ? { protocol: 'ws', host, port: 3000 } : undefined,
      },

      // Tauri expects a fixed port, fail if busy
      clearScreen: false,

      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },

      // Env variables starting with TAURI_ are exposed to the frontend
      envPrefix: ['VITE_', 'TAURI_'],
    };
});
