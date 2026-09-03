import { ClapperboardIcon, FolderOpenIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { bootstrapShortDramaProject } from '@/components/screenplay/screenplay-template'
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
import { createProject, getProjectByPath } from '@/lib/db/project-repo'
import { api } from '@/lib/electron/api'
import { canCreateTemplateInDirectory } from '@/lib/project/project-import'

interface NewProjectDialogProps {
  open: boolean
  mode: 'create' | 'import'
  onOpenChange: (open: boolean) => void
  onCreated: (projectId: string) => void
}

export function NewProjectDialog({ open, mode, onOpenChange, onCreated }: NewProjectDialogProps) {
  const { t } = useTranslation()
  const [dialogMode, setDialogMode] = React.useState<'create' | 'import'>(mode)
  const [title, setTitle] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setDialogMode(mode)
      setError(null)
    }
  }, [mode, open])

  const folderName = (path: string): string => path.split(/[\\/]/).filter(Boolean).pop() ?? ''

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
      const projectTitle = title.trim() || folderName(dir) || t('home.untitledProject')

      if (dialogMode === 'create') {
        const entries = await api.fs.readDir(dir)
        if (!canCreateTemplateInDirectory(entries)) throw new Error(t('home.createFolderEmpty'))
        await bootstrapShortDramaProject(dir, projectTitle)
      }

      const project = (await getProjectByPath(dir)) ?? (await createProject(dir, projectTitle))
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {dialogMode === 'create' ? t('home.createProjectTitle') : t('home.importProjectTitle')}
          </DialogTitle>
          <DialogDescription>
            {dialogMode === 'create' ? t('home.createProjectDesc') : t('home.importProjectDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={dialogMode === 'create'}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${dialogMode === 'create' ? 'border-amber-500/50 bg-amber-500/[0.07]' : 'border-border/70 hover:bg-accent'}`}
              onClick={() => setDialogMode('create')}
            >
              <ClapperboardIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <span className="min-w-0">
                <span className="block text-xs font-medium">{t('home.createMode')}</span>
                <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
                  {t('home.createModeHint')}
                </span>
              </span>
            </button>
            <button
              type="button"
              aria-pressed={dialogMode === 'import'}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${dialogMode === 'import' ? 'border-amber-500/50 bg-amber-500/[0.07]' : 'border-border/70 hover:bg-accent'}`}
              onClick={() => setDialogMode('import')}
            >
              <FolderOpenIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <span className="min-w-0">
                <span className="block text-xs font-medium">{t('home.importMode')}</span>
                <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
                  {t('home.importModeHint')}
                </span>
              </span>
            </button>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="project-title" className="text-xs font-medium">
              {t('home.projectTitle')}
            </label>
            <Input
              id="project-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('home.projectTitlePlaceholder')}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void create()} disabled={busy}>
            {busy
              ? t('common.creating')
              : dialogMode === 'create'
                ? t('home.pickFolderAndCreate')
                : t('home.pickFolderAndImport')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
