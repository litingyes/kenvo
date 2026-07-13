import path from 'path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
    plugins: [
      'eslint',
      'typescript',
      'unicorn',
      'react',
      'react-perf',
      'oxc',
      'import',
      'jsx-a11y',
      'promise',
    ],
  },
  fmt: {
    semi: false,
    singleQuote: true,
    sortImports: true,
    sortPackageJson: true,
    sortTailwindcss: {
      stylesheet: './src/root.css',
    },
  },
  staged: {
    '*': 'vp check --fix',
  },
})
