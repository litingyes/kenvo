import { defineConfig } from 'vite-plus'

export default defineConfig({
  clearScreen: false,
  server: {
    port: 31420,
    strictPort: true,
    host: false,
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
    ignorePatterns: ['apps/desktop/src/routeTree.gen.ts'],
  },
  fmt: {
    semi: false,
    singleQuote: true,
    sortImports: true,
    sortPackageJson: true,
    sortTailwindcss: {
      stylesheet: './apps/desktop/src/root.css',
    },
    ignorePatterns: ['apps/desktop/src/routeTree.gen.ts'],
  },
  staged: {
    '*': 'vp check --fix',
  },
})
