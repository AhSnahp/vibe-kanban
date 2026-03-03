import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import path from 'path';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('0.1.0'),
  },
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: false,
    }),
    react(),
  ],
  resolve: {
    alias: [
      {
        find: '@cc',
        replacement: path.resolve(__dirname, 'src'),
      },
      {
        find: /^@\//,
        replacement: `${path.resolve(__dirname, '../web-core/src')}/`,
      },
      {
        find: 'shared',
        replacement: path.resolve(__dirname, '../../shared'),
      },
    ],
  },
  server: {
    port: parseInt(process.env.FRONTEND_PORT || '3002'),
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.BACKEND_PORT || '3003'}`,
        changeOrigin: true,
        ws: true,
      },
      '/v1': {
        target: `http://localhost:${process.env.BACKEND_PORT || '3003'}`,
        changeOrigin: true,
      },
    },
    fs: {
      allow: [path.resolve(__dirname, '.'), path.resolve(__dirname, '../..')],
    },
  },
  build: { sourcemap: true },
});
