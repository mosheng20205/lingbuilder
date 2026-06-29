import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3001,
      strictPort: true,
      hmr: process.env.DISABLE_HMR !== 'true' ? { port: 24679 } : false,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
