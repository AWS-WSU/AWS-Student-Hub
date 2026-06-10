import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ClientRequest } from 'node:http';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
        timeout: 10000,
        configure: (proxy) => {
          proxy.on('error', (err: Error) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq: ClientRequest, req: IncomingMessage) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on(
            'proxyRes',
            (proxyRes: IncomingMessage, req: IncomingMessage, _res: ServerResponse) => {
              console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
            }
          );
        },
      },
    },
  },
});
