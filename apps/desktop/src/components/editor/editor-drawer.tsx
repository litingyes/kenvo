import { FilePlus2Icon, PanelLeftCloseIcon, PanelLeftIcon, XIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { MarkdownEditor } from '@/components/editor/markdown-editor'
import { ProjectTree } from '@/components/sidebar/project-tree'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/electron/api'
import { useProjectStore } from '@/lib/store/project-store'
import { cn } from '@/lib/utils'

/**
 * Auxiliary file viewer: a non-modal drawer sliding in from the right.
 * Contains the project file tree (collapsible column), document tabs and the
 * Markdown editor. While open, the chat view is pushed left (same width) so
 * both stay fully visible and interactive.
 */
export const EDITOR_DRAWER_CLASSES = {
  width: 'w-[min(52rem,62%)]',
  /** Matches `width`; applied as right padding on the chat view. */
  chatPadding: 'pr-[min(52rem,62%)]',
} as const

export function EditorDrawer() {
  const { t } = useTranslation()
  const project = useProjectStore((s) => s.project)
  const tabs = useProjectStore((s) => s.tabs)
  const activeTabId = useProjectStore((s) => s.activeTabId)
  const editorOpen = useProjectStore((s) => s.editorOpen)
  const treeVersion = useProjectStore((s) => s.treeVersion)
  const activateTab = useProjectStore((s) => s.activateTab)
  const closeFile = useProjectStore((s) => s.closeFile)
  const toggleEditor = useProjectStore((s) => s.toggleEditor)
  const bumpTree = useProjectStore((s) => s.bumpTree)
  const [treeOpen, setTreeOpen] = React.useState(true)

  const newDocument = async () => {
    if (!project) return
    const name = window.prompt(t('project.newDocumentPrompt'), 'untitled.md')
    if (!name) return
    const rel = name.endsWith('.md') ? name : `${name}.md`
    const abs = `${project.path}/${rel}`
    if (!(await api.fs.exists(abs))) {
      await api.fs.writeTextFile(abs, '')
    }
    bumpTree()
    await useProjectStore.getState().openFile(rel)
  }

  if (!project) return null

  return (
    <div
      className={cn(
        'absolute inset-y-0 right-0 z-20 flex flex-col border-l border-border bg-background shadow-xl transition-[transform,visibility] duration-200',
        EDITOR_DRAWER_CLASSES.width,
        editorOpen ? 'translate-x-0' : 'invisible translate-x-full',
      )}
      aria-hidden={!editorOpen}
    >
      {/* Header: tree toggle + tabs + close */}
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTreeOpen((v) => !v)}
          aria-label={t('project.toggleFiles')}
          title={t('project.toggleFiles')}
        >
          {treeOpen ? (
            <PanelLeftCloseIcon className="size-3.5" />
          ) : (
            <PanelLeftIcon className="size-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void newDocument()}
          aria-label={t('project.newDocument')}
          title={t('project.newDocument')}
        >
          <FilePlus2Icon className="size-3.5" />
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'group flex h-6 shrink-0 items-center gap-1 rounded px-2 text-xs',
                tab.id === activeTabId
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/60',
              )}
            >
              <button
                type="button"
                className="max-w-40 truncate"
                onClick={() => activateTab(tab.id)}
              >
                {tab.file_path.split('/').pop()}
              </button>
              <button
                type="button"
                className="hidden text-muted-foreground group-hover:block hover:text-foreground"
                onClick={() => void closeFile(tab.id)}
                aria-label={t('common.close')}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleEditor}
          aria-label={t('common.close')}
          title={t('common.close')}
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>

      {/* Body: file tree column + editor */}
      <div className="flex min-h-0 flex-1">
        {treeOpen && (
          <div className="flex w-52 shrink-0 flex-col border-r border-border">
            <div className="flex h-7 shrink-0 items-center px-3">
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {t('project.files')}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ProjectTree rootPath={project.path} refreshKey={treeVersion} />
            </div>
          </div>
        )}

        <div className="relative min-w-0 flex-1">
          {tabs.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <p className="text-xs">{t('project.noTabs')}</p>
              <Button variant="outline" size="sm" onClick={() => void newDocument()}>
                {t('project.newDocument')}
              </Button>
            </div>
          ) : (
            tabs.map((tab) => {
              const active = tab.id === activeTabId
              return (
                <div key={tab.id} className={active ? 'absolute inset-0' : 'hidden'}>
                  {active && <MarkdownEditor filePath={`${project.path}/${tab.file_path}`} />}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
