import { ClapperboardIcon, FolderOpenIcon } from 'lucide-react'
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
import type { Project } from '@/lib/db/project-repo'
import type { ProjectConfig, ProjectViewId } from '@/lib/project/project-config'
import { PROJECT_VIEWS } from '@/lib/project/project-views'
import { cn } from '@/lib/utils'

interface ProjectViewPickerProps {
  open: boolean
  project: Project | null
  config: ProjectConfig | null
  invalidConfig?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (viewId: ProjectViewId) => void
}

export function ProjectViewPicker({
  open,
  project,
  config,
  invalidConfig = false,
  onOpenChange,
  onConfirm,
}: ProjectViewPickerProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = React.useState<ProjectViewId>('screenplay')

  React.useEffect(() => {
    if (open) setSelected(config?.defaultView ?? 'screenplay')
  }, [config?.defaultView, open])

  const current = PROJECT_VIEWS.find((view) => view.id === selected) ?? PROJECT_VIEWS[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('projectViews.pickerTitle')}</DialogTitle>
          <DialogDescription>{t('projectViews.pickerDescription')}</DialogDescription>
        </DialogHeader>

        {project && (
          <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/25 px-3 py-2">
            <FolderOpenIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{project.title}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">{project.path}</p>
            </div>
          </div>
        )}

        {invalidConfig && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
            {t('projectViews.invalidConfig')}
          </p>
        )}

        <div className="grid gap-2" aria-label={t('projectViews.pickerTitle')}>
          {PROJECT_VIEWS.map((view) => {
            const active = selected === view.id
            return (
              <button
                key={view.id}
                type="button"
                aria-pressed={active}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  active
                    ? 'border-amber-500/60 bg-amber-500/[0.08]'
                    : 'border-border/70 bg-background hover:border-amber-500/40 hover:bg-accent/50',
                )}
                onClick={() => setSelected(view.id)}
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg border',
                    active
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-600'
                      : 'border-border bg-muted/50 text-muted-foreground',
                  )}
                >
                  <ClapperboardIcon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{t(view.labelKey)}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {t(view.descriptionKey)}
                  </span>
                </span>
                <span
                  className={cn(
                    'ml-auto mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border',
                    active ? 'border-amber-600' : 'border-muted-foreground/40',
                  )}
                >
                  {active && <span className="size-2 rounded-full bg-amber-600" />}
                </span>
              </button>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onConfirm(current.id)} disabled={!project}>
            {t('projectViews.openView')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
