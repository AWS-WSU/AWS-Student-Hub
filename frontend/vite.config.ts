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
            console.log('proxy error.', err);
          });
          proxy.on('proxyReq', (proxyReq: ClientRequest, req: IncomingMessage) => {
            console.log('sending request to the target.', req.method, req.url);
          });
          proxy.on(
            'proxyRes',
            (proxyRes: IncomingMessage, req: IncomingMessage, _res: ServerResponse) => {
              console.log('received response from the target.', proxyRes.statusCode, req.url);
            }
          );
        },
      },
    },
  },
});
