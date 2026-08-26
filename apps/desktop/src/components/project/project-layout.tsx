import { PanelLeftIcon, PanelRightIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { agentIcon, agentName } from '@/components/agent/agent-meta'
import { AgentPanel } from '@/components/agent/agent-panel'
import { SessionList } from '@/components/agent/session-list'
import { EditorDrawer } from '@/components/editor/editor-drawer'
import { AppHeader } from '@/components/layout/app-header'
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
import { getAiSettings, resolveAgentModel } from '@/lib/ai/settings-bridge'
import {
  createChatSession,
  deleteChatSession,
  getChatSession,
  listChatMessages,
  listChatSessions,
  type ChatSession,
} from '@/lib/db/chat-repo'
import type { Project } from '@/lib/db/project-repo'
import { api } from '@/lib/electron/api'
import { useProjectStore } from '@/lib/store/project-store'

interface ProjectLayoutProps {
  project: Project
}

type ConfirmAction =
  | { type: 'switch'; sessionId: string }
  | { type: 'new' }
  | { type: 'delete'; sessionId: string }

/**
 * Chat-centric writing studio: session history on the left, the agent
 * conversation as the main view, and the file editor as an overlay drawer.
 */
export function ProjectLayout({ project }: ProjectLayoutProps) {
  const { t } = useTranslation()
  const leftOpen = useProjectStore((s) => s.leftSidebarOpen)
  const toggleLeft = useProjectStore((s) => s.toggleLeftSidebar)
  const toggleEditor = useProjectStore((s) => s.toggleEditor)
  const bumpTree = useProjectStore((s) => s.bumpTree)

  const [sessions, setSessions] = React.useState<ChatSession[]>([])
  const [chatSessionId, setChatSessionId] = React.useState<string | null>(null)
  const [historyMessages, setHistoryMessages] = React.useState<UiMessage[]>([])
  const [serverPort, setServerPort] = React.useState<number | null>(null)
  const [sessionError, setSessionError] = React.useState<string | null>(null)
  const [agentRunning, setAgentRunning] = React.useState(false)
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction | null>(null)
  const assignmentRef = React.useRef<{ providerId: string; modelId: string } | null>(null)

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
    setSessions(await listChatSessions(project.id))
  }, [project.id])

  /** Load the persisted transcript and (re)create the server-side agent session. */
  const startServerSession = React.useCallback(
    async (session: ChatSession, port: number): Promise<UiMessage[]> => {
      const assignment = assignmentRef.current
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
    [project.agent_id, project.path, t],
  )

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

  // Initial setup: configure providers, then resume the most recent session
  // (or create the first one).
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
        assignmentRef.current = assignment

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
        const history = await startServerSession(session, port)
        if (!cancelled) {
          setSessions(existing.length > 0 ? existing : [session])
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
  }, [serverPort, project.id, project.agent_id, project.path, t, startServerSession])

  // ---------- Session switching ----------

  const activateSession = async (sessionId: string, force = false) => {
    if (!serverPort || sessionId === chatSessionId) return
    if (agentRunning && !force) {
      setConfirmAction({ type: 'switch', sessionId })
      return
    }
    try {
      await stopServerSession(chatSessionId, serverPort)
      const session = sessions.find((s) => s.id === sessionId) ?? (await getChatSession(sessionId))
      if (!session) return
      const history = await startServerSession(session, serverPort)
      setHistoryMessages(history)
      setChatSessionId(session.id)
      setSessionError(null)
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : String(e))
    }
  }

  const newSession = async (force = false) => {
    if (!serverPort) return
    if (agentRunning && !force) {
      setConfirmAction({ type: 'new' })
      return
    }
    const assignment = assignmentRef.current
    if (!assignment) {
      setSessionError(t('agent.noModel'))
      return
    }
    try {
      await stopServerSession(chatSessionId, serverPort)
      const session = await createChatSession(
        project.id,
        project.agent_id,
        assignment.providerId,
        assignment.modelId,
      )
      const client = createAgentServerClient(serverPort)
      await client.createSession({
        sessionId: session.id,
        agentId: project.agent_id,
        projectRoot: project.path,
        providerId: assignment.providerId,
        modelId: assignment.modelId,
        history: [],
      })
      setHistoryMessages([])
      setChatSessionId(session.id)
      setSessionError(null)
      await refreshSessions()
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : String(e))
    }
  }

  const performDelete = async (sessionId: string) => {
    const isActive = sessionId === chatSessionId
    try {
      if (isActive) {
        await stopServerSession(chatSessionId, serverPort)
        setChatSessionId(null)
        setHistoryMessages([])
      }
      await deleteChatSession(sessionId)
      const remaining = await listChatSessions(project.id)
      setSessions(remaining)
      if (isActive && serverPort) {
        const next = remaining[0]
        if (next) {
          const history = await startServerSession(next, serverPort)
          setHistoryMessages(history)
          setChatSessionId(next.id)
        } else {
          await newSession(true)
        }
      }
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
    else await performDelete(action.sessionId)
  }

  const AgentBadgeIcon = agentIcon(project.agent_id)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <AppHeader
        leftContent={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleLeft}
              aria-label={t('project.toggleSessions')}
            >
              <PanelLeftIcon className="size-3.5" />
            </Button>
            <span className="truncate text-xs font-medium">{project.title}</span>
            <span className="ml-1 flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              <AgentBadgeIcon className="size-3" />
              {agentName(project.agent_id)}
            </span>
          </div>
        }
        rightContent={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleEditor}
            aria-label={t('project.toggleEditor')}
            title={t('project.toggleEditor')}
          >
            <PanelRightIcon className="size-3.5" />
          </Button>
        }
      />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal">
          {leftOpen && (
            <>
              <ResizablePanel defaultSize="16%" minSize="12%" maxSize="30%">
                <SessionList
                  sessions={sessions}
                  activeSessionId={chatSessionId}
                  onSelect={(id) => void activateSession(id)}
                  onNew={() => void newSession()}
                  onDelete={(id) => setConfirmAction({ type: 'delete', sessionId: id })}
                />
              </ResizablePanel>
              <ResizableHandle />
            </>
          )}

          <ResizablePanel minSize="40%">
            {!serverPort ? (
              <CenteredNote text={t('agent.serverStopped')} />
            ) : sessionError ? (
              <CenteredNote text={sessionError} />
            ) : chatSessionId ? (
              <AgentPanel
                key={chatSessionId}
                sessionId={chatSessionId}
                agentId={project.agent_id}
                serverPort={serverPort}
                initialMessages={historyMessages}
                onFileActivity={bumpTree}
                onSessionActivity={refreshSessions}
                onRunningChange={setAgentRunning}
              />
            ) : (
              <CenteredNote text={t('agent.connecting')} />
            )}
          </ResizablePanel>
        </ResizablePanelGroup>

        <EditorDrawer />
      </div>

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
                : t('agent.switchTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'delete'
                ? t('agent.deleteSessionDesc')
                : t('agent.switchDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirm()}>
              {confirmAction?.type === 'delete' ? t('common.delete') : t('agent.confirmSwitch')}
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
