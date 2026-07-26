import { useTheme } from 'next-themes'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import {
  createFileEditorModel,
  disposeFileEditor,
  getFileEditor,
  getFileEditorModel,
  isFileEditorDirty,
  registerFileEditor,
  setFileEditorValue,
} from '@/lib/editor/editor-registry'
import { getLanguageId } from '@/lib/editor/language-map'
import { monaco, updateMonacoTheme } from '@/lib/editor/monaco-setup'
import { api } from '@/lib/electron/api'
import { getFileIconClass } from '@/lib/file-icons'
import { useWorkspaceStore } from '@/lib/store/workspace-store'
import { cn } from '@/lib/utils'

interface FileEditorProps {
  filePath: string
  tabId: string
  active?: boolean
}

const MAX_TEXT_SIZE = 10 * 1024 * 1024

export function FileEditor({ filePath, tabId, active = true }: FileEditorProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [state, setState] = React.useState<'loading' | 'ready' | 'error' | 'tooLarge' | 'binary'>(
    'loading',
  )
  const [errorMessage, setErrorMessage] = React.useState('')

  // Load file content and create Monaco model for this tab.
  React.useEffect(() => {
    let cancelled = false
    setState('loading')
    setErrorMessage('')

    async function load() {
      try {
        const stat = await api.fs.stat(filePath)
        const size = (stat as { size?: number }).size ?? 0
        if (size > MAX_TEXT_SIZE) {
          if (!cancelled) setState('tooLarge')
          return
        }

        const content = await api.fs.readTextFile(filePath)
        if (cancelled) return
        if (content.includes('\u0000')) {
          if (!cancelled) setState('binary')
          return
        }

        const language = getLanguageId(filePath)
        createFileEditorModel(tabId, filePath, content, language)
        // Fresh model from disk content is never dirty; clear any stale flag
        // left over from a previous mount of this tab.
        useWorkspaceStore.getState().setTabDirty(tabId, false)
        if (!cancelled) setState('ready')
      } catch (err) {
        if (cancelled) return
        setErrorMessage(err instanceof Error ? err.message : String(err))
        setState('error')
      }
    }

    void load()

    return () => {
      cancelled = true
      disposeFileEditor(tabId)
    }
  }, [filePath, tabId])

  // Create the editor instance once the model is ready.
  React.useEffect(() => {
    if (state !== 'ready' || !containerRef.current) return

    const model = getFileEditorModel(tabId)
    if (!model) return

    const container = containerRef.current
    const editor = monaco.editor.create(container, {
      model,
      automaticLayout: true,
      fontFamily: 'Geist Mono Variable, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 14,
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderLineHighlight: 'all',
      wordWrap: 'off',
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: true,
      folding: true,
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true,
      },
      padding: { top: 8, bottom: 8 },
      roundedSelection: false,
      contextmenu: true,
      renderWhitespace: 'selection',
      largeFileOptimizations: true,
    })

    registerFileEditor(tabId, editor)
    updateMonacoTheme()

    const disposable = model.onDidChangeContent(() => {
      const { setTabDirty } = useWorkspaceStore.getState()
      setTabDirty(tabId, isFileEditorDirty(tabId))
    })

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const { saveFileTab } = useWorkspaceStore.getState()
      void saveFileTab(tabId)
    })

    if (active) {
      editor.focus()
    }

    return () => {
      disposable.dispose()
      editor.dispose()
    }
  }, [state, tabId, active])

  // Focus the editor when the tab becomes active.
  React.useEffect(() => {
    if (active) {
      getFileEditor(tabId)?.focus()
    }
  }, [active, tabId])

  // Sync Monaco theme when the app theme changes.
  React.useEffect(() => {
    updateMonacoTheme()
  }, [resolvedTheme])

  // Watch for external file changes and prompt/auto-reload accordingly.
  React.useEffect(() => {
    if (!api.fs.onFileChanged) return

    let ignore = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function handleExternalChange(changedPath: string) {
      if (changedPath !== filePath || ignore) return
      const model = getFileEditorModel(tabId)
      if (!model) return

      try {
        const content = await api.fs.readTextFile(filePath)
        if (content === model.getValue()) return

        if (isFileEditorDirty(tabId)) {
          const { response } = await api.dialog.showMessageBox({
            type: 'warning',
            buttons: [t('editor.reload'), t('editor.keepMine')],
            defaultId: 1,
            cancelId: 1,
            message: t('editor.externalChangeMessage', {
              file: filePath.split('/').pop() ?? filePath,
            }),
          })
          if (response === 1) return
        }

        setFileEditorValue(tabId, content)
        const { setTabDirty } = useWorkspaceStore.getState()
        setTabDirty(tabId, false)
      } catch {
        // ignore
      }
    }

    const unlisten = api.fs.onFileChanged((event) => {
      if (event.path !== filePath) return
      // Debounce: atomic saves (git checkout, editor writes) emit a burst of
      // events and the file may be mid-write when the first one arrives.
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void handleExternalChange(event.path)
      }, 300)
    })

    void api.fs.watch(filePath)

    return () => {
      ignore = true
      if (timer) clearTimeout(timer)
      unlisten()
      void api.fs.unwatch(filePath)
    }
  }, [filePath, tabId, t])

  if (state === 'loading') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <p className="text-xs">{t('files.loading')}</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
        <p className="text-destructive">{errorMessage}</p>
      </div>
    )
  }

  if (state === 'tooLarge') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
        <span className={cn('size-6 opacity-60', getFileIconClass(filePath))} aria-hidden="true" />
        <p>
          {t('files.tooLarge', { size: Math.round((MAX_TEXT_SIZE / 1024 / 1024) * 100) / 100 })}
        </p>
      </div>
    )
  }

  if (state === 'binary') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
        <span className={cn('size-6 opacity-60', getFileIconClass(filePath))} aria-hidden="true" />
        <p>{t('files.binaryFile')}</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      aria-label={t('editor.label')}
    />
  )
}
