import { FilePlus2Icon, PanelLeftIcon, PanelRightIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { AgentPanel } from '@/components/agent/agent-panel'
import { MarkdownEditor } from '@/components/editor/markdown-editor'
import { AppHeader } from '@/components/layout/app-header'
import { ProjectTree } from '@/components/sidebar/project-tree'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import type { UiMessage } from '@/lib/agent/use-agent-chat'
import { createAgentServerClient } from '@/lib/ai/server-client'
import { getAiSettings, resolveAgentModel } from '@/lib/ai/settings-bridge'
import { createChatSession, listChatMessages, listChatSessions } from '@/lib/db/chat-repo'
import type { Project } from '@/lib/db/project-repo'
import { api } from '@/lib/electron/api'
import { useProjectStore } from '@/lib/store/project-store'
import { cn } from '@/lib/utils'

interface ProjectLayoutProps {
  project: Project
}

export function ProjectLayout({ project }: ProjectLayoutProps) {
  const { t } = useTranslation()
  const tabs = useProjectStore((s) => s.tabs)
  const activeTabId = useProjectStore((s) => s.activeTabId)
  const leftOpen = useProjectStore((s) => s.leftSidebarOpen)
  const rightOpen = useProjectStore((s) => s.rightSidebarOpen)
  const toggleLeft = useProjectStore((s) => s.toggleLeftSidebar)
  const toggleRight = useProjectStore((s) => s.toggleRightSidebar)
  const openFile = useProjectStore((s) => s.openFile)
  const closeFile = useProjectStore((s) => s.closeFile)
  const activateTab = useProjectStore((s) => s.activateTab)

  const [chatSessionId, setChatSessionId] = React.useState<string | null>(null)
  const [historyMessages, setHistoryMessages] = React.useState<UiMessage[]>([])
  const [serverPort, setServerPort] = React.useState<number | null>(null)
  const [sessionError, setSessionError] = React.useState<string | null>(null)
  const [treeRefreshKey, setTreeRefreshKey] = React.useState(0)

  const bumpTree = React.useCallback(() => setTreeRefreshKey((k) => k + 1), [])

  // Resolve agent server port, auto-starting the server when needed since
  // the writing studio cannot function without it.
  React.useEffect(() => {
    let cancelled = false
    const resolve = async () => {
      try {
        let status = await api.agentServer.status()
        if (!status.running) {
          await api.agentServer.start().catch(() => {})
          status = await api.agentServer.status()
        }
        if (!cancelled) setServerPort(status.running ? status.port : null)
      } catch {
        if (!cancelled) setServerPort(null)
      }
    }
    void resolve()
    const unlisten = api.agentServer.onStopped(() => setServerPort(null))
    return () => {
      cancelled = true
      unlisten()
    }
  }, [])

  // Create (or resume) the chat session for this project.
  React.useEffect(() => {
    if (!serverPort) return
    let cancelled = false

    async function setup() {
      const port = serverPort
      if (!port) return
      try {
        const settings = await getAiSettings()
        const assignment = resolveAgentModel(settings, project.agent_id)
        if (!assignment) {
          setSessionError(t('agent.noModel'))
          return
        }

        // Reuse the most recent session if present, else create a new one.
        const existing = await listChatSessions(project.id)
        let session = existing[0]
        if (!session) {
          session = await createChatSession(
            project.id,
            project.agent_id,
            assignment.providerId,
            assignment.modelId,
          )
        }

        const rows = await listChatMessages(session.id)
        const history = rows.map((r) => JSON.parse(r.message) as UiMessage)

        const client = createAgentServerClient(port)

        // The server keeps provider credentials in memory only — push the
        // user's saved config before creating a session.
        for (const provider of settings.providers) {
          if (provider.apiKey) {
            await client.configureProvider(provider.id, {
              apiKey: provider.apiKey,
              baseUrl: provider.baseUrl,
              enabled: provider.enabled,
            })
          }
        }

        await client.createSession({
          sessionId: session.id,
          agentId: project.agent_id,
          projectRoot: project.path,
          providerId: assignment.providerId,
          modelId: assignment.modelId,
          history,
        })

        if (!cancelled) {
          setHistoryMessages(history)
          setChatSessionId(session.id)
          setSessionError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setSessionError(e instanceof Error ? e.message : String(e))
        }
      }
    }

    void setup()
    return () => {
      cancelled = true
    }
  }, [serverPort, project.id, project.agent_id, project.path, t])

  const newDocument = async () => {
    const name = window.prompt(t('project.newDocumentPrompt'), 'untitled.md')
    if (!name) return
    const rel = name.endsWith('.md') ? name : `${name}.md`
    const abs = `${project.path}/${rel}`
    if (!(await api.fs.exists(abs))) {
      await api.fs.writeTextFile(abs, '')
    }
    bumpTree()
    await openFile(rel)
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <AppHeader
        leftContent={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleLeft}
              aria-label={t('project.toggleFiles')}
            >
              <PanelLeftIcon className="size-3.5" />
            </Button>
            <span className="truncate text-xs font-medium">{project.title}</span>
          </div>
        }
        rightContent={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleRight}
            aria-label={t('project.toggleAgent')}
          >
            <PanelRightIcon className="size-3.5" />
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1">
        <ResizablePanelGroup orientation="horizontal">
          {leftOpen && (
            <>
              <ResizablePanel defaultSize="18%" minSize="12%" maxSize="40%">
                <div className="flex h-full flex-col">
                  <div className="flex h-8 shrink-0 items-center justify-between px-3">
                    <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      {t('project.files')}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void newDocument()}
                      aria-label={t('project.newDocument')}
                    >
                      <FilePlus2Icon className="size-3.5" />
                    </Button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <ProjectTree rootPath={project.path} refreshKey={treeRefreshKey} />
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle />
            </>
          )}

          <ResizablePanel defaultSize="52%" minSize="30%">
            <div className="flex h-full flex-col">
              {/* Tab bar */}
              <div className="flex h-8 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border px-2">
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={cn(
                      'group flex h-6 items-center gap-1 rounded px-2 text-xs',
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
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="relative min-h-0 flex-1">
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
          </ResizablePanel>

          {rightOpen && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize="30%" minSize="20%" maxSize="45%">
                <div className="flex h-full flex-col">
                  <div className="flex h-8 shrink-0 items-center px-3">
                    <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      {t('agent.title')}
                    </span>
                  </div>
                  <div className="min-h-0 flex-1">
                    {!serverPort ? (
                      <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
                        {t('agent.serverStopped')}
                      </div>
                    ) : sessionError ? (
                      <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
                        {sessionError}
                      </div>
                    ) : chatSessionId ? (
                      <AgentPanel
                        key={chatSessionId}
                        sessionId={chatSessionId}
                        serverPort={serverPort}
                        initialMessages={historyMessages}
                        onFileActivity={bumpTree}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        {t('agent.connecting')}
                      </div>
                    )}
                  </div>
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
