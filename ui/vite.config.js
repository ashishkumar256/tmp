// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from "@sentry/vite-plugin"

export default defineConfig({
  build: {
    sourcemap: true, // ✅ Required for source maps
  },
  plugins: [
    react(),
    sentryVitePlugin({
      url: process.env.VITE_SENTRY_URL,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.VITE_SENTRY_ORG,
      project: process.env.VITE_SENTRY_PROJECT,
      release: { 
        name: process.env.VITE_RELEASE_NAME,
        dist: process.env.VITE_SENTRY_DIST,
      },
      cleanArtifacts: true,
    }),
  ],
  server: {
    host: true,
    port: 3000,
    allowedHosts: true,
    cors: true,
    hmr: {
      protocol: 'wss'
    }
  },
  preview: {
    port: 3000,
    host: true,
    allowedHosts: true
  }
})