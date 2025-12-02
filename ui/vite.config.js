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
      // 🔑 Auth token from Sentry (set in .env, never commit directly)
      authToken: process.env.SENTRY_AUTH_TOKEN,

      // 🏢 Your Sentry organization slug
      org: "kumar-gn",

      // 📦 Your Sentry project slug
      project: "poc",

      // 📂 Path to built assets containing source maps
      include: "./dist/assets",

      // 🌍 Sentry SaaS URL (default is https://sentry.io/)
      url: "https://kumar-gn.sentry.io/",

      // 🔖 Release version (important for matching errors to source maps)
      release: { 
        name: process.env.VITE_RELEASE_NAME 
      },

      // 🧹 Optional: clean up old source maps before uploading
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