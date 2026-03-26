import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

/** Proxy API requests to the backend but let browser navigations fall through to index.html. */
function apiProxy(route: string) {
  return {
    target: 'https://localhost:5001',
    changeOrigin: true,
    secure: false,
    bypass(req: { headers: Record<string, string | undefined> }) {
      if (req.headers.accept?.includes('text/html')) {
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
    },
  },
})
