import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    allowedHosts: [
      '0.0.0.0'
    ],
    // Alternative: allow all hosts
    allowedHosts: true,
    cors: true,
    hmr: {
      host: 'localhost',
      protocol: 'ws'
    }
  },
  preview: {
    port: 3000,
    host: true,
    allowedHosts: true
  }
})
