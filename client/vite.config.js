import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // В dev режиме все /api запросы проксируются на сервер Node.js
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
