import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { verifyBrowserLicenses } from './scripts/browser-license-packages.mjs'

function gitVersion(): string {
  try {
    return execFileSync('git', ['describe', '--always', '--tags', '--dirty'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'unavailable'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), verifyBrowserLicenses(import.meta.dirname)],
  build: {
    rolldownOptions: {
      input: {
        studio: resolve(import.meta.dirname, 'index.html'),
        licenses: resolve(import.meta.dirname, 'licenses.html'),
      },
    },
  },
  define: {
    'import.meta.env.VITE_GIT_VERSION': JSON.stringify(gitVersion()),
  },
})
