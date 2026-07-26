// Maps file extensions to Monaco language ids.
// Keep it pragmatic: cover the common source/text formats first.
const EXT_TO_LANGUAGE: Record<string, string> = {
  // JavaScript / TypeScript
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'typescript',

  // Web
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  json: 'json',
  jsonc: 'jsonc',

  // Markdown
  md: 'markdown',
  mdx: 'markdown',

  // Config / data
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  svg: 'xml',
  env: 'shell',

  // Shell
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  fish: 'shell',
  ps1: 'powershell',

  // Python
  py: 'python',
  pyi: 'python',
  pyw: 'python',

  // Systems
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  h: 'c',
  hpp: 'cpp',
  go: 'go',
  rs: 'rust',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  java: 'java',
  scala: 'scala',
  groovy: 'groovy',
  cs: 'csharp',
  fs: 'fsharp',
  vb: 'vb',

  // Mobile / apple
  m: 'objective-c',
  mm: 'objective-cpp',

  // Ruby / PHP
  rb: 'ruby',
  erb: 'ruby',
  php: 'php',
  phtml: 'php',

  // Other popular
  dart: 'dart',
  lua: 'lua',
  perl: 'perl',
  pl: 'perl',
  r: 'r',
  jl: 'julia',
  ex: 'elixir',
  exs: 'elixir',
  elm: 'elm',
  erl: 'erlang',
  hs: 'haskell',
  ml: 'ocaml',
  clj: 'clojure',
  cljs: 'clojure',
  coffee: 'coffeescript',

  // Build / infra
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  mk: 'makefile',
  cmake: 'cmake',
  sql: 'sql',
  prisma: 'prisma',
  graphql: 'graphql',
  gql: 'graphql',
}

const KNOWN_NAMES: Record<string, string> = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  '.env': 'shell',
}

export function getLanguageId(filePath: string): string | undefined {
  const parts = filePath.split('/')
  const name = parts[parts.length - 1] ?? ''
  const lowerName = name.toLowerCase()

  const known = KNOWN_NAMES[lowerName]
  if (known) return known

  const dotIndex = lowerName.lastIndexOf('.')
  if (dotIndex > 0) {
    const ext = lowerName.slice(dotIndex + 1)
    return EXT_TO_LANGUAGE[ext]
  }

  return undefined
}
