import { useNavigate } from '@tanstack/react-router'
import { ArrowRightIcon, FolderIcon, PanelLeftIcon, PlusIcon, SparklesIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  deleteProject,
  getProject,
  listProjects,
  touchProject,
  type Project,
} from '@/lib/db/project-repo'
import { useProjectStore } from '@/lib/store/project-store'

type ConfirmAction = { type: 'deleteProject'; projectId: string } | null
export type ProjectDialogMode = 'create' | 'import'

/** Project launcher: every project opens directly in the screenplay workbench. */
export function StudioLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const leftOpen = useProjectStore((s) => s.leftSidebarOpen)
  const toggleLeft = useProjectStore((s) => s.toggleLeftSidebar)

  const [projects, setProjects] = React.useState<Project[]>([])
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null)
  const [newProjectOpen, setNewProjectOpen] = React.useState(false)
  const [projectDialogMode, setProjectDialogMode] = React.useState<ProjectDialogMode>('create')
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction>(null)
  const [error, setError] = React.useState<string | null>(null)

  const refreshProjects = React.useCallback(async () => {
    setProjects(await listProjects())
  }, [])

  React.useEffect(() => {
    void refreshProjects().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }, [refreshProjects])

  const handleOpenProject = async (projectId: string) => {
    try {
      const project =
        projects.find((item) => item.id === projectId) ?? (await getProject(projectId))
      if (!project) return
      setError(null)
      await touchProject(project.id)
      setActiveProjectId(project.id)
      await navigate({ to: '/screenplay/$projectId', params: { projectId: project.id } })
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const handleProjectCreated = async (projectId: string) => {
    await refreshProjects()
    const project = await getProject(projectId)
    if (!project) return
    setActiveProjectId(project.id)
    await navigate({ to: '/screenplay/$projectId', params: { projectId } })
  }

  const openProjectDialog = (mode: ProjectDialogMode) => {
    setProjectDialogMode(mode)
    setNewProjectOpen(true)
  }

  const handleDeleteProject = async () => {
    const projectId = confirmAction?.projectId
    setConfirmAction(null)
    if (!projectId) return
    try {
      await deleteProject(projectId)
      if (activeProjectId === projectId) setActiveProjectId(null)
      await refreshProjects()
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const sidebarToggle = (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleLeft}
            aria-label={t('project.toggleProjects')}
          >
            <PanelLeftIcon className="size-3.5" />
          </Button>
        }
      />
      <TooltipContent>{t('project.toggleProjects')}</TooltipContent>
    </Tooltip>
  )

  return (
    <div className="h-screen w-screen overflow-hidden bg-background" data-testid="project-launcher">
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        {leftOpen && (
          <>
            <ResizablePanel defaultSize="22%" minSize="17%" maxSize="32%">
              <div className="flex h-full flex-col">
                <AppHeader leftContent={sidebarToggle} bordered={false} />
                <div className="min-h-0 flex-1">
                  <StudioSidebar
                    projects={projects}
                    activeProjectId={activeProjectId}
                    onOpenProject={(id) => void handleOpenProject(id)}
                    onDeleteProject={(id) =>
                      setConfirmAction({ type: 'deleteProject', projectId: id })
                    }
                    onNewProject={() => openProjectDialog('create')}
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
                <div className="flex min-w-0 items-center gap-2">
                  <FolderIcon className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">{t('studio.projects')}</span>
                </div>
              }
              rightContent={
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="xs" onClick={() => openProjectDialog('import')}>
                    <FolderIcon />
                    {t('studio.importProject')}
                  </Button>
                  <Button variant="outline" size="xs" onClick={() => openProjectDialog('create')}>
                    <PlusIcon />
                    {t('studio.newProject')}
                  </Button>
                </div>
              }
            />
            <ScrollArea
              className="min-h-0 flex-1"
              viewportClassName="px-6 py-8"
              contentClassName="min-h-full"
            >
              <div
                className="mx-auto flex w-full max-w-5xl flex-col gap-8"
                data-testid="project-home"
              >
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.18em] text-amber-600 uppercase">
                    <SparklesIcon className="size-3.5" />
                    {t('studio.workbenchEyebrow')}
                  </div>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                    {t('studio.launcherTitle')}
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {t('studio.launcherDescription')}
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {error}
                  </div>
                )}

                {projects.length === 0 ? (
                  <div className="flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-600">
                      <FolderIcon className="size-6" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold">{t('studio.noProjects')}</h2>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t('studio.noProjectsHint')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => openProjectDialog('create')}>
                        <PlusIcon />
                        {t('studio.newProject')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openProjectDialog('import')}
                      >
                        <FolderIcon />
                        {t('studio.importProject')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        className="group flex min-h-36 flex-col justify-between rounded-xl border border-border/70 bg-card p-4 text-left transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-amber-500/50 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        onClick={() => void handleOpenProject(project.id)}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                            <FolderIcon className="size-4" />
                          </span>
                          <ArrowRightIcon className="size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-amber-600" />
                        </span>
                        <span>
                          <span className="block truncate text-sm font-medium">
                            {project.title}
                          </span>
                          <span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">
                            {project.path}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        mode={projectDialogMode}
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
            <AlertDialogTitle>{t('studio.deleteProjectTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('studio.deleteProjectDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteProject()}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
