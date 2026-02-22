import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/static/',

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
    }
  },

  build: {
    outDir: 'terminal/static/js',
    emptyOutDir: false,
    cssCodeSplit: false,  // Inline CSS into JS bundle for simpler Django integration

    rollupOptions: {
      input: {
        'test-panel': './src/entries/TestPanel.tsx',
        'shared-console': './src/entries/SharedConsole.tsx',
        'gm-console': './src/entries/GMConsole.tsx',
        'player-console': './src/entries/PlayerConsole.tsx',
      },

      output: {
        entryFileNames: '[name].bundle.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',  // No hash for easier Django static file handling
      }
    },

    minify: 'terser',
    sourcemap: true,
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Force chunk flushing for SSE — prevents Vite's http-proxy from buffering
            // the text/event-stream response before forwarding to the browser
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              proxyRes.headers['x-accel-buffering'] = 'no';
            }
          });
        },
      },
      '/gmconsole': 'http://127.0.0.1:8000',
    }
  }
})
