import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { api, type DirEntry } from '@/lib/electron/api'
import { getFileIconClass } from '@/lib/file-icons'
import { cn } from '@/lib/utils'

import { FileEditor } from './file-editor'

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'])
const MAX_TEXT_SIZE = 10 * 1024 * 1024

function ext(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function FileViewer({ filePath, tabId }: { filePath: string; tabId: string }) {
  const { t } = useTranslation()
  const [state, setState] = React.useState<
    | { kind: 'loading' }
    | { kind: 'text' }
    | { kind: 'image'; src: string }
    | { kind: 'tooLarge'; size: number }
    | { kind: 'binary' }
    | { kind: 'error'; message: string }
  >({ kind: 'loading' })

  React.useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })

    async function load() {
      try {
        const stat = (await api.fs.stat(filePath)) as DirEntry & { size: number }
        const size = (stat as { size?: number }).size ?? 0
        const name = filePath.split('/').pop() ?? filePath
        const e = ext(name)

        if (IMAGE_EXTS.has(e)) {
          const buf = (await api.fs.readFile(filePath)) as Uint8Array
          if (cancelled) return
          const blob = new Blob([buf as unknown as ArrayBuffer], {
            type: `image/${e === 'jpg' ? 'jpeg' : e}`,
          })
          setState({ kind: 'image', src: URL.createObjectURL(blob) })
          return
        }

        if (size > MAX_TEXT_SIZE) {
          if (cancelled) return
          setState({ kind: 'tooLarge', size })
          return
        }

        setState({ kind: 'text' })
      } catch (err) {
        if (cancelled) return
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [filePath])

  React.useEffect(() => {
    if (state.kind === 'image') {
      const src = state.src
      return () => URL.revokeObjectURL(src)
    }
  }, [state])

  if (state.kind === 'loading') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <p className="text-xs">{t('terminal.initializing')}</p>
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
        <p className="text-destructive">{state.message}</p>
      </div>
    )
  }

  if (state.kind === 'tooLarge') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
        <span className={cn('size-6 opacity-60', getFileIconClass(filePath))} aria-hidden="true" />
        <p>{t('files.tooLarge', { size: Math.round((state.size / 1024 / 1024) * 100) / 100 })}</p>
      </div>
    )
  }

  if (state.kind === 'binary') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
        <span className={cn('size-6 opacity-60', getFileIconClass(filePath))} aria-hidden="true" />
        <p>{t('files.binaryFile')}</p>
      </div>
    )
  }

  if (state.kind === 'image') {
    return (
      <div className="flex h-full items-center justify-center overflow-auto bg-muted/30 p-4">
        <img src={state.src} alt={filePath} className="max-h-full max-w-full object-contain" />
      </div>
    )
  }

  return <FileEditor filePath={filePath} tabId={tabId} />
}
