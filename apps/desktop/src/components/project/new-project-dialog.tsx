import * as React from 'react'
import { useTranslation } from 'react-i18next'

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
import { createProject } from '@/lib/db/project-repo'
import { api } from '@/lib/electron/api'

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (projectId: string) => void
}

export function NewProjectDialog({ open, onOpenChange, onCreated }: NewProjectDialogProps) {
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
