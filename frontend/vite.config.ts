import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    // แก้ตรงนี้: เอา https:// ออก ให้เหลือแค่ชื่อโดเมน
    allowedHosts: (process.env.VITE_ALLOWED_HOSTS || 'f314-49-228-184-149.ngrok-free.app')
      .split(',')
      .map(host => host.trim())
      .filter(Boolean),
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          router: ['@tanstack/react-router'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});