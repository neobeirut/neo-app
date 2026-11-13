import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/new/pos/',
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  },
  server: {
    port: 4173,
    host: true,
    hmr: {
      clientPort: 4173
    },
    proxy: {
      '/api': {
        target: 'https://ovrload-backend-production.up.railway.app',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  preview: {
    port: 4173,
    host: true
  },
  build: {
    target: 'es2018',
    outDir: resolve(__dirname, '../dist/new/pos'),
    emptyOutDir: true
  }
});
