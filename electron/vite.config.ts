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
      // release/ 是 electron-builder 打包产物；Windows 杀软对其瞬时加锁会让
      // chokidar 的 fs.watch 抛 EBUSY 直接杀死 dev server，且无需 HMR 监视。
      watch: process.env.DISABLE_HMR === 'true'
        ? null
        : { ignored: [path.resolve(__dirname, 'release') + '/**'] },
    },
  };
});
