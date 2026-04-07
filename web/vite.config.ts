import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

/** Proxy API requests to the backend but let browser navigations fall through to index.html. */
function apiProxy(_route: string): ProxyOptions {
  return {
    target: 'https://localhost:5001',
    changeOrigin: true,
    secure: false,
    bypass(req) {
      if ((req.headers.accept as string | undefined)?.includes('text/html')) {
        return '/index.html'
      }
    },
  }
}

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
      '/auth': apiProxy('/auth'),
      '/users': apiProxy('/users'),
      '/trainer': apiProxy('/trainer'),
      '/swagger': apiProxy('/swagger'),
      '/foods': apiProxy('/foods'),
      '/nutrition': apiProxy('/nutrition'),
      '/recipes': apiProxy('/recipes'),
      '/client': apiProxy('/client'),
      '/exercises': apiProxy('/exercises'),
      '/training': apiProxy('/training'),
      '/conversations': apiProxy('/conversations'),
      '/hubs': {
        target: 'https://localhost:5001',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
