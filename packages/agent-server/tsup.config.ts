import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'cjs',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  noExternal: [/.*/],
  bundle: true,
})
