#!/usr/bin/env tsx
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ext = process.platform === 'win32' ? '.exe' : ''

const rustInfo = execSync('rustc -vV')
const targetTriple = /host: (\S+)/g.exec(rustInfo.toString())?.[1]

if (!targetTriple) {
  console.error('Failed to determine Rust target triple')
  process.exit(1)
}

const binaryName = `agent-server-${targetTriple}${ext}`

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..', '..')
const outputDir = path.join(projectRoot, 'src-tauri', 'binaries')

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

const localBinDir = path.resolve(__dirname, '..', 'bin')
if (!fs.existsSync(localBinDir)) {
  fs.mkdirSync(localBinDir, { recursive: true })
}

const localBinaryPath = path.join(localBinDir, `agent-server${ext}`)
const destPath = path.join(outputDir, binaryName)

console.log('Building sidecar binary with pkg...')
execSync(`pnpm exec pkg dist/index.cjs --targets node24.18.0 --output "${localBinaryPath}"`, {
  stdio: 'inherit',
})

fs.copyFileSync(localBinaryPath, destPath)
console.log(`Copied sidecar binary to ${destPath}`)
