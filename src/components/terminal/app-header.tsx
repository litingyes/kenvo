import { ChevronDownIcon, PanelLeftOpenIcon, PanelRightOpenIcon } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTerminalStore } from '@/lib/store/terminal-store'

import {
  SessionActionDialogs,
  SessionDropdownItems,
  useSessionActions,
} from './session-action-menu'

interface AppHeaderProps {
  activeSessionId: string
}

export function AppHeader({ activeSessionId }: AppHeaderProps) {
  const leftOpen = useTerminalStore((s) => s.leftSidebarOpen)
  const rightOpen = useTerminalStore((s) => s.rightSidebarOpen)
  const toggleLeft = useTerminalStore((s) => s.toggleLeftSidebar)
  const toggleRight = useTerminalStore((s) => s.toggleRightSidebar)
  const activeSession = useTerminalStore((s) => s.sessions.find((x) => x.id === activeSessionId))

  const actions = useSessionActions(activeSession ?? PLACEHOLDER_SESSION)
  const [open, setOpen] = React.useState(false)

  return (
    <div
      data-tauri-drag-region
      className="flex h-9 shrink-0 items-center border-b border-border bg-background pl-20"
    >
      {/* Left: open left sidebar (only when collapsed) */}
      {!leftOpen && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 [-webkit-app-region:no-drag]"
          onClick={toggleLeft}
          aria-label="Open left sidebar"
        >
          <PanelLeftOpenIcon className="size-3.5" />
        </Button>
      )}

      {/* Drag spacer */}
      <div data-tauri-drag-region className="min-w-2 flex-1 self-stretch" />

      {/* Center: session name dropdown */}
      {activeSession && (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="max-w-[40%] shrink-0 gap-1 px-2 text-xs font-medium [-webkit-app-region:no-drag]"
              />
            }
          >
            <span className="truncate">
              {activeSession.title ?? getCwdDisplay(activeSession.cwd)}
            </span>
            <ChevronDownIcon className="size-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="min-w-52">
            <SessionDropdownItems
              session={activeSession}
              actions={actions}
              closeMenu={() => setOpen(false)}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Drag spacer */}
      <div data-tauri-drag-region className="min-w-2 flex-1 self-stretch" />

      {/* Right: open right sidebar (only when collapsed) */}
      {!rightOpen && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 pr-2 [-webkit-app-region:no-drag]"
          onClick={toggleRight}
          aria-label="Open right sidebar"
        >
          <PanelRightOpenIcon className="size-3.5" />
        </Button>
      )}

      {activeSession && <SessionActionDialogs session={activeSession} actions={actions} />}
    </div>
  )
}

function getCwdDisplay(cwd: string): string {
  if (cwd === '/' || cwd === '') return '/'
  const parts = cwd.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1] || cwd
}

const PLACEHOLDER_SESSION = {
  id: '',
  title: null,
  cwd: '',
  created_at: 0,
  last_active_at: 0,
}
