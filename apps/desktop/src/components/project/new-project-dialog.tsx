import * as React from 'react'
import { useTranslation } from 'react-i18next'

import {
  bootstrapShortDramaProject,
  type ProjectTemplate,
} from '@/components/screenplay/screenplay-template'
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
import { createProject } from '@/lib/db/project-repo'
import { api } from '@/lib/electron/api'
import { ensureProjectConfig } from '@/lib/project/project-config'

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (projectId: string, template: ProjectTemplate) => void
}

export function NewProjectDialog({ open, onOpenChange, onCreated }: NewProjectDialogProps) {
  const { t } = useTranslation()
  const [title, setTitle] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [template, setTemplate] = React.useState<ProjectTemplate>('short-video-drama')

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

      if (template === 'short-video-drama') {
        await bootstrapShortDramaProject(dir, projectTitle)
      } else {
        const readmePath = `${dir}/README.md`
        if (!(await api.fs.exists(readmePath))) {
          await api.fs.writeTextFile(readmePath, `# ${projectTitle}\n\nManaged by Kenvo.\n`)
        }
      }

      await ensureProjectConfig(dir, template)

      const project = await createProject(dir, projectTitle)
      onOpenChange(false)
      onCreated(project.id, template)
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
          <div className="grid gap-1.5">
            <label className="text-xs font-medium">{t('home.projectTemplate')}</label>
            <Select
              value={template}
              onValueChange={(value) => setTemplate(value as ProjectTemplate)}
            >
              <SelectTrigger aria-label={t('home.projectTemplate')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short-video-drama">
                  {t('home.templates.shortVideoDrama')}
                </SelectItem>
                <SelectItem value="blank">{t('home.templates.blank')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
