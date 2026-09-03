import {
  ArrowUpDownIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  SettingsIcon,
  Trash2Icon,
} from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Project } from '@/lib/db/project-repo'
import { api } from '@/lib/electron/api'
import { useProjectStore, type ProjectListSort } from '@/lib/store/project-store'
import { cn } from '@/lib/utils'

interface StudioSidebarProps {
  projects: Project[]
  activeProjectId: string | null
  onOpenProject: (projectId: string) => void
  onDeleteProject: (projectId: string) => void
  onNewProject: () => void
}

function compareBySort(sort: ProjectListSort) {
  return (a: Project, b: Project) =>
    sort === 'name' ? a.title.localeCompare(b.title) : b.last_active_at - a.last_active_at
}

/** Project launcher sidebar. The former top-level chat/session surface is intentionally gone. */
export function StudioSidebar({
  projects,
  activeProjectId,
  onOpenProject,
  onDeleteProject,
  onNewProject,
}: StudioSidebarProps) {
  const { t } = useTranslation()
  const listSort = useProjectStore((s) => s.projectListSort)
  const setListSort = useProjectStore((s) => s.setProjectListSort)
  const [sortMenuOpen, setSortMenuOpen] = React.useState(false)

  const sortedProjects = React.useMemo(
    () => [...projects].sort(compareBySort(listSort)),
    [projects, listSort],
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between px-3">
        <span className="text-xs font-semibold">Kenvo</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onNewProject}
                aria-label={t('studio.newProject')}
              >
                <FolderPlusIcon className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent>{t('studio.newProject')}</TooltipContent>
        </Tooltip>
      </div>

      <ScrollArea className="min-h-0 min-w-0 flex-1" contentClassName="min-w-0! w-full">
        <div className="px-1.5 py-1">
          <div className="group flex items-center justify-between px-2 pt-1 pb-1.5">
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {t('studio.projects')}
            </span>
            <DropdownMenu open={sortMenuOpen} onOpenChange={setSortMenuOpen}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      className={cn(
                        'rounded p-1 text-muted-foreground outline-none transition-opacity hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                        sortMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                      )}
                      aria-label={t('studio.sort')}
                    >
                      <ArrowUpDownIcon className="size-3" />
                    </DropdownMenuTrigger>
                  }
                />
                <TooltipContent side="right" sideOffset={8}>
                  {t('studio.sort')}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>{t('studio.sort')}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={listSort}
                  onValueChange={(value) => setListSort(value as ProjectListSort)}
                >
                  <DropdownMenuRadioItem value="recent" className="text-xs">
                    {t('studio.sortRecent')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="name" className="text-xs">
                    {t('studio.sortName')}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {sortedProjects.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
              <FolderIcon className="size-5 text-muted-foreground/70" />
              <p className="text-xs text-muted-foreground">{t('studio.noProjects')}</p>
              <Button variant="outline" size="xs" onClick={onNewProject}>
                {t('studio.newProject')}
              </Button>
            </div>
          ) : (
            sortedProjects.map((project) => {
              const active = project.id === activeProjectId
              return (
                <div
                  key={project.id}
                  className={cn(
                    'group relative flex w-full items-center rounded-md transition-colors',
                    active ? 'bg-accent' : 'hover:bg-accent/60',
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={() => onOpenProject(project.id)}
                    aria-label={`${t('studio.openProject')}: ${project.title}`}
                  >
                    {active ? (
                      <FolderOpenIcon className="size-3.5 shrink-0 text-amber-600" />
                    ) : (
                      <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className={cn('truncate text-xs', active && 'font-medium')}>
                      {project.title}
                    </span>
                  </button>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          className="absolute top-1/2 right-1 hidden -translate-y-1/2 rounded p-1 text-muted-foreground group-hover:block hover:bg-background hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          onClick={(event) => {
                            event.stopPropagation()
                            onDeleteProject(project.id)
                          }}
                          aria-label={t('studio.deleteProject')}
                        >
                          <Trash2Icon className="size-3" />
                        </button>
                      }
                    />
                    <TooltipContent side="right" sideOffset={8}>
                      {t('studio.deleteProject')}
                    </TooltipContent>
                  </Tooltip>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-border p-1.5">
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={() => void api.window.openSettings()}
        >
          <SettingsIcon className="size-3.5 shrink-0" />
          {t('settings.title')}
        </button>
      </div>
    </div>
  )
}
