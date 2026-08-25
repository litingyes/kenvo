import fs from 'fs/promises'

export interface FsStat {
  isFile: boolean
  isDirectory: boolean
  isSymbolicLink: boolean
  mode: number
  size: number
  mtime: Date
  readonly: boolean
}

export interface DirEntry {
  name: string
  isFile: boolean
  isDirectory: boolean
  isSymlink: boolean
}

export async function readDir(dirPath: string): Promise<DirEntry[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  return entries.map((entry) => ({
    name: entry.name,
    isFile: entry.isFile(),
    isDirectory: entry.isDirectory(),
    isSymlink: entry.isSymbolicLink(),
  }))
}

export async function stat(filePath: string): Promise<FsStat> {
  const info = await fs.stat(filePath)
  return {
    isFile: info.isFile(),
    isDirectory: info.isDirectory(),
    isSymbolicLink: info.isSymbolicLink(),
    mode: info.mode,
    size: info.size,
    mtime: info.mtime,
    readonly: false,
  }
}

export async function lstat(filePath: string): Promise<FsStat> {
  const info = await fs.lstat(filePath)
  return {
    isFile: info.isFile(),
    isDirectory: info.isDirectory(),
    isSymbolicLink: info.isSymbolicLink(),
    mode: info.mode,
    size: info.size,
    mtime: info.mtime,
    readonly: false,
  }
}

export async function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8')
}

export async function readFile(filePath: string): Promise<Uint8Array> {
  const buffer = await fs.readFile(filePath)
  return new Uint8Array(buffer)
}

export async function writeTextFile(
  filePath: string,
  content: string,
  options?: { append?: boolean; create?: boolean },
): Promise<void> {
  const flag = options?.append ? 'a' : 'w'
  await fs.writeFile(filePath, content, { flag, encoding: 'utf-8' })
}

export async function writeFile(
  filePath: string,
  content: Uint8Array,
  options?: { append?: boolean; create?: boolean },
): Promise<void> {
  const flag = options?.append ? 'a' : 'w'
  await fs.writeFile(filePath, content, { flag })
}

export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function mkdir(dirPath: string, recursive = false): Promise<void> {
  await fs.mkdir(dirPath, { recursive })
}

export async function remove(filePath: string, recursive = false): Promise<void> {
  await fs.rm(filePath, { recursive, force: true })
}

export async function copyFile(src: string, dest: string): Promise<void> {
  await fs.copyFile(src, dest)
}

export async function rename(src: string, dest: string): Promise<void> {
  await fs.rename(src, dest)
}
