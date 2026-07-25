import type { TFunction } from 'i18next'
import {
  CopyIcon,
  CopyPlusIcon,
  ExternalLinkIcon,
  FolderOpenIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

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
import {
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu'
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useWorkspaceStore } from '@/lib/store/workspace-store'
import { openPathInEditor } from '@/lib/terminal/open-with'
import { copyToClipboard, revealInFinder } from '@/lib/terminal/opener-helpers'
import type { EditorApp, TerminalSession } from '@/lib/terminal/types'

export interface SessionActionsProps {
  session: TerminalSession
  closeMenu?: () => void
}

function useEditorSubmenuState() {
  const availableEditors = useWorkspaceStore((s) => s.availableEditors)
  const detect = useWorkspaceStore((s) => s.detectAvailableEditors)
  const [loading, setLoading] = React.useState(false)
  const [editors, setEditors] = React.useState<EditorApp[] | null>(availableEditors)

  const handleOpen = React.useCallback(async () => {
    if (availableEditors) {
      setEditors(availableEditors)
      return
    }
    setLoading(true)
    const found = await detect()
    setEditors(found)
    setLoading(false)
  }, [availableEditors, detect])

  return { loading, editors, handleOpen }
}

function editorChoices(editors: EditorApp[] | null, loading: boolean) {
  if (loading) return { state: 'loading' as const }
  if (editors && editors.length > 0) {
    return { state: 'list' as const, editors }
  }
  return { state: 'empty' as const }
}

export function useSessionActions(session: TerminalSession) {
  const [renameOpen, setRenameOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [duplicateOpen, setDuplicateOpen] = React.useState(false)
  const renameSession = useWorkspaceStore((s) => s.renameSession)
  const duplicateSession = useWorkspaceStore((s) => s.duplicateSession)
  const closeSession = useWorkspaceStore((s) => s.closeSession)
  const [renameValue, setRenameValue] = React.useState(session.title ?? '')

  return {
    renameOpen,
    deleteOpen,
    duplicateOpen,
    renameValue,
    setRenameValue,
    setRenameOpen,
    setDeleteOpen,
    setDuplicateOpen,
    confirmRename: async () => {
      const trimmed = renameValue.trim()
      if (!trimmed) return
      await renameSession(session.id, trimmed)
      setRenameOpen(false)
    },
    requestRename: () => {
      setRenameValue(session.title ?? '')
      setRenameOpen(true)
    },
    requestDelete: () => setDeleteOpen(true),
    requestDuplicate: () => setDuplicateOpen(true),
    confirmDuplicate: async () => {
      const dup = await duplicateSession(session.id)
      setDuplicateOpen(false)
      return dup
    },
    confirmDelete: async () => {
      await closeSession(session.id)
      setDeleteOpen(false)
    },
  }
}

export function SessionActionDialogs({
  actions,
}: {
  session: TerminalSession
  actions: ReturnType<typeof useSessionActions>
}) {
  const { t } = useTranslation()
  const onDup = async () => {
    const dup = await actions.confirmDuplicate()
    if (dup) await useWorkspaceStore.getState().openTerminalTabForSession(dup.id)
  }
  return (
    <>
      <Dialog open={actions.renameOpen} onOpenChange={actions.setRenameOpen}>
        <DialogContent>
          <DialogTitle>{t('session.dialogs.rename.title')}</DialogTitle>
          <Input
            value={actions.renameValue}
            onChange={(e) => actions.setRenameValue(e.target.value)}
            placeholder={t('session.dialogs.rename.placeholder')}
            onKeyDown={(e) => e.key === 'Enter' && void actions.confirmRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => actions.setRenameOpen(false)}>
              {t('session.dialogs.rename.cancel')}
            </Button>
            <Button onClick={() => void actions.confirmRename()}>
              {t('session.dialogs.rename.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={actions.deleteOpen} onOpenChange={actions.setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('session.dialogs.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('session.dialogs.delete.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('session.dialogs.delete.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void actions.confirmDelete()}>
              {t('session.dialogs.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={actions.duplicateOpen} onOpenChange={actions.setDuplicateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('session.dialogs.duplicate.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('session.dialogs.duplicate.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('session.dialogs.duplicate.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onDup()}>
              {t('session.dialogs.duplicate.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function buildHandlers(session: TerminalSession, closeMenu?: () => void) {
  return {
    copyPath: async () => {
      await copyToClipboard(session.cwd)
      closeMenu?.()
    },
    reveal: async () => {
      await revealInFinder(session.cwd)
      closeMenu?.()
    },
    openIn: async (cli: string) => {
      await openPathInEditor(session.cwd, cli)
      closeMenu?.()
    },
  }
}

interface MenuPrimitives {
  Sub: React.ComponentType<{ children: React.ReactNode; onOpenChange?: (v: boolean) => void }>
  SubTrigger: React.ComponentType<{ children?: React.ReactNode; className?: string }>
  SubContent: React.ComponentType<{ children: React.ReactNode }>
  Group: React.ComponentType<{ children: React.ReactNode }>
  Label: React.ComponentType<{ children: React.ReactNode }>
  Item: React.ComponentType<{
    children: React.ReactNode
    onClick?: () => void
    variant?: 'default' | 'destructive'
    disabled?: boolean
  }>
  ItemSep: React.ComponentType<{}>
}

function buildItemTree(
  primitives: MenuPrimitives,
  session: TerminalSession,
  actions: ReturnType<typeof useSessionActions>,
  closeMenu: (() => void) | undefined,
  submenu: ReturnType<typeof useEditorSubmenuState>,
  t: TFunction,
) {
  const handlers = buildHandlers(session, closeMenu)
  const choices = editorChoices(submenu.editors, submenu.loading)
  const { Sub, SubTrigger, SubContent, Group, Label, Item, ItemSep } = primitives

  return (
    <>
      <Item onClick={actions.requestRename}>
        <PencilIcon /> {t('session.actions.rename')}
      </Item>
      <Item onClick={handlers.copyPath}>
        <CopyIcon /> {t('session.actions.copyPath')}
      </Item>
      <Item onClick={handlers.reveal}>
        <FolderOpenIcon /> {t('session.actions.reveal')}
      </Item>
      <Sub onOpenChange={(open) => open && void submenu.handleOpen()}>
        <SubTrigger>
          <ExternalLinkIcon /> {t('session.actions.openIn')}
        </SubTrigger>
        <SubContent>
          {choices.state === 'loading' ? (
            <Item disabled>{t('session.editor.loading')}</Item>
          ) : choices.state === 'list' ? (
            <Group>
              <Label>{t('session.editor.label')}</Label>
              {choices.editors.map((app) => (
                <Item key={app.cli} onClick={() => handlers.openIn(app.cli)}>
                  {app.name}
                </Item>
              ))}
            </Group>
          ) : (
            <Item disabled>{t('session.editor.empty')}</Item>
          )}
        </SubContent>
      </Sub>
      <ItemSep />
      <Item onClick={actions.requestDuplicate}>
        <CopyPlusIcon /> {t('session.actions.duplicate')}
      </Item>
      <Item variant="destructive" onClick={actions.requestDelete}>
        <Trash2Icon /> {t('session.actions.delete')}
      </Item>
    </>
  )
}

const DROPDOWN_PRIMITIVES: MenuPrimitives = {
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
  Group: DropdownMenuGroup,
  Label: DropdownMenuLabel,
  Item: DropdownMenuItem,
  ItemSep: DropdownMenuSeparator,
}

const CONTEXT_PRIMITIVES: MenuPrimitives = {
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
  Group: ContextMenuGroup,
  Label: ContextMenuLabel,
  Item: ContextMenuItem,
  ItemSep: ContextMenuSeparator,
}

export function SessionDropdownItems({
  session,
  actions,
  closeMenu,
}: SessionActionsProps & { actions: ReturnType<typeof useSessionActions> }) {
  const { t } = useTranslation()
  const submenu = useEditorSubmenuState()
  return buildItemTree(DROPDOWN_PRIMITIVES, session, actions, closeMenu, submenu, t)
}

export function SessionContextMenuItems({
  session,
  actions,
  closeMenu,
}: SessionActionsProps & { actions: ReturnType<typeof useSessionActions> }) {
  const { t } = useTranslation()
  const submenu = useEditorSubmenuState()
  return buildItemTree(CONTEXT_PRIMITIVES, session, actions, closeMenu, submenu, t)
}
