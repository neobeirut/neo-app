import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const BACKEND_TARGET = process.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5173,
    proxy: {
      '/api/pos': {
        target: BACKEND_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/api/branches': {
        target: BACKEND_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/api/delivery': {
        target: BACKEND_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      '@auth/create/react': '@hono/auth-js/react',
      '@auth/create': resolve(__dirname, 'web/src/__create/@auth/create.js'),
      '@/auth.js': resolve(__dirname, 'web/src/auth.js'),
      '@/auth.js': resolve(__dirname, 'web/src/auth.js'),
      '@': resolve(__dirname, 'web/src'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin/index.html')
      }
    }
  }
});
