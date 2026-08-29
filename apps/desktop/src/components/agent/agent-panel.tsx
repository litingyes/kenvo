import {
  ArrowDownIcon,
  BrainIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SendHorizonalIcon,
  SquareArrowOutUpRightIcon,
  SquareIcon,
  WrenchIcon,
} from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { MarkdownStream } from '@/components/agent/markdown-stream'
import { skillIcon, skillName } from '@/components/agent/skill-meta'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  useAgentChat,
  type ToolExecutionState,
  type UiAssistantMessage,
  type UiMessage,
  type UiToolResultMessage,
  type UiUserMessage,
} from '@/lib/agent/use-agent-chat'
import {
  createAgentServerClient,
  type ProviderMetadata,
  type SkillMetadata,
} from '@/lib/ai/server-client'
import type { AiSettings, ModelRef } from '@/lib/ai/settings-bridge'
import { useProjectStore } from '@/lib/store/project-store'
import { cn } from '@/lib/utils'

/** Distance from the bottom (px) within which the stream keeps auto-scrolling. */
const PIN_THRESHOLD = 80

interface AgentPanelProps {
  sessionId: string
  skillId: string
  /** The session's stored model; null for legacy sessions (falls back visually). */
  modelRef: ModelRef | null
  skills: SkillMetadata[]
  providers: ProviderMetadata[]
  settings: AiSettings | null
  onConfigChange: (update: { skillId?: string; providerId?: string; modelId?: string }) => void
  serverPort: number | null
  initialMessages?: UiMessage[]
  onFileActivity?: () => void
  onSessionActivity?: () => void
  onRunningChange?: (running: boolean) => void
}

/**
 * The main chat view: agent conversation in a centered reading column.
 * File viewing/editing lives in the auxiliary editor drawer.
 */
export function AgentPanel({
  sessionId,
  skillId,
  modelRef,
  skills,
  providers,
  settings,
  onConfigChange,
  serverPort,
  initialMessages,
  onFileActivity,
  onSessionActivity,
  onRunningChange,
}: AgentPanelProps) {
  const { t } = useTranslation()
  const { messages, toolExecutions, running, error, send, steer, abort, hydrate } = useAgentChat({
    sessionId,
    serverPort,
    onFileActivity,
    onSessionActivity,
    onRunningChange,
  })
  const [input, setInput] = React.useState('')
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const pinnedRef = React.useRef(true)
  const [showBackToBottom, setShowBackToBottom] = React.useState(false)
  const hydratedRef = React.useRef(false)

  React.useEffect(() => {
    if (!hydratedRef.current && initialMessages) {
      hydratedRef.current = true
      hydrate(initialMessages)
    }
  }, [initialMessages, hydrate])

  // Auto-scroll on new content only while pinned to the bottom.
  React.useEffect(() => {
    const el = scrollRef.current
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight
  }, [messages, toolExecutions])

  const handleScroll = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const pinned = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD
    pinnedRef.current = pinned
    setShowBackToBottom(!pinned)
  }, [])

  const scrollToBottom = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    pinnedRef.current = true
    setShowBackToBottom(false)
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [])

  const submit = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setInput('')
    if (running) {
      await steer(trimmed)
    } else {
      await send(trimmed)
    }
  }

  const empty = messages.length === 0 && !running

  return (
    <div className="relative flex h-full flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ScrollArea
          viewportRef={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1"
          contentClassName="flex min-h-full flex-col"
        >
          {empty ? (
            <EmptyState skillId={skillId} onPick={(text) => void submit(text)} />
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-5">
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
        </ScrollArea>

        {showBackToBottom && (
          <button
            type="button"
            className="absolute right-6 bottom-4 z-10 flex size-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-md transition-colors hover:bg-accent hover:text-foreground"
            onClick={scrollToBottom}
            aria-label={t('agent.backToBottom')}
            title={t('agent.backToBottom')}
          >
            <ArrowDownIcon className="size-3.5" />
          </button>
        )}
      </div>

      <div className="shrink-0 border-t border-border">
        <div className="mx-auto w-full max-w-3xl px-6 py-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={running ? t('agent.steerPlaceholder') : t('agent.placeholder')}
              className="max-h-40 min-h-9 flex-1 resize-none text-sm"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void submit(input)
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
              onClick={() => void submit(input)}
              disabled={!input.trim() || !serverPort}
              aria-label={t('agent.send')}
            >
              <SendHorizonalIcon className="size-3.5" />
            </Button>
          </div>
          <ConfigPickers
            skillId={skillId}
            modelRef={modelRef}
            skills={skills}
            providers={providers}
            settings={settings}
            disabled={running}
            onConfigChange={onConfigChange}
          />
        </div>
      </div>
    </div>
  )
}

// ---------- Skill + model pickers ----------

function encodeModel(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`
}

function decodeModel(value: string): ModelRef | null {
  const index = value.indexOf('::')
  if (index <= 0) return null
  return { providerId: value.slice(0, index), modelId: value.slice(index + 2) }
}

interface ConfigPickersProps {
  skillId: string
  modelRef: ModelRef | null
  skills: SkillMetadata[]
  providers: ProviderMetadata[]
  settings: AiSettings | null
  disabled: boolean
  onConfigChange: AgentPanelProps['onConfigChange']
}

function ConfigPickers({
  skillId,
  modelRef,
  skills,
  providers,
  settings,
  disabled,
  onConfigChange,
}: ConfigPickersProps) {
  const { t } = useTranslation()

  const providerNames = React.useMemo(() => {
    const names: Record<string, string> = {}
    for (const provider of providers) names[provider.id] = provider.name
    return names
  }, [providers])

  // Enabled models whose provider has credentials, grouped by provider.
  const modelGroups = React.useMemo(() => {
    if (!settings) return []
    const configured = new Set(settings.providers.filter((p) => p.apiKey).map((p) => p.id))
    return Object.entries(settings.enabledModels)
      .filter(([providerId, models]) => configured.has(providerId) && models.length > 0)
      .map(([providerId, models]) => ({ providerId, models }))
  }, [settings])

  const modelValue = modelRef ? encodeModel(modelRef.providerId, modelRef.modelId) : undefined

  return (
    <div className="mt-2 flex items-center gap-1.5">
      <Select
        value={skillId}
        onValueChange={(next) => next && next !== skillId && onConfigChange({ skillId: next })}
        disabled={disabled}
      >
        <SelectTrigger
          size="sm"
          aria-label={t('agent.skill')}
          className="h-6 gap-1 border-none px-1.5 text-[11px] text-muted-foreground shadow-none hover:text-foreground"
        >
          <SelectValue>{skillName(skillId)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{t('agent.skill')}</SelectLabel>
            {(skills.length > 0 ? skills : [{ id: skillId, name: skillId, description: '' }]).map(
              (skill) => (
                <SelectItem key={skill.id} value={skill.id}>
                  {skillName(skill.id)}
                </SelectItem>
              ),
            )}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        value={modelValue}
        onValueChange={(next) => {
          const decoded = next ? decodeModel(next) : null
          if (decoded) onConfigChange(decoded)
        }}
        disabled={disabled || modelGroups.length === 0}
      >
        <SelectTrigger
          size="sm"
          aria-label={t('agent.model')}
          className="h-6 gap-1 border-none px-1.5 text-[11px] text-muted-foreground shadow-none hover:text-foreground"
        >
          <SelectValue placeholder={t('agent.noModelShort')}>{modelRef?.modelId}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {modelGroups.map(({ providerId, models }) => (
            <SelectGroup key={providerId}>
              <SelectLabel>{providerNames[providerId] ?? providerId}</SelectLabel>
              {models.map((modelId) => (
                <SelectItem key={modelId} value={encodeModel(providerId, modelId)}>
                  {modelId}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ---------- Empty state ----------

function EmptyState({ skillId, onPick }: { skillId: string; onPick: (text: string) => void }) {
  const { t } = useTranslation()
  const Icon = skillIcon(skillId)
  const starters = t(`agent.starters.${skillId}`, {
    returnObjects: true,
    defaultValue: [],
  }) as string[]

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{skillName(skillId)}</p>
        <p className="text-xs text-muted-foreground">{t('agent.empty')}</p>
      </div>
      {starters.length > 0 && (
        <div className="flex max-w-md flex-wrap items-center justify-center gap-2">
          {starters.map((starter) => (
            <button
              key={starter}
              type="button"
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              onClick={() => onPick(starter)}
            >
              {starter}
            </button>
          ))}
        </div>
      )}
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
      <div className="max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
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
    <div className="flex flex-col gap-2">
      {message.content.map((block, i) => {
        if (block.type === 'text') {
          return (
            <div key={i} className="prose-agent">
              <MarkdownStream content={block.text} final={!streaming} />
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
        <span className="text-sm text-muted-foreground">…</span>
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
        className="flex w-full items-center gap-1 px-2 py-1 text-xs text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <BrainIcon className="size-3" />
        <span>{t('agent.thinking')}</span>
        {open ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
      </button>
      {open && (
        <div className="border-t border-border px-2 py-1.5 text-xs whitespace-pre-wrap text-muted-foreground">
          {text}
        </div>
      )}
    </div>
  )
}

/** Tools whose `path` argument points at a real file that can be opened. */
const OPENABLE_TOOLS = new Set(['write_file', 'edit_file', 'read_file'])

function ToolCallView({
  name,
  args,
  execution,
}: {
  name: string
  args: Record<string, unknown>
  execution?: ToolExecutionState
}) {
  const { t } = useTranslation()
  const openFile = useProjectStore((s) => s.openFile)
  const [open, setOpen] = React.useState(false)
  const status = execution?.status
  const path = typeof args?.path === 'string' ? args.path : undefined
  const openable = path && OPENABLE_TOOLS.has(name)

  return (
    <div
      className={cn(
        'rounded-md border border-border',
        status === 'running' && 'border-primary/40',
        status === 'error' && 'border-destructive/40',
      )}
    >
      <div className="flex w-full items-center">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left text-xs"
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
          <span className="ml-auto shrink-0 pl-1">
            {open ? (
              <ChevronDownIcon className="size-3" />
            ) : (
              <ChevronRightIcon className="size-3" />
            )}
          </span>
        </button>
        {openable && (
          <button
            type="button"
            className="mr-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => void openFile(path)}
            aria-label={t('agent.openFile')}
            title={t('agent.openFile')}
          >
            <SquareArrowOutUpRightIcon className="size-3" />
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-border px-2 py-1.5">
          <ScrollArea viewportClassName="h-auto max-h-40">
            <pre className="text-[10px] whitespace-pre-wrap text-muted-foreground">
              {JSON.stringify(args, null, 2)}
            </pre>
          </ScrollArea>
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
