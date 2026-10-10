import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
  build: {
    rolldownOptions: {
      output: {
        // Libraries in their own chunks: they rarely change, so the phone keeps
        // them cached across deploys and only downloads the app code again.
        codeSplitting: {
          groups: [
            { name: 'charts', test: /node_modules[\/](recharts|d3-|victory-vendor|es-toolkit|decimal\.js|immer|reselect|@reduxjs|react-redux|redux|use-sync-external-store|eventemitter3|tiny-invariant)/ },
            { name: 'react', test: /node_modules[\/](react|react-dom|react-router|scheduler|cookie|set-cookie-parser)[\/]/ },
          ],
        },
      },
    },
  },
})
