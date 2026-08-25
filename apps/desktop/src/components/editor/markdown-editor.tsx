import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { searchKeymap } from '@codemirror/search'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { useTheme } from 'next-themes'
import * as React from 'react'

import { api } from '@/lib/electron/api'

interface MarkdownEditorProps {
  /** Absolute file path. */
  filePath: string
}

/**
 * CodeMirror-based Markdown editor with external-change watching.
 * The file is reloaded automatically when the agent (or another editor)
 * modifies it on disk and there are no unsaved local edits.
 */
export function MarkdownEditor({ filePath }: MarkdownEditorProps) {
  const { resolvedTheme } = useTheme()
  const [content, setContent] = React.useState<string | null>(null)
  const [dirty, setDirty] = React.useState(false)
  const contentRef = React.useRef('')
  const dirtyRef = React.useRef(false)
  dirtyRef.current = dirty

  const load = React.useCallback(async () => {
    try {
      const text = await api.fs.readTextFile(filePath)
      contentRef.current = text
      setContent(text)
      setDirty(false)
    } catch {
      setContent(null)
    }
  }, [filePath])

  React.useEffect(() => {
    void load()
  }, [load])

  // Watch external changes (agent writes, other editors).
  React.useEffect(() => {
    void api.fs.watch(filePath).catch(() => {})
    const unlisten = api.fs.onFileChanged((payload) => {
      if (payload.path !== filePath) return
      if (dirtyRef.current) {
        // Local edits win; auto-save them so agent output and user edits
        // never silently clobber each other.
        void api.fs.writeTextFile(filePath, contentRef.current).catch(() => {})
        return
      }
      void load()
    })
    return () => {
      unlisten()
      void api.fs.unwatch(filePath).catch(() => {})
    }
  }, [filePath, load])

  const onChange = React.useCallback((value: string) => {
    contentRef.current = value
    setDirty(true)
  }, [])

  const save = React.useCallback(async () => {
    if (!dirtyRef.current) return
    await api.fs.writeTextFile(filePath, contentRef.current).catch(() => {})
    setDirty(false)
  }, [filePath])

  // Cmd/Ctrl+S save + autosave on blur interval.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', handler)
    const interval = setInterval(() => void save(), 5000)
    return () => {
      window.removeEventListener('keydown', handler)
      clearInterval(interval)
    }
  }, [save])

  const extensions = React.useMemo(
    () => [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      drawSelection(),
      history(),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage }),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    ],
    [],
  )

  if (content === null) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <div className="relative h-full">
      {dirty && (
        <div className="absolute top-2 right-3 z-10 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          Unsaved
        </div>
      )}
      <CodeMirror
        value={content}
        onChange={onChange}
        extensions={extensions}
        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        height="100%"
        style={{ height: '100%', fontSize: '13px' }}
        basicSetup={false}
      />
    </div>
  )
}
