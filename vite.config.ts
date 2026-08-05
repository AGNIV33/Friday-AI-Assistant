import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      hmr: true,
      watch: {
        ignored: ['**/.friday-data/**'],
      },
    },
    build: {
      // Split the vendor libraries out of the app bundle. They change far less
      // often than app code, so the browser can reuse them across rebuilds
      // instead of re-parsing a single ~1.3MB file on every startup.
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            'vendor-genai': ['@google/genai'],
            'vendor-motion': ['motion'],
          },
        },
      },
      // Mapbox alone is legitimately ~1.8MB and is already lazy-loaded, so the
      // default 500kB warning is just noise here.
      chunkSizeWarningLimit: 1000,
    },
    // Pre-bundle heavy deps so dev cold-start is faster
    optimizeDeps: {
      include: ['react', 'react-dom', 'motion', 'lucide-react', 'firebase/app', 'firebase/auth', 'firebase/firestore', '@google/genai'],
    },
  };
});
