import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function apiDevPlugin() {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, 'http://localhost:3000');
        if (url.pathname.startsWith('/api/')) {
          const endpoint = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');

          // Buffer request body synchronously to prevent missing chunks during async import
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });

          req.on('end', async () => {
            let handlerModule = null;
            try {
              if (endpoint === 'join') {
                handlerModule = await import('./api/join.js');
              } else if (endpoint === 'state' || endpoint === 'leaderboard') {
                handlerModule = await import('./api/state.js');
              } else if (endpoint === 'submit-score') {
                handlerModule = await import('./api/submit-score.js');
              } else if (endpoint === 'reset') {
                handlerModule = await import('./api/reset.js');
              }
            } catch (err) {
              console.error('Failed to load API handler for', endpoint, err);
            }

            if (handlerModule && handlerModule.default) {
              try {
                req.body = body ? JSON.parse(body) : {};
              } catch (_) {
                req.body = body;
              }
              req.query = Object.fromEntries(url.searchParams.entries());

              res.status = function (code) {
                res.statusCode = code;
                return res;
              };
              res.json = function (data) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return res;
              };

              try {
                await handlerModule.default(req, res);
              } catch (handlerErr) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ status: 'error', message: handlerErr.message }));
              }
            } else {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'error', message: 'Not found' }));
            }
          });

          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), apiDevPlugin()],
  server: {
    port: 3000,
    host: true
  }
});
