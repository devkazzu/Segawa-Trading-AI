import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// GitHub Pages serves the app from /<repo>/, the APK & local dev from /.
const base = process.env.VITE_BASE_PATH || (process.env.GITHUB_ACTIONS ? '/Segawa-Trading-AI/' : '/');

export default defineConfig({
  base,
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // The sandbox proxies previews through a generated *.e2b.app hostname, so host
  // checking must accept it. Keep origin strictness for API traffic elsewhere.
  server: { host: '0.0.0.0', port: 5173, strictPort: false, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          supabase: ['@supabase/supabase-js'],
          pdf: ['jspdf'],
        },
      },
    },
  },
});
