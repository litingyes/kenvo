import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  outDir: 'dist',
  dts: false,
  // Single-file bundle: every dependency is inlined (was tsup noExternal).
  deps: { alwaysBundle: [/.*/] },
  // extraResources copies dist/ only (no package.json), so the entry must
  // carry an explicit ESM extension for `node`/`fork()` to load it as ESM.
  outExtensions: () => ({ js: '.mjs' }),
  // Ship the built-in SKILL.md files next to the bundle.
  copy: ['skills'],
})
