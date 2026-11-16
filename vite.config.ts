import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { handleReplenishmentAiRequest } from './api/replenishment-ai.js';
import { handleAiAssistantRequest } from './api/ai-assistant-server.js';

function aiAssistantBackendPlugin() {
  const attachMiddleware = (middlewares: any) => {
    middlewares.use('/api/ai/orchestrate', (req: any, res: any) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }
      let raw = '';
      req.on('data', (chunk: any) => {
        raw += chunk;
      });
      req.on('end', async () => {
        try {
          const body = raw ? JSON.parse(raw) : {};
          const result = await handleAiAssistantRequest(body);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, data: result }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err?.message || 'Server-side AI orchestration error' }));
        }
      });
    });
  };

  return {
    name: 'ai-assistant-backend',
    configureServer(server: any) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server: any) {
      attachMiddleware(server.middlewares);
    },
  };
}

function replenishmentAiBackendPlugin() {
  const attachMiddleware = (middlewares: any) => {
    middlewares.use('/api/replenishment-ai', (req: any, res: any) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }
      let raw = '';
      req.on('data', (chunk: any) => {
        raw += chunk;
      });
      req.on('end', async () => {
        try {
          const body = raw ? JSON.parse(raw) : {};
          const result = await handleReplenishmentAiRequest(body);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, data: result }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err?.message || 'Backend AI error' }));
        }
      });
    });
  };

  return {
    name: 'replenishment-ai-backend',
    configureServer(server: any) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server: any) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), replenishmentAiBackendPlugin(), aiAssistantBackendPlugin()],
  base: '/',
  server: {
    port: 5174,
    strictPort: true,
    host: true
  },
  preview: {
    port: 5174,
    strictPort: true,
    host: true
  },
  resolve: {
    alias: {
      '@auth/create/react': '@hono/auth-js/react',
      '@auth/create': resolve(__dirname, 'web/src/__create/@auth/create.js'),
      '@/auth.js': resolve(__dirname, 'web/src/auth.js'),
      '@': resolve(__dirname, 'web/src'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        newLanding: resolve(__dirname, 'new/index.html'),
        newAdmin: resolve(__dirname, 'new/admin/index.html')
      }
    }
  }
});
