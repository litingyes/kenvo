import path from 'path'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite-plus'

const host = process.env.TAURI_DEV_HOST

const stubNodeBuiltins: Plugin = {
  name: 'stub-node-builtins',
  enforce: 'pre',
  resolveId(id) {
    if (id === 'node:zlib' || id === 'zlib') {
      return '\0stub:zlib'
    }
  },
  load(id) {
    if (id === '\0stub:zlib') {
      const noop = '() => { throw new Error("node:zlib not available in browser") }'
      const funcs = [
        'gunzipSync',
        'gzipSync',
        'deflateSync',
        'inflateSync',
        'unzipSync',
        'deflateRawSync',
        'inflateRawSync',
        'brotliCompressSync',
        'brotliDecompressSync',
        'createGunzip',
        'createGzip',
        'createDeflate',
        'createInflate',
        'createUnzip',
        'createDeflateRaw',
        'createInflateRaw',
        'createBrotliCompress',
        'createBrotliDecompress',
        'deflate',
        'gzip',
        'gunzip',
        'inflate',
        'unzip',
        'deflateRaw',
        'inflateRaw',
        'brotliCompress',
        'brotliDecompress',
      ]
      const exports = funcs.map((f) => `export const ${f} = noop`).join('\n')
      return [
        `const noop = ${noop}`,
        exports,
        'export const constants = {}',
        'export default { ...Object.fromEntries([' +
          funcs.map((f) => `["${f}", noop]`).join(',') +
          ']), constants }',
      ].join('\n')
    }
  },
}

export default defineConfig({
  plugins: [
    stubNodeBuiltins,
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      routeFileIgnorePrefix: '-',
      quoteStyle: 'single',
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'just-bash': path.resolve(__dirname, './node_modules/just-bash/dist/bundle/browser.js'),
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
    jsPlugins: [
      {
        name: 'tanstack-router',
        specifier: '@tanstack/eslint-plugin-router',
      },
    ],
    ignorePatterns: ['./src/routeTree.gen.ts'],
  },
  fmt: {
    semi: false,
    singleQuote: true,
    sortImports: true,
    sortPackageJson: true,
    sortTailwindcss: {
      stylesheet: './src/root.css',
    },
    ignorePatterns: ['./src/routeTree.gen.ts'],
  },
  staged: {
    '*': 'vp check --fix',
  },
})
