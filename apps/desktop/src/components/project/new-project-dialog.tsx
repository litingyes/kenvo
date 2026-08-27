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
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

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

      // Seed an empty folder with a minimal README so the project is navigable.
      const readmePath = `${dir}/README.md`
      try {
        if (!(await api.fs.exists(readmePath))) {
          await api.fs.writeTextFile(readmePath, `# ${projectTitle}\n\nManaged by Kenvo.\n`)
        }
      } catch {
        // README seeding is best-effort.
      }

      const project = await createProject(dir, projectTitle)
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
