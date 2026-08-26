import { formatDistanceToNow } from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'
import { MessageSquareIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { ChatSession } from '@/lib/db/chat-repo'
import { cn } from '@/lib/utils'

interface SessionListProps {
  sessions: ChatSession[]
  activeSessionId: string | null
  onSelect: (sessionId: string) => void
  onNew: () => void
  onDelete: (sessionId: string) => void
}

/** Codex-style session history sidebar: one row per chat session. */
export function SessionList({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
}: SessionListProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith('zh') ? zhCN : enUS

  const relativeTime = (timestamp: number) =>
    formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale })

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between px-3">
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {t('agent.sessions')}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onNew}
          aria-label={t('agent.newSession')}
          title={t('agent.newSession')}
        >
          <PlusIcon className="size-3.5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
        {sessions.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            {t('agent.untitled')}
          </p>
        ) : (
          sessions.map((session) => {
            const active = session.id === activeSessionId
            return (
              <div
                key={session.id}
                className={cn(
                  'group relative flex w-full items-center rounded text-left',
                  active ? 'bg-accent' : 'hover:bg-accent/60',
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col gap-0.5 px-2 py-1.5"
                  onClick={() => onSelect(session.id)}
                >
                  <span className="flex items-center gap-1.5">
                    <MessageSquareIcon className="size-3 shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs font-medium">
                      {session.title || t('agent.untitled')}
                    </span>
                  </span>
                  <span className="truncate pl-[18px] text-[10px] text-muted-foreground">
                    {relativeTime(session.last_active_at)}
                  </span>
                </button>
                <button
                  type="button"
                  className="absolute top-1/2 right-1 hidden -translate-y-1/2 rounded p-1 text-muted-foreground group-hover:block hover:bg-background hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(session.id)
                  }}
                  aria-label={t('agent.deleteSession')}
                  title={t('agent.deleteSession')}
                >
                  <Trash2Icon className="size-3" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
