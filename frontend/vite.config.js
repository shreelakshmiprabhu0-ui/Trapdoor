import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api calls are forwarded to the Express gateway (Student B).
// The browser only ever talks to one origin, so cookies and CORS stay simple.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
});
