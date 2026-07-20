import * as React from 'react'

import { api } from '@/lib/electron/api'
import i18n from '@/lib/i18n'

interface PathInfo {
  isFile: boolean
  isDirectory: boolean
  isSymlink: boolean
  size: number
  mtime: Date | null
  mode: number | null
  readonly: boolean
}

export function usePathInfo(cwd: string) {
  const [info, setInfo] = React.useState<PathInfo | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const targetPath = cwd || '/'
    api.fs
      .stat(targetPath)
      .then((data) => {
        if (cancelled) return
        setInfo({
          isFile: data.isFile,
          isDirectory: data.isDirectory,
          isSymlink: data.isSymlink,
          size: data.size,
          mtime: data.mtime,
          mode: data.mode,
          readonly: data.readonly,
        })
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cwd])

  return { info, loading, error }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function formatDate(date: Date | null): string {
  if (!date) return '-'
  return date.toLocaleString(i18n.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatMode(mode: number | null): string {
  if (mode === null) return '-'
  return '0' + (mode & 0o7777).toString(8).padStart(3, '0')
}

export function getParentDirs(cwd: string): { path: string; label: string }[] {
  const parts = cwd.replace(/\/+$/, '').split('/').filter(Boolean)
  const dirs: { path: string; label: string }[] = []
  let current = ''
  for (const part of parts) {
    current += '/' + part
    dirs.push({ path: current, label: part })
  }
  return dirs
}
