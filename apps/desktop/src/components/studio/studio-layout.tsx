import { FolderIcon, PanelLeftIcon, PanelRightIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { agentIcon, agentName } from '@/components/agent/agent-meta'
import { AgentPanel } from '@/components/agent/agent-panel'
import { FilesPanel } from '@/components/files/files-panel'
import { AppHeader } from '@/components/layout/app-header'
import { NewProjectDialog } from '@/components/project/new-project-dialog'
import { StudioSidebar } from '@/components/studio/studio-sidebar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import type { UiMessage } from '@/lib/agent/use-agent-chat'
import { createAgentServerClient } from '@/lib/ai/server-client'
import { getAiSettings, resolveAgentModel, type AiSettings } from '@/lib/ai/settings-bridge'
import {
  createChatSession,
  deleteChatSession,
  getChatSession,
  listAllChatSessions,
  listChatMessages,
  type ChatSession,
} from '@/lib/db/chat-repo'
import {
  deleteProject,
  getProject,
  listProjects,
  listTabs,
  touchProject,
  type Project,
} from '@/lib/db/project-repo'
import { api } from '@/lib/electron/api'
import { useProjectStore } from '@/lib/store/project-store'

type ConfirmAction =
  | { type: 'switch'; sessionId: string }
  | { type: 'new' }
  | { type: 'delete'; sessionId: string }
  | { type: 'deleteProject'; projectId: string }

/**
 * Codex-style unified studio: session history across all projects on the
 * left, the agent conversation in the middle, and a docked, collapsible
 * feature panel (Files) on the right.
 */
export function StudioLayout() {
  const { t } = useTranslation()
  const leftOpen = useProjectStore((s) => s.leftSidebarOpen)
  const toggleLeft = useProjectStore((s) => s.toggleLeftSidebar)
  const rightOpen = useProjectStore((s) => s.rightPanelOpen)
  const toggleRight = useProjectStore((s) => s.toggleRightPanel)
  const bumpTree = useProjectStore((s) => s.bumpTree)

  const [projects, setProjects] = React.useState<Project[]>([])
  const [sessions, setSessions] = React.useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null)
  const [historyMessages, setHistoryMessages] = React.useState<UiMessage[]>([])
  const [serverPort, setServerPort] = React.useState<number | null>(null)
  const [sessionError, setSessionError] = React.useState<string | null>(null)
  const [agentRunning, setAgentRunning] = React.useState(false)
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction | null>(null)
  const [newProjectOpen, setNewProjectOpen] = React.useState(false)
  const settingsRef = React.useRef<AiSettings | null>(null)

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null
  const activeProject = activeSession
    ? (projects.find((p) => p.id === activeSession.project_id) ?? null)
    : null

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

  const refreshSessions = React.useCallback(async () => {
    setSessions(await listAllChatSessions())
  }, [])

  const refreshProjects = React.useCallback(async () => {
    setProjects(await listProjects())
  }, [])

  /** Stop and drop the server-side agent session (best effort). */
  const stopServerSession = React.useCallback(
    async (sessionId: string | null, port: number | null) => {
      if (!sessionId || !port) return
      const client = createAgentServerClient(port)
      await client.abortSession(sessionId).catch(() => {})
      await client.destroySession(sessionId).catch(() => {})
    },
    [],
  )

  /** Point the file tree / editor / right panel at the session's project. */
  const hydrateProject = React.useCallback(async (project: Project) => {
    const tabs = await listTabs(project.id)
    useProjectStore.getState().hydrate(project, tabs)
    await touchProject(project.id)
  }, [])

  /** Load the persisted transcript and (re)create the server-side agent session. */
  const startServerSession = React.useCallback(
    async (session: ChatSession, project: Project, port: number): Promise<UiMessage[]> => {
      const settings = settingsRef.current
      const assignment = settings ? resolveAgentModel(settings, project.agent_id) : null
      if (!assignment) throw new Error(t('agent.noModel'))
      const rows = await listChatMessages(session.id)
      const history = rows.map((r) => JSON.parse(r.message) as UiMessage)
      const client = createAgentServerClient(port)
      await client.createSession({
        sessionId: session.id,
        agentId: project.agent_id,
        projectRoot: project.path,
        providerId: assignment.providerId,
        modelId: assignment.modelId,
        history,
      })
      return history
    },
    [t],
  )

  /** Create a fresh chat session under the given project and activate it. */
  const createSessionForProject = React.useCallback(
    async (project: Project, port: number): Promise<ChatSession> => {
      const settings = settingsRef.current
      const assignment = settings ? resolveAgentModel(settings, project.agent_id) : null
      if (!assignment) throw new Error(t('agent.noModel'))
      const session = await createChatSession(
        project.id,
        project.agent_id,
        assignment.providerId,
        assignment.modelId,
      )
      const client = createAgentServerClient(port)
      await client.createSession({
        sessionId: session.id,
        agentId: project.agent_id,
        projectRoot: project.path,
        providerId: assignment.providerId,
        modelId: assignment.modelId,
        history: [],
      })
      return session
    },
    [t],
  )

  // Initial setup: configure providers, load projects + sessions, then resume
  // the most recent session (or create the first one for the newest project).
  React.useEffect(() => {
    if (!serverPort) return
    let cancelled = false
    const port = serverPort

    async function setup() {
      try {
        const settings = await getAiSettings()
        settingsRef.current = settings

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

        const allProjects = await listProjects()
        const allSessions = await listAllChatSessions()
        if (cancelled) return
        setProjects(allProjects)
        setSessions(allSessions)

        let session = allSessions[0]
        if (!session && allProjects.length > 0) {
          session = await createSessionForProject(allProjects[0], port)
          if (!cancelled) setSessions([session])
        }
        if (!session) return // No projects yet — show the empty state.

        const project =
          allProjects.find((p) => p.id === session.project_id) ??
          (await getProject(session.project_id))
        if (!project) return

        const history = await startServerSession(session, project, port)
        if (!cancelled) {
          await hydrateProject(project)
          setHistoryMessages(history)
          setActiveSessionId(session.id)
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
  }, [serverPort, createSessionForProject, startServerSession, hydrateProject])

  // ---------- Session switching ----------

  const activateSession = async (sessionId: string, force = false) => {
    if (!serverPort || sessionId === activeSessionId) return
    if (agentRunning && !force) {
      setConfirmAction({ type: 'switch', sessionId })
      return
    }
    try {
      const session = sessions.find((s) => s.id === sessionId) ?? (await getChatSession(sessionId))
      if (!session) return
      const project =
        projects.find((p) => p.id === session.project_id) ?? (await getProject(session.project_id))
      if (!project) return
      await stopServerSession(activeSessionId, serverPort)
      const history = await startServerSession(session, project, serverPort)
      await hydrateProject(project)
      setHistoryMessages(history)
      setActiveSessionId(session.id)
      setSessionError(null)
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : String(e))
    }
  }

  const newSession = async (force = false) => {
    if (!serverPort) return
    if (!activeProject) {
      setNewProjectOpen(true)
      return
    }
    if (agentRunning && !force) {
      setConfirmAction({ type: 'new' })
      return
    }
    try {
      await stopServerSession(activeSessionId, serverPort)
      const session = await createSessionForProject(activeProject, serverPort)
      await hydrateProject(activeProject)
      setHistoryMessages([])
      setActiveSessionId(session.id)
      setSessionError(null)
      await refreshSessions()
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : String(e))
    }
  }

  const performDelete = async (sessionId: string) => {
    const isActive = sessionId === activeSessionId
    try {
      if (isActive) {
        await stopServerSession(activeSessionId, serverPort)
        setActiveSessionId(null)
        setHistoryMessages([])
      }
      await deleteChatSession(sessionId)
      const remaining = await listAllChatSessions()
      setSessions(remaining)
      if (isActive && serverPort) {
        const next = remaining[0]
        if (next) {
          await activateSession(next.id, true)
        } else if (projects.length > 0) {
          const session = await createSessionForProject(projects[0], serverPort)
          setSessions([session])
          await hydrateProject(projects[0])
          setHistoryMessages([])
          setActiveSessionId(session.id)
        }
      }
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : String(e))
    }
  }

  const performDeleteProject = async (projectId: string) => {
    try {
      const doomed = sessions.filter((s) => s.project_id === projectId)
      const activeDoomed = doomed.some((s) => s.id === activeSessionId)
      if (activeDoomed) {
        await stopServerSession(activeSessionId, serverPort)
        setActiveSessionId(null)
        setHistoryMessages([])
      } else if (serverPort) {
        const client = createAgentServerClient(serverPort)
        for (const s of doomed) {
          await client.destroySession(s.id).catch(() => {})
        }
      }
      await deleteProject(projectId)
      const remainingProjects = await listProjects()
      const remainingSessions = await listAllChatSessions()
      setProjects(remainingProjects)
      setSessions(remainingSessions)
      if (activeDoomed && serverPort) {
        const next = remainingSessions[0]
        if (next) {
          await activateSession(next.id, true)
        } else if (remainingProjects.length > 0) {
          const session = await createSessionForProject(remainingProjects[0], serverPort)
          setSessions([session])
          await hydrateProject(remainingProjects[0])
          setHistoryMessages([])
          setActiveSessionId(session.id)
        }
      }
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleProjectCreated = async (projectId: string) => {
    if (!serverPort) return
    try {
      await refreshProjects()
      const project = await getProject(projectId)
      if (!project) return
      await stopServerSession(activeSessionId, serverPort)
      const session = await createSessionForProject(project, serverPort)
      await hydrateProject(project)
      setHistoryMessages([])
      setActiveSessionId(session.id)
      setSessionError(null)
      await refreshSessions()
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleConfirm = async () => {
    const action = confirmAction
    setConfirmAction(null)
    if (!action) return
    if (action.type === 'switch') await activateSession(action.sessionId, true)
    else if (action.type === 'new') await newSession(true)
    else if (action.type === 'delete') await performDelete(action.sessionId)
    else await performDeleteProject(action.projectId)
  }

  const AgentBadgeIcon = activeProject ? agentIcon(activeProject.agent_id) : null

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <AppHeader
        leftContent={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleLeft}
            aria-label={t('project.toggleSessions')}
            title={t('project.toggleSessions')}
          >
            <PanelLeftIcon className="size-3.5" />
          </Button>
        }
        centerContent={
          activeProject && activeSession ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-xs font-medium">
                {activeSession.title || t('agent.untitled')}
              </span>
              {AgentBadgeIcon && (
                <span className="ml-1 flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                  <AgentBadgeIcon className="size-3" />
                  {agentName(activeProject.agent_id)}
                </span>
              )}
            </div>
          ) : null
        }
        rightContent={
          activeSessionId ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleRight}
              aria-label={t('project.toggleRightPanel')}
              title={t('project.toggleRightPanel')}
            >
              <PanelRightIcon className="size-3.5" />
            </Button>
          ) : null
        }
      />

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup orientation="horizontal">
          {leftOpen && (
            <>
              <ResizablePanel defaultSize="18%" minSize="14%" maxSize="30%">
                <StudioSidebar
                  projects={projects}
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  onSelectSession={(id) => void activateSession(id)}
                  onNewSession={() => void newSession()}
                  onDeleteSession={(id) => setConfirmAction({ type: 'delete', sessionId: id })}
                  onDeleteProject={(id) =>
                    setConfirmAction({ type: 'deleteProject', projectId: id })
                  }
                  onNewProject={() => setNewProjectOpen(true)}
                />
              </ResizablePanel>
              <ResizableHandle />
            </>
          )}

          <ResizablePanel minSize="30%">
            {!serverPort ? (
              <CenteredNote text={t('agent.serverStopped')} />
            ) : sessionError ? (
              <CenteredNote text={sessionError} />
            ) : activeSessionId && activeProject ? (
              <AgentPanel
                key={activeSessionId}
                sessionId={activeSessionId}
                agentId={activeProject.agent_id}
                serverPort={serverPort}
                initialMessages={historyMessages}
                onFileActivity={bumpTree}
                onSessionActivity={refreshSessions}
                onRunningChange={setAgentRunning}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                <p className="text-xs text-muted-foreground">{t('studio.noProjectsHint')}</p>
                <Button variant="outline" size="sm" onClick={() => setNewProjectOpen(true)}>
                  {t('studio.newProject')}
                </Button>
              </div>
            )}
          </ResizablePanel>

          {rightOpen && activeProject && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize="38%" minSize="26%" maxSize="55%">
                <FilesPanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        onCreated={(id) => void handleProjectCreated(id)}
      />

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'delete'
                ? t('agent.deleteSessionTitle')
                : confirmAction?.type === 'deleteProject'
                  ? t('studio.deleteProjectTitle')
                  : t('agent.switchTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'delete'
                ? t('agent.deleteSessionDesc')
                : confirmAction?.type === 'deleteProject'
                  ? t('studio.deleteProjectDesc')
                  : t('agent.switchDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirm()}>
              {confirmAction?.type === 'delete' || confirmAction?.type === 'deleteProject'
                ? t('common.delete')
                : t('agent.confirmSwitch')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CenteredNote({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
      {text}
    </div>
  )
}
