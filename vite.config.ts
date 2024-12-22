import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
// @ts-ignore
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    react(),
    // @ts-ignore
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: {
        // Include your service worker files
        'service-worker': 'src/service-worker.js',
        'service-worker-loader': 'src/service-worker-loader.js',
        'extract-text': 'src/extract-text.ts'
      },
      output: {
        entryFileNames: 'assets/[name].js'
      }
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
})