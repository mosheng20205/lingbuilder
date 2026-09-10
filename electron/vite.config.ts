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
      // 构建产物目录与 cmd 误重定向产生的 $null 垃圾文件均无需 HMR 监视；
      // Windows 杀软/写入进程对其瞬时加锁会让 chokidar 的 fs.watch 抛
      // EBUSY 直接杀死 dev server（2026-09-09 实测三连崩）。
      watch: process.env.DISABLE_HMR === 'true'
        ? null
        : {
            ignored: [
              path.resolve(__dirname, 'release') + '/**',
              path.resolve(__dirname, 'dist') + '/**',
              path.resolve(__dirname, 'dist-electron') + '/**',
              path.resolve(__dirname, 'build') + '/**',
              '**/$null'
            ]
          },
    },
  };
});
