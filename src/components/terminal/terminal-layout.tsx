import { useNavigate } from '@tanstack/react-router'
import { PlusIcon, TerminalIcon } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTerminalStore } from '@/lib/store/terminal-store'
import type { GroupMode, SessionGroup, TerminalSession } from '@/lib/terminal/types'
import { cn } from '@/lib/utils'

import { InfoPanel } from './info-panel'
import { TabsTree } from './tabs-tree'

interface TerminalLayoutProps {
  activeSessionId: string
  insertCommandRef: React.MutableRefObject<((cmd: string) => void) | null>
  homeDir: string
  children: React.ReactNode
}

export function TerminalLayout({
  activeSessionId,
  insertCommandRef,
  homeDir,
  children,
}: TerminalLayoutProps) {
  const sessions = useTerminalStore((s) => s.sessions)
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const activeCwd = activeSession?.cwd ?? ''

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="20%" minSize="15%" maxSize="40%">
          <TabsTreeSidebar activeSessionId={activeSessionId} activeCwd={activeCwd} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="60%" minSize="30%">
          {children}
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="20%" minSize="15%" maxSize="40%">
          <InfoPanel
            sessionId={activeSessionId}
            cwd={activeCwd}
            homeDir={homeDir}
            onInsertCommand={(cmd) => insertCommandRef.current?.(cmd)}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

function TabsTreeSidebar({
  activeSessionId,
  activeCwd,
}: {
  activeSessionId: string
  activeCwd: string
}) {
  const sessions = useTerminalStore((s) => s.sessions)
  const groupMode = useTerminalStore((s) => s.groupMode)
  const setGroupMode = useTerminalStore((s) => s.setGroupMode)
  const loaded = useTerminalStore((s) => s.loaded)
  const closeSession = useTerminalStore((s) => s.closeSession)
  const createSession = useTerminalStore((s) => s.createSession)
  const navigate = useNavigate()

  const groups = React.useMemo(() => {
    return groupSessions(sessions, groupMode)
  }, [sessions, groupMode])

  const handleNewSession = async () => {
    const session = await createSession(activeCwd)
    void navigate({ to: '/terminal/$sessionId', params: { sessionId: session.id } })
  }

  const handleClose = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await closeSession(id)
    const remaining = useTerminalStore.getState().sessions
    if (activeSessionId === id) {
      if (remaining.length > 0) {
        void navigate({ to: '/terminal/$sessionId', params: { sessionId: remaining[0]!.id } })
      } else {
        void navigate({ to: '/terminal' })
      }
    }
  }

  return (
    <div className="flex h-full flex-col border-r border-border bg-muted/30">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <TerminalIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Sessions</span>
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={handleNewSession}>
          <PlusIcon className="size-4" />
        </Button>
      </div>
      <div className="flex items-center gap-1 px-2 pb-1">
        <GroupModeButton active={groupMode === 'time'} onClick={() => setGroupMode('time')}>
          Time
        </GroupModeButton>
        <GroupModeButton active={groupMode === 'path'} onClick={() => setGroupMode('path')}>
          Path
        </GroupModeButton>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-1 pb-2">
          {loaded && sessions.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              No sessions yet
            </div>
          ) : (
            groups.map((group) => (
              <SessionGroupItem
                key={group.key}
                group={group}
                activeSessionId={activeSessionId}
                onClose={handleClose}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function GroupModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function SessionGroupItem({
  group,
  activeSessionId,
  onClose,
}: {
  group: SessionGroup
  activeSessionId: string
  onClose: (e: React.MouseEvent, id: string) => void
}) {
  return (
    <div className="mb-1">
      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{group.label}</div>
      <TabsTree sessions={group.sessions} activeSessionId={activeSessionId} onClose={onClose} />
    </div>
  )
}

function groupSessions(sessions: TerminalSession[], mode: GroupMode): SessionGroup[] {
  if (mode === 'time') {
    const now = Date.now()
    const todayStart = new Date(now).setHours(0, 0, 0, 0)
    const yesterdayStart = todayStart - 86400000
    const weekStart = todayStart - 7 * 86400000

    const today: TerminalSession[] = []
    const yesterday: TerminalSession[] = []
    const thisWeek: TerminalSession[] = []
    const older: TerminalSession[] = []

    for (const s of sessions) {
      const ts = s.last_active_at
      if (ts >= todayStart) today.push(s)
      else if (ts >= yesterdayStart) yesterday.push(s)
      else if (ts >= weekStart) thisWeek.push(s)
      else older.push(s)
    }

    const groups: SessionGroup[] = []
    if (today.length > 0) groups.push({ key: 'today', label: 'Today', sessions: today })
    if (yesterday.length > 0)
      groups.push({ key: 'yesterday', label: 'Yesterday', sessions: yesterday })
    if (thisWeek.length > 0) groups.push({ key: 'week', label: 'This Week', sessions: thisWeek })
    if (older.length > 0) groups.push({ key: 'older', label: 'Older', sessions: older })
    return groups
  }

  const byPath = new Map<string, TerminalSession[]>()
  for (const s of sessions) {
    const key = s.cwd
    const list = byPath.get(key) ?? []
    list.push(s)
    byPath.set(key, list)
  }

  const groups: SessionGroup[] = []
  for (const [key, list] of byPath) {
    const parts = key.split('/')
    const label = parts.length > 2 ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}` : key
    groups.push({ key, label, sessions: list })
  }
  return groups.sort((a, b) => b.sessions[0]!.last_active_at - a.sessions[0]!.last_active_at)
}
