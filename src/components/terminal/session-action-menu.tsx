import { useNavigate } from '@tanstack/react-router'
import {
  CopyIcon,
  CopyPlusIcon,
  ExternalLinkIcon,
  FolderOpenIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import * as React from 'react'

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
import { useTerminalStore } from '@/lib/store/terminal-store'
import { openPathInEditor } from '@/lib/terminal/open-with'
import { copyToClipboard, revealInFinder } from '@/lib/terminal/opener-helpers'
import type { EditorApp, TerminalSession } from '@/lib/terminal/types'

export interface SessionActionsProps {
  session: TerminalSession
  closeMenu?: () => void
}

function useEditorSubmenuState() {
  const availableEditors = useTerminalStore((s) => s.availableEditors)
  const detect = useTerminalStore((s) => s.detectAvailableEditors)
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
  const renameSession = useTerminalStore((s) => s.renameSession)
  const duplicateSession = useTerminalStore((s) => s.duplicateSession)
  const closeSession = useTerminalStore((s) => s.closeSession)
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
      await duplicateSession(session.id)
      setDuplicateOpen(false)
    },
    confirmDelete: async () => {
      await closeSession(session.id)
      setDeleteOpen(false)
    },
  }
}

export function SessionActionDialogs({
  session,
  actions,
}: {
  session: TerminalSession
  actions: ReturnType<typeof useSessionActions>
}) {
  const navigate = useNavigate()
  const onDup = async () => {
    await actions.confirmDuplicate()
    const next = useTerminalStore.getState().activeId
    if (next && next !== session.id) {
      void navigate({ to: '/terminal/$sessionId', params: { sessionId: next } })
    }
  }
  return (
    <>
      <Dialog open={actions.renameOpen} onOpenChange={actions.setRenameOpen}>
        <DialogContent>
          <DialogTitle>Rename Session</DialogTitle>
          <Input
            value={actions.renameValue}
            onChange={(e) => actions.setRenameValue(e.target.value)}
            placeholder="Session name"
            onKeyDown={(e) => e.key === 'Enter' && void actions.confirmRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => actions.setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void actions.confirmRename()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={actions.deleteOpen} onOpenChange={actions.setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The session and its history will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void actions.confirmDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={actions.duplicateOpen} onOpenChange={actions.setDuplicateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate this session?</AlertDialogTitle>
            <AlertDialogDescription>
              Creates a new session with the same working directory and command history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onDup()}>Duplicate</AlertDialogAction>
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
) {
  const handlers = buildHandlers(session, closeMenu)
  const choices = editorChoices(submenu.editors, submenu.loading)
  const { Sub, SubTrigger, SubContent, Group, Label, Item, ItemSep } = primitives

  return (
    <>
      <Item onClick={actions.requestRename}>
        <PencilIcon /> Rename
      </Item>
      <Item onClick={handlers.copyPath}>
        <CopyIcon /> Copy Path
      </Item>
      <Item onClick={handlers.reveal}>
        <FolderOpenIcon /> Reveal in Finder
      </Item>
      <Sub onOpenChange={(open) => open && void submenu.handleOpen()}>
        <SubTrigger>
          <ExternalLinkIcon /> Open in…
        </SubTrigger>
        <SubContent>
          {choices.state === 'loading' ? (
            <Item disabled>Loading…</Item>
          ) : choices.state === 'list' ? (
            <Group>
              <Label>Editor</Label>
              {choices.editors.map((app) => (
                <Item key={app.cli} onClick={() => handlers.openIn(app.cli)}>
                  {app.name}
                </Item>
              ))}
            </Group>
          ) : (
            <Item disabled>No editors detected</Item>
          )}
        </SubContent>
      </Sub>
      <ItemSep />
      <Item onClick={actions.requestDuplicate}>
        <CopyPlusIcon /> Duplicate
      </Item>
      <Item variant="destructive" onClick={actions.requestDelete}>
        <Trash2Icon /> Delete
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
  const submenu = useEditorSubmenuState()
  return buildItemTree(DROPDOWN_PRIMITIVES, session, actions, closeMenu, submenu)
}

export function SessionContextMenuItems({
  session,
  actions,
  closeMenu,
}: SessionActionsProps & { actions: ReturnType<typeof useSessionActions> }) {
  const submenu = useEditorSubmenuState()
  return buildItemTree(CONTEXT_PRIMITIVES, session, actions, closeMenu, submenu)
}
