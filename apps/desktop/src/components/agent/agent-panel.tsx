import {
  BrainIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SendHorizonalIcon,
  SquareIcon,
  WrenchIcon,
} from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import Markdown from 'react-markdown'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  useAgentChat,
  type ToolExecutionState,
  type UiAssistantMessage,
  type UiMessage,
  type UiToolResultMessage,
  type UiUserMessage,
} from '@/lib/agent/use-agent-chat'
import { createAgentServerClient } from '@/lib/ai/server-client'
import { cn } from '@/lib/utils'

interface AgentPanelProps {
  sessionId: string
  serverPort: number | null
  initialMessages?: UiMessage[]
  onFileActivity?: () => void
}

export function AgentPanel({
  sessionId,
  serverPort,
  initialMessages,
  onFileActivity,
}: AgentPanelProps) {
  const { t } = useTranslation()
  const { messages, toolExecutions, running, error, send, steer, abort, hydrate } = useAgentChat({
    sessionId,
    serverPort,
    onFileActivity,
  })
  const [input, setInput] = React.useState('')
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const hydratedRef = React.useRef(false)

  React.useEffect(() => {
    if (!hydratedRef.current && initialMessages) {
      hydratedRef.current = true
      hydrate(initialMessages)
    }
  }, [initialMessages, hydrate])

  // Auto-scroll on new content.
  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, toolExecutions])

  const submit = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    if (running) {
      await steer(text)
    } else {
      await send(text)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {messages.length === 0 && !running ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-xs text-muted-foreground">{t('agent.empty')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message, index) => (
              <MessageView
                key={index}
                message={message}
                toolExecutions={toolExecutions}
                streaming={running && index === messages.length - 1}
              />
            ))}
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-2">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={running ? t('agent.steerPlaceholder') : t('agent.placeholder')}
            className="max-h-40 min-h-9 flex-1 resize-none text-xs"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void submit()
              }
            }}
          />
          {running ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void abort()}
              aria-label={t('agent.stop')}
            >
              <SquareIcon className="size-3.5" />
            </Button>
          ) : null}
          <Button
            variant="default"
            size="icon-sm"
            onClick={() => void submit()}
            disabled={!input.trim() || !serverPort}
            aria-label={t('agent.send')}
          >
            <SendHorizonalIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------- Message rendering ----------

function MessageView({
  message,
  toolExecutions,
  streaming,
}: {
  message: UiMessage
  toolExecutions: Map<string, ToolExecutionState>
  streaming: boolean
}) {
  if (message.role === 'user') {
    return <UserMessageView message={message} />
  }
  if (message.role === 'assistant') {
    return (
      <AssistantMessageView
        message={message}
        toolExecutions={toolExecutions}
        streaming={streaming}
      />
    )
  }
  return null
}

function UserMessageView({ message }: { message: UiUserMessage }) {
  const text =
    typeof message.content === 'string'
      ? message.content
      : message.content.map((c) => c.text ?? '').join('')
  return (
    <div className="flex justify-end">
      <div className="max-w-[90%] rounded-lg bg-primary px-3 py-2 text-xs whitespace-pre-wrap text-primary-foreground">
        {text}
      </div>
    </div>
  )
}

function AssistantMessageView({
  message,
  toolExecutions,
  streaming,
}: {
  message: UiAssistantMessage
  toolExecutions: Map<string, ToolExecutionState>
  streaming: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {message.content.map((block, i) => {
        if (block.type === 'text') {
          return (
            <div key={i} className="prose-agent text-xs leading-relaxed">
              <Markdown>{block.text}</Markdown>
            </div>
          )
        }
        if (block.type === 'thinking') {
          return <ThinkingBlock key={i} text={block.thinking} />
        }
        if (block.type === 'toolCall') {
          return (
            <ToolCallView
              key={block.id}
              name={block.name}
              args={block.arguments}
              execution={toolExecutions.get(block.id)}
            />
          )
        }
        return null
      })}
      {streaming && message.content.length === 0 && (
        <span className="text-xs text-muted-foreground">…</span>
      )}
      {!streaming && message.usage && (
        <div className="text-[10px] text-muted-foreground">
          {message.usage.input}↑ {message.usage.output}↓
          {message.usage.cost ? ` · $${message.usage.cost.total.toFixed(4)}` : ''}
        </div>
      )}
    </div>
  )
}

function ThinkingBlock({ text }: { text: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  if (!text.trim()) return null
  return (
    <div className="rounded-md border border-border bg-muted/40">
      <button
        type="button"
        className="flex w-full items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <BrainIcon className="size-3" />
        <span>{t('agent.thinking')}</span>
        {open ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
      </button>
      {open && (
        <div className="border-t border-border px-2 py-1.5 text-[11px] whitespace-pre-wrap text-muted-foreground">
          {text}
        </div>
      )}
    </div>
  )
}

function ToolCallView({
  name,
  args,
  execution,
}: {
  name: string
  args: Record<string, unknown>
  execution?: ToolExecutionState
}) {
  const [open, setOpen] = React.useState(false)
  const status = execution?.status
  const path = typeof args?.path === 'string' ? args.path : undefined

  return (
    <div
      className={cn(
        'rounded-md border border-border',
        status === 'running' && 'border-primary/40',
        status === 'error' && 'border-destructive/40',
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-2 py-1 text-[11px]"
        onClick={() => setOpen((v) => !v)}
      >
        <WrenchIcon
          className={cn(
            'size-3 shrink-0',
            status === 'running' && 'animate-pulse text-primary',
            status === 'error' && 'text-destructive',
            (!status || status === 'done') && 'text-muted-foreground',
          )}
        />
        <span className="font-medium">{name}</span>
        {path && <span className="truncate text-muted-foreground">{path}</span>}
        <span className="ml-auto shrink-0">
          {open ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
        </span>
      </button>
      {open && (
        <div className="border-t border-border px-2 py-1.5">
          <pre className="max-h-40 overflow-auto text-[10px] whitespace-pre-wrap text-muted-foreground">
            {JSON.stringify(args, null, 2)}
          </pre>
          {execution?.summary && (
            <p className="mt-1 text-[10px] text-muted-foreground">{execution.summary}</p>
          )}
        </div>
      )}
    </div>
  )
}

export type { UiMessage, UiToolResultMessage }
export { createAgentServerClient }
