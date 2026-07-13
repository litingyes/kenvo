import {
  copyFile,
  exists,
  lstat,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  rename,
  stat,
  writeFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs'
import { Command } from '@tauri-apps/plugin-shell'
import type {
  CpOptions,
  FileContent,
  FsStat,
  IFileSystem,
  MkdirOptions,
  RmOptions,
} from 'just-bash'

interface DirentEntry {
  name: string
  isFile: boolean
  isDirectory: boolean
  isSymbolicLink: boolean
}

function normalizePath(p: string): string {
  const isAbs = p.startsWith('/')
  const parts = p.split('/')
  const stack: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (stack.length > 0) stack.pop()
    } else {
      stack.push(part)
    }
  }
  return (isAbs ? '/' : '') + stack.join('/')
}

async function shellExec(cmd: string): Promise<string> {
  const command = Command.create('run-zsh', ['-c', cmd])
  let output = ''
  command.stdout.on('data', (line) => {
    output += line + '\n'
  })
  command.stderr.on('data', () => {})
  await command.spawn()
  return new Promise((resolve) => {
    command.on('close', () => resolve(output.trim()))
  })
}

export class TauriFs implements IFileSystem {
  private mountPoint: string

  constructor(mountPoint = '/') {
    this.mountPoint = mountPoint.replace(/\/+$/, '') || '/'
  }

  private resolve(path: string): string {
    if (path.startsWith('/')) {
      const full = this.mountPoint + path
      return full.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
    }
    return path
  }

  async readFile(path: string): Promise<string> {
    return readTextFile(this.resolve(path))
  }

  async readFileBuffer(path: string): Promise<Uint8Array> {
    return readFile(this.resolve(path))
  }

  async writeFile(path: string, content: FileContent): Promise<void> {
    const resolved = this.resolve(path)
    if (typeof content === 'string') {
      await writeTextFile(resolved, content)
    } else {
      await writeFile(resolved, content)
    }
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    const resolved = this.resolve(path)
    if (typeof content === 'string') {
      await writeTextFile(resolved, content, { append: true, create: true })
    } else {
      await writeFile(resolved, content, { append: true, create: true })
    }
  }

  async exists(path: string): Promise<boolean> {
    return exists(this.resolve(path))
  }

  async stat(path: string): Promise<FsStat> {
    const info = await stat(this.resolve(path))
    return {
      isFile: info.isFile,
      isDirectory: info.isDirectory,
      isSymbolicLink: info.isSymlink,
      mode: info.mode ?? 0o644,
      size: info.size,
      mtime: info.mtime ?? new Date(0),
    }
  }

  async lstat(path: string): Promise<FsStat> {
    const info = await lstat(this.resolve(path))
    return {
      isFile: info.isFile,
      isDirectory: info.isDirectory,
      isSymbolicLink: info.isSymlink,
      mode: info.mode ?? 0o644,
      size: info.size,
      mtime: info.mtime ?? new Date(0),
    }
  }

  async mkdir(path: string, options?: MkdirOptions): Promise<void> {
    await mkdir(this.resolve(path), { recursive: options?.recursive ?? false })
  }

  async readdir(path: string): Promise<string[]> {
    const entries = await readDir(this.resolve(path))
    return entries.map((e) => e.name)
  }

  async readdirWithFileTypes(path: string): Promise<DirentEntry[]> {
    const entries = await readDir(this.resolve(path))
    return entries.map((e) => ({
      name: e.name,
      isFile: e.isFile,
      isDirectory: e.isDirectory,
      isSymbolicLink: e.isSymlink,
    }))
  }

  async rm(path: string, options?: RmOptions): Promise<void> {
    try {
      await remove(this.resolve(path), {
        recursive: options?.recursive ?? false,
      })
    } catch (err) {
      if (!options?.force) throw err
    }
  }

  async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
    const s = this.resolve(src)
    const d = this.resolve(dest)
    if (options?.recursive) {
      await shellExec(`cp -R ${JSON.stringify(s)} ${JSON.stringify(d)}`)
    } else {
      await copyFile(s, d)
    }
  }

  async mv(src: string, dest: string): Promise<void> {
    await rename(this.resolve(src), this.resolve(dest))
  }

  resolvePath(base: string, path: string): string {
    if (path.startsWith('/')) return normalizePath(path)
    if (path.startsWith('~/')) return normalizePath(base + '/' + path.slice(2))
    if (path === '~') return base
    return normalizePath(base + '/' + path)
  }

  getAllPaths(): string[] {
    return []
  }

  async chmod(path: string, mode: number): Promise<void> {
    const modeStr = typeof mode === 'number' ? mode.toString(8).padStart(4, '0') : String(mode)
    await shellExec(`chmod ${modeStr} ${JSON.stringify(this.resolve(path))}`)
  }

  async symlink(target: string, linkPath: string): Promise<void> {
    await shellExec(
      `ln -s ${JSON.stringify(this.resolve(target))} ${JSON.stringify(this.resolve(linkPath))}`,
    )
  }

  async link(existingPath: string, newPath: string): Promise<void> {
    await shellExec(
      `ln ${JSON.stringify(this.resolve(existingPath))} ${JSON.stringify(this.resolve(newPath))}`,
    )
  }

  async readlink(path: string): Promise<string> {
    return shellExec(`readlink ${JSON.stringify(this.resolve(path))}`)
  }

  async realpath(path: string): Promise<string> {
    return shellExec(`realpath ${JSON.stringify(this.resolve(path))}`)
  }

  async utimes(path: string, _atime: Date, mtime: Date): Promise<void> {
    const dateStr = mtime.toISOString()
    await shellExec(`touch -d ${JSON.stringify(dateStr)} ${JSON.stringify(this.resolve(path))}`)
  }
}
