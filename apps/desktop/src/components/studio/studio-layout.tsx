import { FolderIcon, PanelLeftIcon, PanelRightIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { AgentPanel } from '@/components/agent/agent-panel'
import { skillIcon, skillName } from '@/components/agent/skill-meta'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { UiMessage } from '@/lib/agent/use-agent-chat'
import {
  createAgentServerClient,
  type ProviderMetadata,
  type SkillMetadata,
} from '@/lib/ai/server-client'
import {
  getAiSettings,
  isModelUsable,
  listUsableModels,
  resolveDefaultModel,
  type AiSettings,
  type ModelRef,
} from '@/lib/ai/settings-bridge'
import {
  createChatSession,
  deleteChatSession,
  getChatSession,
  listAllChatSessions,
  listChatMessages,
  updateChatSessionConfig,
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

/** Session config (skill + model) chosen in chat. */
interface SessionConfig {
  skillId: string
  providerId: string
  modelId: string
}

const LAST_CONFIG_KEY = 'kenvo:chat-config'
const DEFAULT_SKILL_ID = 'writer'

function readLastConfig(): Partial<SessionConfig> | null {
  try {
    const raw = localStorage.getItem(LAST_CONFIG_KEY)
    return raw ? (JSON.parse(raw) as Partial<SessionConfig>) : null
  } catch {
    return null
  }
}

function writeLastConfig(config: SessionConfig): void {
  try {
    localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(config))
  } catch {
    // Best effort.
  }
}

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
  const [aiSettings, setAiSettingsState] = React.useState<AiSettings | null>(null)
  const [skills, setSkills] = React.useState<SkillMetadata[]>([])
  const [providers, setProviders] = React.useState<ProviderMetadata[]>([])
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

  /**
   * Resolve the model a session should run with: the session's own stored
   * model when still usable, otherwise the default (first enabled) model.
   */
  const resolveSessionModel = React.useCallback((session: ChatSession): ModelRef | null => {
    const settings = settingsRef.current
    if (!settings) return null
    const stored =
      session.provider_id && session.model_id
        ? { providerId: session.provider_id, modelId: session.model_id }
        : null
    if (stored && isModelUsable(settings, stored)) return stored
    return resolveDefaultModel(settings) ?? null
  }, [])

  /** Load the persisted transcript and (re)create the server-side agent session. */
  const startServerSession = React.useCallback(
    async (session: ChatSession, project: Project, port: number): Promise<UiMessage[]> => {
      const settings = settingsRef.current
      let model = resolveSessionModel(session)
      if (!model) throw new Error(t('agent.noModel'))
      const rows = await listChatMessages(session.id)
      const history = rows.map((r) => JSON.parse(r.message) as UiMessage)
      const client = createAgentServerClient(port)
      const create = (m: ModelRef) =>
        client.createSession({
          sessionId: session.id,
          skillId: session.skill_id,
          projectRoot: project.path,
          providerId: m.providerId,
          modelId: m.modelId,
          history,
        })
      // Try the session's model, then every other enabled model: a stored
      // model may have vanished from the provider's catalog since.
      const seen = new Set<string>()
      const candidates = [model, ...(settings ? listUsableModels(settings) : [])].filter((m) => {
        const key = `${m.providerId}/${m.modelId}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      let lastError: unknown = null
      let created = false
      for (const candidate of candidates) {
        try {
          await create(candidate)
          model = candidate
          created = true
          break
        } catch (e) {
          lastError = e
        }
      }
      if (!created) throw lastError
      // Persist the effective model so the session runs consistently.
      if (model.providerId !== session.provider_id || model.modelId !== session.model_id) {
        const effective: ModelRef = model
        await updateChatSessionConfig(session.id, {
          providerId: effective.providerId,
          modelId: effective.modelId,
        }).catch(() => {})
        setSessions((prev) =>
          prev.map((s) =>
            s.id === session.id
              ? { ...s, provider_id: effective.providerId, model_id: effective.modelId }
              : s,
          ),
        )
      }
      return history
    },
    [t, resolveSessionModel],
  )

  /** Create a fresh chat session under the given project and activate it. */
  const createSessionForProject = React.useCallback(
    async (project: Project, port: number): Promise<ChatSession> => {
      const settings = settingsRef.current
      const last = readLastConfig()
      const lastModel =
        last?.providerId && last?.modelId
          ? { providerId: last.providerId, modelId: last.modelId }
          : null
      const model =
        settings && lastModel && isModelUsable(settings, lastModel)
          ? lastModel
          : settings
            ? (resolveDefaultModel(settings) ?? null)
            : null
      if (!model) throw new Error(t('agent.noModel'))
      const skillId = last?.skillId ?? DEFAULT_SKILL_ID
      const session = await createChatSession(project.id, skillId, model.providerId, model.modelId)
      const client = createAgentServerClient(port)
      await client.createSession({
        sessionId: session.id,
        skillId,
        projectRoot: project.path,
        providerId: model.providerId,
        modelId: model.modelId,
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
        if (!cancelled) setAiSettingsState(settings)

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

        // Skills + provider names feed the chat pickers (best effort).
        try {
          const [skillList, providerList] = await Promise.all([
            client.getSkills(),
            client.getProviders(),
          ])
          if (!cancelled) {
            setSkills(skillList)
            setProviders(providerList)
          }
        } catch {
          // Pickers fall back to ids.
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

  /**
   * Switch the active session's skill and/or model. The server-side agent is
   * rebuilt in place (same session id, transcript preserved). Pickers are
   * disabled while a run is active, so no abort handling is needed here.
   */
  const handleSessionConfigChange = async (update: {
    skillId?: string
    providerId?: string
    modelId?: string
  }) => {
    if (!serverPort || !activeSession || !activeProject || agentRunning) return
    const next: SessionConfig = {
      skillId: update.skillId ?? activeSession.skill_id,
      providerId: update.providerId ?? activeSession.provider_id ?? '',
      modelId: update.modelId ?? activeSession.model_id ?? '',
    }
    if (!next.providerId || !next.modelId) {
      const fallback = resolveSessionModel(activeSession)
      if (!fallback) {
        setSessionError(t('agent.noModel'))
        return
      }
      next.providerId = fallback.providerId
      next.modelId = fallback.modelId
    }
    try {
      await updateChatSessionConfig(activeSession.id, next)
      writeLastConfig(next)
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? {
                ...s,
                skill_id: next.skillId,
                provider_id: next.providerId,
                model_id: next.modelId,
              }
            : s,
        ),
      )
      const client = createAgentServerClient(serverPort)
      await client.destroySession(activeSession.id).catch(() => {})
      const rows = await listChatMessages(activeSession.id)
      const history = rows.map((r) => JSON.parse(r.message) as UiMessage)
      await client.createSession({
        sessionId: activeSession.id,
        skillId: next.skillId,
        projectRoot: activeProject.path,
        providerId: next.providerId,
        modelId: next.modelId,
        history,
      })
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

  const AgentBadgeIcon = activeSession ? skillIcon(activeSession.skill_id) : null

  const sidebarToggle = (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleLeft}
            aria-label={t('project.toggleSessions')}
          >
            <PanelLeftIcon className="size-3.5" />
          </Button>
        }
      />
      <TooltipContent>{t('project.toggleSessions')}</TooltipContent>
    </Tooltip>
  )

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        {leftOpen && (
          <>
            <ResizablePanel defaultSize="18%" minSize="14%" maxSize="30%">
              <div className="flex h-full flex-col">
                {/* Sidebar top bar: hosts the macOS traffic lights + sidebar toggle. */}
                <AppHeader leftContent={sidebarToggle} bordered={false} />
                <div className="min-h-0 flex-1">
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
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle />
          </>
        )}

        <ResizablePanel minSize="30%">
          <div className="flex h-full flex-col">
            <AppHeader
              withTrafficLightInset={!leftOpen}
              leftContent={leftOpen ? undefined : sidebarToggle}
              centerContent={
                activeProject && activeSession ? (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs font-medium">
                      {activeSession.title || t('agent.untitled')}
                    </span>
                    {AgentBadgeIcon && activeSession && (
                      <span className="ml-1 flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                        <AgentBadgeIcon className="size-3" />
                        {skillName(activeSession.skill_id)}
                      </span>
                    )}
                  </div>
                ) : null
              }
              rightContent={
                activeSessionId ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={toggleRight}
                          aria-label={t('project.toggleRightPanel')}
                        >
                          <PanelRightIcon className="size-3.5" />
                        </Button>
                      }
                    />
                    <TooltipContent>{t('project.toggleRightPanel')}</TooltipContent>
                  </Tooltip>
                ) : null
              }
            />

            <div className="min-h-0 flex-1">
              {!serverPort ? (
                <CenteredNote text={t('agent.serverStopped')} />
              ) : sessionError ? (
                <CenteredNote text={sessionError} />
              ) : activeSession && activeProject ? (
                <AgentPanel
                  key={activeSession.id}
                  sessionId={activeSession.id}
                  skillId={activeSession.skill_id}
                  modelRef={
                    activeSession.provider_id && activeSession.model_id
                      ? { providerId: activeSession.provider_id, modelId: activeSession.model_id }
                      : null
                  }
                  skills={skills}
                  providers={providers}
                  settings={aiSettings}
                  onConfigChange={(update) => void handleSessionConfigChange(update)}
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
            </div>
          </div>
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
