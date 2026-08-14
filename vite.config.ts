import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import vuetify from 'vite-plugin-vuetify'

// GitHub Pages serves a project site from /<repo-name>/, so the built assets need
// that prefix. Override with BASE_URL when deploying to a custom domain, Netlify
// or Vercel, all of which serve from the root: BASE_URL=/ npm run build
const base = process.env.BASE_URL ?? '/my-trip-portfolio/'

export default defineConfig({
  base,
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    // Photo-heavy pages benefit from keeping Vuetify in its own cacheable chunk.
    rollupOptions: {
      output: {
        manualChunks: {
          vuetify: ['vuetify'],
        },
      },
    },
  },
})
