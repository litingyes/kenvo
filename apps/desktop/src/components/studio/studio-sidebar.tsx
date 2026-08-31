import { useNavigate } from '@tanstack/react-router'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import {
  ArrowUpDownIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  SettingsIcon,
  SquarePenIcon,
  Trash2Icon,
} from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import 'dayjs/locale/zh-cn'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ChatSession } from '@/lib/db/chat-repo'
import type { Project } from '@/lib/db/project-repo'
import {
  useProjectStore,
  type SessionListMode,
  type SessionListSort,
} from '@/lib/store/project-store'
import { cn } from '@/lib/utils'

dayjs.extend(localizedFormat)

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

function compareBySort(sort: SessionListSort) {
  return (
    a: { last_active_at: number; title: string | null },
    b: { last_active_at: number; title: string | null },
  ) =>
    sort === 'name'
      ? (a.title ?? '').localeCompare(b.title ?? '')
      : b.last_active_at - a.last_active_at
}

function formatSessionLastActive(timestamp: number, language: string): string {
  const locale = language.toLowerCase().startsWith('zh') ? 'zh-cn' : 'en'
  return dayjs(timestamp).locale(locale).format('lll')
}

/**
 * Codex-style studio sidebar: chat sessions across all projects, either
 * grouped under their project (collapsible sections) or as a flat list.
 * The "项目" section header exposes new-project / sort / view actions on hover.
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
  const setListMode = useProjectStore((s) => s.setSessionListMode)
  const listSort = useProjectStore((s) => s.sessionListSort)
  const setListSort = useProjectStore((s) => s.setSessionListSort)
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())
  const [sortMenuOpen, setSortMenuOpen] = React.useState(false)

  const sortedProjects = React.useMemo(
    () => [...projects].sort(compareBySort(listSort)),
    [projects, listSort],
  )
  const sortedSessions = React.useMemo(
    () => [...sessions].sort(compareBySort(listSort)),
    [sessions, listSort],
  )

  const sessionsByProject = React.useMemo(() => {
    const map = new Map<string, ChatSession[]>()
    for (const session of sortedSessions) {
      const list = map.get(session.project_id) ?? []
      list.push(session)
      map.set(session.project_id, list)
    }
    return map
  }, [sortedSessions])

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
    const title = session.title || t('agent.untitled')
    const lastActive = formatSessionLastActive(session.last_active_at, i18n.language)
    return (
      <div
        key={session.id}
        className={cn(
          'group relative flex w-full items-center rounded text-left',
          active ? 'bg-accent' : 'hover:bg-accent/60',
        )}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className={cn('min-w-0 flex-1 py-1.5 pr-6 text-left', indent ? 'pl-7' : 'px-2')}
                onClick={() => onSelectSession(session.id)}
              >
                <span className="block truncate text-xs font-medium">{title}</span>
              </button>
            }
          />
          <TooltipContent side="right" align="start" sideOffset={8} className="max-w-72 text-left">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium break-words whitespace-normal">{title}</span>
              <span className="text-background/70">
                {t('studio.sessionLastActive')}: {lastActive}
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
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

      {/* Session history */}
      <ScrollArea className="min-h-0 min-w-0 flex-1" contentClassName="min-w-0! w-full">
        <div className="px-1.5 py-1">
          {/* Projects section header: hover reveals new-project + sort/view actions */}
          <div className="group flex items-center justify-between px-2 pt-1 pb-1.5">
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {t('studio.projects')}
            </span>
            <div
              className={cn(
                'flex items-center gap-0.5 transition-opacity',
                sortMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              )}
            >
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={onNewProject}
                aria-label={t('studio.newProject')}
                title={t('studio.newProject')}
              >
                <FolderPlusIcon className="size-3" />
              </button>
              <DropdownMenu open={sortMenuOpen} onOpenChange={setSortMenuOpen}>
                <DropdownMenuTrigger
                  className="rounded p-0.5 text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
                  aria-label={t('studio.sort')}
                  title={t('studio.sort')}
                >
                  <ArrowUpDownIcon className="size-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuRadioGroup
                    value={listSort}
                    onValueChange={(value) => setListSort(value as SessionListSort)}
                  >
                    <DropdownMenuLabel>{t('studio.sort')}</DropdownMenuLabel>
                    <DropdownMenuRadioItem value="recent" className="text-xs">
                      {t('studio.sortRecent')}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="name" className="text-xs">
                      {t('studio.sortName')}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={listMode}
                    onValueChange={(value) => setListMode(value as SessionListMode)}
                  >
                    <DropdownMenuLabel>{t('studio.view')}</DropdownMenuLabel>
                    <DropdownMenuRadioItem value="grouped" className="text-xs">
                      {t('studio.groupByProject')}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="flat" className="text-xs">
                      {t('studio.flatList')}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {projects.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {t('studio.noProjects')}
            </p>
          ) : listMode === 'flat' ? (
            sortedSessions.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                {t('studio.noChats')}
              </p>
            ) : (
              sortedSessions.map((session) => sessionRow(session, false))
            )
          ) : (
            sortedProjects.map((project) => {
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
                        <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <FolderOpenIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
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
        </div>
      </ScrollArea>

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
