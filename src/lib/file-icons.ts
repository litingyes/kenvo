// File icon mapping backed by catppuccin mocha svg set (see src/assets/icons/file-icons).
// Uses Vite's import.meta.glob to load every svg as a URL up-front.

const modules = import.meta.glob('../assets/icons/file-icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const urlMap: Record<string, string> = {}
for (const [path, url] of Object.entries(modules)) {
  const base = path
    .split('/')
    .pop()!
    .replace(/\.svg$/, '')
  urlMap[base] = url
}

const EXT_MAP: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  css: 'css',
  scss: 'sass',
  sass: 'sass',
  html: 'html',
  htm: 'html',
  vue: 'vue',
  svelte: 'svelte',
  astro: 'astro',
  md: 'markdown',
  markdown: 'markdown',
  py: 'python',
  pyi: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  dart: 'dart',
  rb: 'ruby',
  php: 'php',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  sql: 'squirrel',
  graphql: 'graphql',
  gql: 'graphql',
  proto: 'proto',
  lua: 'lua',
  ex: 'elixir',
  exs: 'elixir',
  hs: 'haskell',
  scala: 'scala',
  sc: 'scala',
  r: 'r',
  jinja: 'jinja',
  j2: 'jinja',
  conf: 'nginx',
}

const NAME_MAP: Record<string, string> = {
  '.gitignore': 'git',
  '.gitattributes': 'git',
  '.gitmodules': 'git',
  '.env': 'env',
  '.env.local': 'env',
  '.env.production': 'env',
  '.env.development': 'env',
  license: 'license',
  'license.md': 'license',
  'license.txt': 'license',
  'readme.md': 'readme',
  readme: 'readme',
  'readme.txt': 'readme',
  'changelog.md': 'changelog',
  changelog: 'changelog',
  'todo.md': 'todo',
  '.editorconfig': 'editorconfig',
  'package.json': 'package-json',
  'package-lock.json': 'lock',
  'bun.lock': 'lock',
  'bun.lockb': 'lock',
  'cargo.lock': 'lock',
  'deno.lock': 'lock',
  'yarn.lock': 'lock',
  'pnpm-lock.yaml': 'lock',
  dockerfile: 'docker',
  '.dockerignore': 'docker',
  'docker-compose.yml': 'docker',
  'docker-compose.yaml': 'docker',
}

const FOLDER_MAP: Record<string, { collapsed: string; expanded: string }> = {
  src: { collapsed: 'folder_src', expanded: 'folder_src_open' },
  components: { collapsed: 'folder_components', expanded: 'folder_components_open' },
  assets: { collapsed: 'folder_assets', expanded: 'folder_assets_open' },
  '.git': { collapsed: 'folder_git', expanded: 'folder_git_open' },
  node_modules: { collapsed: 'folder_node', expanded: 'folder_node_open' },
}

const FALLBACK_FILE = '_file'
const FALLBACK_FOLDER = { collapsed: '_folder', expanded: '_folder_open' }

function resolveIcon(name: string): string | undefined {
  return urlMap[name]
}

export function getFileIconUrl(name: string): string {
  const lower = name.toLowerCase()
  if (NAME_MAP[lower]) {
    const u = resolveIcon(NAME_MAP[lower]!)
    if (u) return u
  }
  const dotIdx = lower.lastIndexOf('.')
  if (dotIdx >= 0 && dotIdx < lower.length - 1) {
    const ext = lower.slice(dotIdx + 1)
    const mapped = EXT_MAP[ext]
    if (mapped) {
      const u = resolveIcon(mapped)
      if (u) return u
    }
  }
  return resolveIcon(FALLBACK_FILE) ?? ''
}

export function getFolderIconUrl(name: string, expanded: boolean): string {
  const lower = name.toLowerCase()
  const special = FOLDER_MAP[lower]
  if (special) {
    const u = resolveIcon(expanded ? special.expanded : special.collapsed)
    if (u) return u
  }
  return resolveIcon(expanded ? FALLBACK_FOLDER.expanded : FALLBACK_FOLDER.collapsed) ?? ''
}

export function getRootIconUrl(expanded: boolean): string {
  return resolveIcon(expanded ? '_root_open' : '_root') ?? ''
}
