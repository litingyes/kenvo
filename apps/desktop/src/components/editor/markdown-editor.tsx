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
import { EditorContent, useEditor } from '@tiptap/react'
import CodeMirror from '@uiw/react-codemirror'
import { CodeIcon, FileCode2Icon, PenLineIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { ScrollArea } from '@/components/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '@/lib/electron/api'

import {
  analyzeMarkdownDocument,
  composeMarkdownDocument,
  type MarkdownDocumentAnalysis,
} from './markdown-document'
import { markdownExtensions } from './markdown-extensions'

type EditorMode = 'visual' | 'source'

interface MarkdownEditorProps {
  /** Absolute file path. */
  filePath: string
}

const sourceExtensions = [
  lineNumbers(),
  highlightActiveLine(),
  highlightActiveLineGutter(),
  drawSelection(),
  history(),
  EditorView.lineWrapping,
  markdown({ base: markdownLanguage }),
  keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
]

function isEditorMode(value: string): value is EditorMode {
  return value === 'visual' || value === 'source'
}

/**
 * Markdown document editor with a loss-aware Visual/Source mode switch.
 * Markdown on disk remains the source of truth; Tiptap JSON only exists while
 * Visual mode is mounted.
 */
export function MarkdownEditor({ filePath }: MarkdownEditorProps) {
  const { resolvedTheme } = useTheme()
  const { t } = useTranslation()
  const [rawContent, setRawContent] = React.useState<string | null>(null)
  const [analysis, setAnalysis] = React.useState<MarkdownDocumentAnalysis | null>(null)
  const [mode, setMode] = React.useState<EditorMode | null>(null)
  const [dirty, setDirty] = React.useState(false)
  const [visualRevision, setVisualRevision] = React.useState(0)
  const rawContentRef = React.useRef('')
  const dirtyRef = React.useRef(false)
  dirtyRef.current = dirty

  const load = React.useCallback(async () => {
    try {
      const text = await api.fs.readTextFile(filePath)
      const nextAnalysis = analyzeMarkdownDocument(text)
      rawContentRef.current = text
      setRawContent(text)
      setAnalysis(nextAnalysis)
      setDirty(false)
      setVisualRevision((revision) => revision + 1)
      setMode((current) => {
        if (!current) return nextAnalysis.canVisualize ? 'visual' : 'source'
        return current === 'visual' && !nextAnalysis.canVisualize ? 'source' : current
      })
    } catch {
      setRawContent(null)
      setAnalysis(null)
      setMode(null)
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
        // Preserve the existing local-wins behavior so an agent write cannot
        // silently clobber text the user has not saved yet.
        void api.fs.writeTextFile(filePath, rawContentRef.current).catch(() => {})
        return
      }
      void load()
    })
    return () => {
      unlisten()
      void api.fs.unwatch(filePath).catch(() => {})
    }
  }, [filePath, load])

  const updateRawContent = React.useCallback((value: string) => {
    rawContentRef.current = value
    setRawContent(value)
    setAnalysis(analyzeMarkdownDocument(value))
    setDirty(true)
  }, [])

  const updateVisualContent = React.useCallback(
    (body: string) => {
      const { frontmatter } = analyzeMarkdownDocument(rawContentRef.current)
      updateRawContent(composeMarkdownDocument(frontmatter, body))
    },
    [updateRawContent],
  )

  const save = React.useCallback(async () => {
    if (!dirtyRef.current) return
    try {
      await api.fs.writeTextFile(filePath, rawContentRef.current)
      dirtyRef.current = false
      setDirty(false)
    } catch {
      // Keep the dirty indicator when the filesystem write fails.
    }
  }, [filePath])

  // Cmd/Ctrl+S save + periodic autosave, matching the previous CodeMirror
  // editor behavior.
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
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

  const changeMode = React.useCallback(
    (next: string | undefined) => {
      if (!next || next === mode || !analysis || !isEditorMode(next)) return
      if (next === 'visual' && !analysis.canVisualize) return
      setMode(next)
    },
    [analysis, mode],
  )

  if (rawContent === null || !analysis || !mode) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Loading…
      </div>
    )
  }

  const unsafeVisual = !analysis.canVisualize
  const unsafeLabel = unsafeVisual ? t('project.editorSourceOnlyReason') : undefined

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          <FileCode2Icon className="size-3.5 shrink-0" />
          <span className="truncate">{t('project.editor')}</span>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          {unsafeVisual && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="max-w-44 truncate text-[10px] text-muted-foreground">
                    {t('project.editorSourceOnly')}
                  </span>
                }
              />
              <TooltipContent>{unsafeLabel}</TooltipContent>
            </Tooltip>
          )}
          {dirty && (
            <span className="text-[10px] text-muted-foreground">{t('project.editorUnsaved')}</span>
          )}
          <ToggleGroup
            value={mode ? [mode] : []}
            onValueChange={(value) => changeMode(value[0])}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label={t('project.editorMode')}
          >
            <ToggleGroupItem
              value="visual"
              disabled={unsafeVisual}
              aria-label={t('project.editorVisual')}
            >
              <PenLineIcon data-icon="inline-start" />
              {t('project.editorVisual')}
            </ToggleGroupItem>
            <ToggleGroupItem value="source" aria-label={t('project.editorSource')}>
              <CodeIcon data-icon="inline-start" />
              {t('project.editorSource')}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {mode === 'source' ? (
          <CodeMirror
            value={rawContent}
            onChange={updateRawContent}
            extensions={sourceExtensions}
            theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
            height="100%"
            style={{ height: '100%', fontSize: '13px' }}
            basicSetup={false}
          />
        ) : (
          <VisualMarkdownEditor
            key={`${filePath}:${visualRevision}`}
            markdown={analysis.body}
            onChange={updateVisualContent}
          />
        )}
      </div>
    </div>
  )
}

function VisualMarkdownEditor({
  markdown,
  onChange,
}: {
  markdown: string
  onChange: (markdown: string) => void
}) {
  const editor = useEditor({
    extensions: markdownExtensions,
    content: markdown,
    contentType: 'markdown',
    immediatelyRender: false,
    onUpdate: ({ editor: updatedEditor }) => {
      onChange(updatedEditor.getMarkdown())
    },
    editorProps: {
      attributes: {
        class: 'tiptap-document',
      },
    },
  })

  if (!editor) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <ScrollArea className="h-full" viewportClassName="px-5 py-4" contentClassName="min-h-full">
      <EditorContent editor={editor} />
    </ScrollArea>
  )
}
