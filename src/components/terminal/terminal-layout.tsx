import { useNavigate } from '@tanstack/react-router'
import { PanelLeftCloseIcon, PlusIcon, TerminalIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { AppHeader } from '@/components/layout/app-header'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { sortSessions, useTerminalStore } from '@/lib/store/terminal-store'
import type { GroupMode, SessionGroup, SortMode, TerminalSession } from '@/lib/terminal/types'

import { InfoPanel } from './info-panel'
import { SessionGroupMenu } from './session-group-menu'
import { TabsTree } from './tabs-tree'
import { TerminalHeaderRight } from './terminal-header-right'

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
  const leftOpen = useTerminalStore((s) => s.leftSidebarOpen)
  const rightOpen = useTerminalStore((s) => s.rightSidebarOpen)
  const toggleLeft = useTerminalStore((s) => s.toggleLeftSidebar)
  const toggleRight = useTerminalStore((s) => s.toggleRightSidebar)
  const createSession = useTerminalStore((s) => s.createSession)
  const navigate = useNavigate()

  const handleNewSession = React.useCallback(async () => {
    const session = await createSession(activeCwd)
    void navigate({ to: '/terminal/$sessionId', params: { sessionId: session.id } })
  }, [activeCwd, createSession, navigate])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <AppHeader
        leftSidebarOpen={leftOpen}
        rightSidebarOpen={rightOpen}
        onToggleLeftSidebar={toggleLeft}
        onToggleRightSidebar={toggleRight}
        rightContent={
          <TerminalHeaderRight activeSessionId={activeSessionId} onNewSession={handleNewSession} />
        }
      />
      <div className="flex min-h-0 flex-1">
        <ResizablePanelGroup orientation="horizontal">
          {leftOpen && (
            <>
              <ResizablePanel defaultSize="20%" minSize="15%" maxSize="40%">
                <TabsTreeSidebar
                  activeSessionId={activeSessionId}
                  onNewSession={handleNewSession}
                />
              </ResizablePanel>
              <ResizableHandle />
            </>
          )}
          <ResizablePanel defaultSize={leftOpen ? '60%' : '80%'} minSize="30%">
            {children}
          </ResizablePanel>
          {rightOpen && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize="20%" minSize="15%" maxSize="40%">
                <InfoPanel
                  sessionId={activeSessionId}
                  cwd={activeCwd}
                  homeDir={homeDir}
                  onInsertCommand={(cmd) => insertCommandRef.current?.(cmd)}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  )
}

function TabsTreeSidebar({
  activeSessionId,
  onNewSession,
}: {
  activeSessionId: string
  onNewSession: () => void
}) {
  const { t } = useTranslation()
  const sessions = useTerminalStore((s) => s.sessions)
  const groupMode = useTerminalStore((s) => s.groupMode)
  const sortMode = useTerminalStore((s) => s.sortMode)
  const loaded = useTerminalStore((s) => s.loaded)
  const closeSession = useTerminalStore((s) => s.closeSession)
  const toggleLeftSidebar = useTerminalStore((s) => s.toggleLeftSidebar)
  const navigate = useNavigate()

  const groups = React.useMemo(() => {
    const sorted = sortSessions(sessions, sortMode)
    return groupSessions(sorted, groupMode, sortMode)
  }, [sessions, groupMode, sortMode])

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
    <div className="flex h-full flex-col border-r border-border">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <TerminalIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t('terminal.sessions')}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <SessionGroupMenu />
          <Button variant="ghost" size="icon" className="size-7" onClick={onNewSession}>
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
      </div>
      <ScrollArea className="flex-1">
        <div className="px-1 pb-2">
          {loaded && sessions.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              {t('terminal.noSessions')}
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

function SessionGroupItem({
  group,
  activeSessionId,
  onClose,
}: {
  group: SessionGroup
  activeSessionId: string
  onClose: (e: React.MouseEvent, id: string) => void
}) {
  const { t } = useTranslation()
  const label = isTimeGroup(group.key) ? t(`terminal.timeLabels.${group.key}`) : group.label

  return (
    <div className="mb-1">
      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{label}</div>
      <TabsTree sessions={group.sessions} activeSessionId={activeSessionId} onClose={onClose} />
    </div>
  )
}

function isTimeGroup(key: string): boolean {
  return ['today', 'yesterday', 'thisWeek', 'older'].includes(key)
}

function groupSessions(
  sessions: TerminalSession[],
  mode: GroupMode,
  sortMode: SortMode,
): SessionGroup[] {
  if (mode === 'none') {
    return [{ key: 'all', label: '', sessions }]
  }
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
      const ts = sortMode === 'created' ? s.created_at : s.last_active_at
      if (ts >= todayStart) today.push(s)
      else if (ts >= yesterdayStart) yesterday.push(s)
      else if (ts >= weekStart) thisWeek.push(s)
      else older.push(s)
    }

    const groups: SessionGroup[] = []
    if (today.length > 0) groups.push({ key: 'today', label: '', sessions: today })
    if (yesterday.length > 0) groups.push({ key: 'yesterday', label: '', sessions: yesterday })
    if (thisWeek.length > 0) groups.push({ key: 'thisWeek', label: '', sessions: thisWeek })
    if (older.length > 0) groups.push({ key: 'older', label: '', sessions: older })
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
  return groups.sort((a, b) => {
    const av = sortMode === 'created' ? a.sessions[0]!.created_at : a.sessions[0]!.last_active_at
    const bv = sortMode === 'created' ? b.sessions[0]!.created_at : b.sessions[0]!.last_active_at
    return bv - av
  })
}
