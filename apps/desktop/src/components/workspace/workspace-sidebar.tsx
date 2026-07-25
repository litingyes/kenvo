import { useNavigate } from '@tanstack/react-router'
import { PanelLeftCloseIcon, PlusIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useWorkspaceStore, workspaceBasename } from '@/lib/store/workspace-store'
import { openPathInEditor } from '@/lib/terminal/open-with'
import { copyToClipboard, revealInFinder } from '@/lib/terminal/opener-helpers'
import type { EditorApp, Workspace } from '@/lib/terminal/types'
import { cn } from '@/lib/utils'

export function WorkspaceSidebar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace)
  const addWorkspaceViaDialog = useWorkspaceStore((s) => s.addWorkspaceViaDialog)
  const toggleLeftSidebar = useWorkspaceStore((s) => s.toggleLeftSidebar)

  const handleAdd = React.useCallback(async () => {
    const ws = await addWorkspaceViaDialog()
    if (ws) void navigate({ to: '/workspace/$workspaceId', params: { workspaceId: ws.id } })
  }, [addWorkspaceViaDialog, navigate])

  return (
    <div className="flex h-full flex-col border-r border-border">
      <div className="flex items-center justify-end gap-0.5 px-2 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => void handleAdd()}
          aria-label={t('workspace.addFolder')}
        >
          <PlusIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={toggleLeftSidebar}
          aria-label={t('terminal.collapseSidebar')}
        >
          <PanelLeftCloseIcon className="size-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="px-1 pb-2">
          {workspaces.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              {t('workspace.empty')}
            </div>
          ) : (
            workspaces.map((ws) => (
              <WorkspaceRow key={ws.id} workspace={ws} active={activeWorkspace?.id === ws.id} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function WorkspaceRow({ workspace, active }: { workspace: Workspace; active: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace)
  const renameWorkspace = useWorkspaceStore((s) => s.renameWorkspace)
  const availableEditors = useWorkspaceStore((s) => s.availableEditors)
  const detect = useWorkspaceStore((s) => s.detectAvailableEditors)
  const [editors, setEditors] = React.useState<EditorApp[] | null>(availableEditors)
  const [renameOpen, setRenameOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [renameValue, setRenameValue] = React.useState(
    workspace.title ?? workspaceBasename(workspace.path),
  )

  const handleClick = () => {
    void navigate({ to: '/workspace/$workspaceId', params: { workspaceId: workspace.id } })
  }

  const openEditors = async () => {
    if (!availableEditors) setEditors(await detect())
  }

  const handleDelete = async () => {
    await removeWorkspace(workspace.id)
    setDeleteOpen(false)
    const recent = useWorkspaceStore.getState().workspaces[0]
    if (recent) {
      void navigate({ to: '/workspace/$workspaceId', params: { workspaceId: recent.id } })
    } else {
      void navigate({ to: '/workspace' })
    }
  }

  const title = workspace.title ?? workspaceBasename(workspace.path)

  return (
    <div className="mb-0.5">
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <button
              type="button"
              aria-label={title}
              onClick={handleClick}
              className={cn(
                'flex min-w-0 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted/50 hover:text-foreground',
              )}
            />
          }
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-xs font-medium text-foreground">{title}</span>
            <span className="truncate text-[11px] text-muted-foreground/70" title={workspace.path}>
              {workspace.path}
            </span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-44">
          <ContextMenuItem
            onClick={() => {
              setRenameValue(title)
              setRenameOpen(true)
            }}
          >
            {t('workspace.rename')}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => void copyToClipboard(workspace.path)}>
            {t('session.actions.copyPath')}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => void revealInFinder(workspace.path)}>
            {t('session.actions.reveal')}
          </ContextMenuItem>
          <ContextMenuSub onOpenChange={(open) => open && void openEditors()}>
            <ContextMenuSubTrigger>{t('session.actions.openIn')}</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {editors && editors.length > 0 ? (
                <ContextMenuGroup>
                  <ContextMenuLabel>{t('session.editor.label')}</ContextMenuLabel>
                  {editors.map((app) => (
                    <ContextMenuItem
                      key={app.cli}
                      onClick={() => void openPathInEditor(workspace.path, app.cli)}
                    >
                      {app.name}
                    </ContextMenuItem>
                  ))}
                </ContextMenuGroup>
              ) : (
                <ContextMenuItem disabled>{t('session.editor.empty')}</ContextMenuItem>
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            {t('workspace.delete')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogTitle>{t('workspace.dialogs.rename.title')}</DialogTitle>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder={workspaceBasename(workspace.path)}
            onKeyDown={(e) => e.key === 'Enter' && void confirmRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              {t('session.dialogs.rename.cancel')}
            </Button>
            <Button onClick={() => void confirmRename()}>{t('session.dialogs.rename.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogTitle>{t('workspace.dialogs.delete.title')}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {t('workspace.dialogs.delete.description')}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t('session.dialogs.delete.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>
              {t('session.dialogs.delete.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  async function confirmRename() {
    const trimmed = renameValue.trim()
    if (!trimmed) return
    await renameWorkspace(workspace.id, trimmed)
    setRenameOpen(false)
  }
}
