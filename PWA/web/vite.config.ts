import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const outDir = '../server/public'

/** Stamps the service worker with this build and the files to keep offline. */
function serviceWorker(): Plugin {
  return {
    name: 'garage-sw',
    apply: 'build',
    closeBundle() {
      const assets = readdirSync(join(outDir, 'assets')).map((f) => `/assets/${f}`)
      const files = ['/', '/manifest.webmanifest', '/roboto-latin.woff2', '/roboto-latin-ext.woff2', '/icon-192.png', '/badge.png', '/icon-512.png', '/garage_logo_dark.png', '/garage_logo_light.png', ...assets]
      const file = join(outDir, 'sw.js')
      const source = readFileSync(file, 'utf8')
        .replace('__BUILD__', String(Date.now()))
        .replace('__FILES__', JSON.stringify(files))
      writeFileSync(file, source)
    },
  }
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  build: { outDir, emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 1500 },
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:' + (process.env.API_PORT ?? '8080'),
    },
  },
})
