import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': {
        target: 'https://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/users': {
        target: 'https://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/trainer': {
        target: 'https://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/swagger': {
        target: 'https://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
