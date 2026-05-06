import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // VITE_BASE_PATH=/ for Vercel; /Trading-Trip/ for GitHub Pages (set in CI)
  base: mode === 'production' ? (process.env.VITE_BASE_PATH || '/Trading-Trip/') : '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
}));
