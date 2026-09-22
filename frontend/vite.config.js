import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: 'localhost',
    hmr: {
      host: 'localhost',
      protocol: 'ws',
      port: 5173,
    },
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
