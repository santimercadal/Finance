import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Service worker: the app shell opens instantly from the phone's cache and
    // the last API answers are shown while a slow (sleeping) server responds.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: false, // public/manifest.webmanifest is used as is
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // A new deploy takes over right away (registerSW then reloads the page once).
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Workbox copies this function's source into sw.js, so it can't use outer variables.
            // Skipped: auth, health and live AI usage must hit the server; SEC filings are too big.
            urlPattern: ({ url, request, sameOrigin }) =>
              sameOrigin && request.method === 'GET' && url.pathname.startsWith('/api/') &&
              !/^\/api\/(health|auth|ai\/usage|filing)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 3 * 86_400 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 86_400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
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
