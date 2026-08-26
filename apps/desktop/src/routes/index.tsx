import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { agentIcon } from '@/components/agent/agent-meta'
import { AppHeader } from '@/components/layout/app-header'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createAgentServerClient, type AgentMetadata } from '@/lib/ai/server-client'
import { listProjects, createProject, deleteProject, type Project } from '@/lib/db/project-repo'
import { api } from '@/lib/electron/api'

export const Route = createFileRoute('/')({
  loader: async () => {
    const projects = await listProjects()
    return { projects }
  },
  component: HomePage,
})

function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { projects: initialProjects } = Route.useLoaderData()
  const [projects, setProjects] = React.useState<Project[]>(initialProjects)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const openProject = (id: string) => {
    void navigate({ to: '/project/$projectId', params: { projectId: id } })
  }

  const removeProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteProject(id)
    setProjects(await listProjects())
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <AppHeader
        leftContent={<span className="text-xs font-semibold">Kenvo</span>}
        rightContent={
          <Button variant="ghost" size="sm" onClick={() => void navigate({ to: '/settings' })}>
            {t('settings.title')}
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-8 px-8 py-16">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{t('home.slogan')}</h1>
            <p className="text-sm text-muted-foreground">{t('home.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="flex h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <PlusIcon className="size-5" />
              <span className="text-xs">{t('home.newProject')}</span>
            </button>

            {projects.map((project) => {
              const Icon = agentIcon(project.agent_id)
              return (
                <div key={project.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => openProject(project.id)}
                    className="flex h-28 w-full flex-col items-start justify-between rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-foreground/30"
                  >
                    <Icon className="size-5 text-muted-foreground" />
                    <div className="flex w-full flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">{project.title}</span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {project.path}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="absolute top-2 right-2 hidden rounded p-1 text-muted-foreground group-hover:block hover:bg-accent hover:text-destructive"
                    onClick={(e) => void removeProject(project.id, e)}
                    aria-label={t('common.delete')}
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <NewProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => openProject(id)}
      />
    </div>
  )
}

function NewProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (projectId: string) => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = React.useState('')
  const [agents, setAgents] = React.useState<AgentMetadata[]>([])
  const [agentId, setAgentId] = React.useState('writer')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    void api.agentServer
      .status()
      .then(async (status) => {
        if (!status.running || !status.port) return
        const client = createAgentServerClient(status.port)
        setAgents(await client.getAgents())
      })
      .catch(() => {})
  }, [open])

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await api.dialog.showOpenDialog({
        title: t('home.pickFolder'),
        properties: ['openDirectory', 'createDirectory'],
      })
      if (result.canceled || result.filePaths.length === 0) {
        setBusy(false)
        return
      }
      const dir = result.filePaths[0]
      const projectTitle = title.trim() || dir.split('/').pop() || 'Untitled'

      // Materialize the agent's project template (only missing files).
      const status = await api.agentServer.status()
      if (status.running && status.port) {
        const client = createAgentServerClient(status.port)
        try {
          const files = await client.getAgentTemplate(agentId)
          for (const file of files) {
            const abs = `${dir}/${file.path}`
            if (file.path.endsWith('.gitkeep')) {
              if (!(await api.fs.exists(abs))) {
                await api.fs.mkdir(abs.slice(0, -'.gitkeep'.length), true)
              }
              continue
            }
            if (!(await api.fs.exists(abs))) {
              await api.fs.writeTextFile(abs, file.content)
            }
          }
        } catch {
          // Template materialization is best-effort.
        }
      }

      const project = await createProject(dir, projectTitle, agentId)
      onOpenChange(false)
      onCreated(project.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('home.newProject')}</DialogTitle>
          <DialogDescription>{t('home.newProjectDesc')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('home.projectTitle')}
          />
          <Select value={agentId} onValueChange={(value) => value && setAgentId(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(agents.length > 0
                ? agents
                : [
                    { id: 'writer', name: 'Writer', description: '' },
                    { id: 'novelist', name: 'Novelist', description: '' },
                    { id: 'screenwriter', name: 'Screenwriter', description: '' },
                    { id: 'prompt-engineer', name: 'Prompt Engineer', description: '' },
                  ]
              ).map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void create()} disabled={busy}>
            {busy ? t('common.creating') : t('home.pickFolderAndCreate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
