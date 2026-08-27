import { useNavigate } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderPlusIcon,
  ListIcon,
  MessageSquareIcon,
  SettingsIcon,
  SquarePenIcon,
  Trash2Icon,
} from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { ChatSession } from '@/lib/db/chat-repo'
import type { Project } from '@/lib/db/project-repo'
import { useProjectStore } from '@/lib/store/project-store'
import { cn } from '@/lib/utils'

interface StudioSidebarProps {
  projects: Project[]
  sessions: ChatSession[]
  activeSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  onDeleteSession: (sessionId: string) => void
  onDeleteProject: (projectId: string) => void
  onNewProject: () => void
}

/**
 * Codex-style studio sidebar: chat sessions across all projects, either
 * grouped under their project (collapsible sections) or as a flat,
 * time-sorted list. Settings and project creation live here too.
 */
export function StudioSidebar({
  projects,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onDeleteProject,
  onNewProject,
}: StudioSidebarProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const listMode = useProjectStore((s) => s.sessionListMode)
  const toggleListMode = useProjectStore((s) => s.toggleSessionListMode)
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())

  const locale = i18n.language.startsWith('zh') ? zhCN : enUS
  const relativeTime = (timestamp: number) =>
    formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale })

  const sessionsByProject = React.useMemo(() => {
    const map = new Map<string, ChatSession[]>()
    for (const session of sessions) {
      const list = map.get(session.project_id) ?? []
      list.push(session)
      map.set(session.project_id, list)
    }
    return map
  }, [sessions])

  const projectById = React.useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  const toggleProject = (projectId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const sessionRow = (session: ChatSession, indent: boolean) => {
    const active = session.id === activeSessionId
    const project = projectById.get(session.project_id)
    return (
      <div
        key={session.id}
        className={cn(
          'group relative flex w-full items-center rounded text-left',
          active ? 'bg-accent' : 'hover:bg-accent/60',
        )}
      >
        <button
          type="button"
          className={cn(
            'flex min-w-0 flex-1 flex-col gap-0.5 py-1.5 pr-6',
            indent ? 'pl-7' : 'px-2',
          )}
          onClick={() => onSelectSession(session.id)}
        >
          <span className="flex items-center gap-1.5">
            <MessageSquareIcon className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate text-xs font-medium">
              {session.title || t('agent.untitled')}
            </span>
          </span>
          <span className="truncate pl-[18px] text-[10px] text-muted-foreground">
            {listMode === 'flat' && project ? `${project.title} · ` : ''}
            {relativeTime(session.last_active_at)}
          </span>
        </button>
        <button
          type="button"
          className="absolute top-1/2 right-1 hidden -translate-y-1/2 rounded p-1 text-muted-foreground group-hover:block hover:bg-background hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDeleteSession(session.id)
          }}
          aria-label={t('agent.deleteSession')}
          title={t('agent.deleteSession')}
        >
          <Trash2Icon className="size-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Brand + actions */}
      <div className="flex h-9 shrink-0 items-center justify-between px-3">
        <span className="text-xs font-semibold">Kenvo</span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleListMode}
            aria-label={listMode === 'grouped' ? t('studio.flatList') : t('studio.groupByProject')}
            title={listMode === 'grouped' ? t('studio.flatList') : t('studio.groupByProject')}
          >
            {listMode === 'grouped' ? (
              <ListIcon className="size-3.5" />
            ) : (
              <FolderIcon className="size-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onNewSession}
            aria-label={t('studio.newChat')}
            title={t('studio.newChat')}
          >
            <SquarePenIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Session history */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
        <div className="px-2 pt-1 pb-1.5">
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {t('agent.sessions')}
          </span>
        </div>

        {projects.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            {t('studio.noProjects')}
          </p>
        ) : listMode === 'flat' ? (
          sessions.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {t('studio.noChats')}
            </p>
          ) : (
            sessions.map((session) => sessionRow(session, false))
          )
        ) : (
          projects.map((project) => {
            const projectSessions = sessionsByProject.get(project.id) ?? []
            const isCollapsed = collapsed.has(project.id)
            const hasActive = projectSessions.some((s) => s.id === activeSessionId)
            return (
              <div key={project.id} className="mb-1">
                <div className="group relative flex w-full items-center rounded hover:bg-accent/60">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left"
                    onClick={() => toggleProject(project.id)}
                  >
                    {isCollapsed ? (
                      <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" />
                    )}
                    <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span
                      className={cn(
                        'truncate text-xs',
                        hasActive ? 'font-medium' : 'text-muted-foreground',
                      )}
                    >
                      {project.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="absolute top-1/2 right-1 hidden -translate-y-1/2 rounded p-1 text-muted-foreground group-hover:block hover:bg-background hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteProject(project.id)
                    }}
                    aria-label={t('studio.deleteProject')}
                    title={t('studio.deleteProject')}
                  >
                    <Trash2Icon className="size-3" />
                  </button>
                </div>
                {!isCollapsed &&
                  (projectSessions.length === 0 ? (
                    <p className="py-1 pl-9 text-[10px] text-muted-foreground">
                      {t('studio.noChats')}
                    </p>
                  ) : (
                    projectSessions.map((session) => sessionRow(session, true))
                  ))}
              </div>
            )
          })
        )}

        <button
          type="button"
          className="mt-1 flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          onClick={onNewProject}
        >
          <FolderPlusIcon className="size-3.5 shrink-0" />
          {t('studio.newProject')}
        </button>
      </div>

      {/* Bottom: settings */}
      <div className="shrink-0 border-t border-border p-1.5">
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          onClick={() => void navigate({ to: '/settings' })}
        >
          <SettingsIcon className="size-3.5 shrink-0" />
          {t('settings.title')}
        </button>
      </div>
    </div>
  )
}
