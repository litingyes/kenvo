import { MoreHorizontalIcon, PlusIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTerminalStore } from '@/lib/store/terminal-store'
import type { TerminalSession } from '@/lib/terminal/types'

import {
  SessionActionDialogs,
  SessionDropdownItems,
  useSessionActions,
} from './session-action-menu'

interface TerminalHeaderRightProps {
  activeSessionId: string
  onNewSession?: () => void
}

export function TerminalHeaderRight({ activeSessionId, onNewSession }: TerminalHeaderRightProps) {
  const { t } = useTranslation()
  const activeSession = useTerminalStore((s) => s.sessions.find((x) => x.id === activeSessionId))
  const actions = useSessionActions(activeSession ?? PLACEHOLDER_SESSION)
  const [menuOpen, setMenuOpen] = React.useState(false)

  return (
    <>
      {activeSession && (
        <>
          {/* Quick info: current path */}
          <div
            className="flex max-w-[40vw] items-center gap-1.5 truncate px-1 text-xs text-muted-foreground"
            title={activeSession.cwd}
          >
            <span className="truncate font-medium text-foreground">{activeSession.cwd}</span>
          </div>

          <div className="h-4 w-px bg-border" />
        </>
      )}

      {onNewSession && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          onClick={onNewSession}
          aria-label={t('terminal.newSession')}
        >
          <PlusIcon className="size-3.5" />
        </Button>
      )}

      {activeSession && (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                aria-label={t('terminal.sessionActions')}
              />
            }
          >
            <MoreHorizontalIcon className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <SessionDropdownItems
              session={activeSession}
              actions={actions}
              closeMenu={() => setMenuOpen(false)}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {activeSession && <SessionActionDialogs session={activeSession} actions={actions} />}
    </>
  )
}

const PLACEHOLDER_SESSION: TerminalSession = {
  id: '',
  title: null,
  cwd: '',
  created_at: 0,
  last_active_at: 0,
}
