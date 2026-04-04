import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: mode === 'lighthouse'
    ? {
        hmr: false,
      }
    : undefined,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('@clerk/clerk-react')) {
            return 'vendor-clerk'
          }

          if (id.includes('/react-leaflet/') || id.includes('/leaflet/')) {
            return 'vendor-leaflet'
          }

          if (id.includes('/lucide-react/')) {
            return 'vendor-icons'
          }

          if (id.includes('/axios/')) {
            return 'vendor-http'
          }

          if (
            id.includes('/react/')
            || id.includes('/react-dom/')
            || id.includes('/react-router-dom/')
            || id.includes('/react-router/')
          ) {
            return 'vendor-react'
          }

          return undefined
        },
      },
    },
  },
}))
