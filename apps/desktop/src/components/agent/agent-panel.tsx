import {
  BrainIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClapperboardIcon,
  FileCode2Icon,
  FileImageIcon,
  FileTextIcon,
  ImageIcon,
  PaperclipIcon,
  SendHorizonalIcon,
  SquareArrowOutUpRightIcon,
  SquareIcon,
  WrenchIcon,
  XIcon,
} from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { MarkdownStream } from '@/components/agent/markdown-stream'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Message, MessageContent } from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  useAgentChat,
  type ChatAttachmentMeta,
  type ToolExecutionState,
  type UiAssistantMessage,
  type UiMessage,
  type UiToolResultMessage,
  type UiUserMessage,
} from '@/lib/agent/use-agent-chat'
import {
  createAgentServerClient,
  type ChatAttachmentPayload,
  type ProviderMetadata,
} from '@/lib/ai/server-client'
import type { AiSettings, ModelRef } from '@/lib/ai/settings-bridge'
import { api } from '@/lib/electron/api'
import { cn } from '@/lib/utils'

const MAX_ATTACHMENTS = 5
const MAX_TEXT_ATTACHMENT_BYTES = 200 * 1024
const MAX_IMAGE_ATTACHMENT_BYTES = 5 * 1024 * 1024
const TEXT_EXTENSIONS = new Set([
  'bash',
  'c',
  'cjs',
  'cpp',
  'cs',
  'css',
  'csv',
  'dart',
  'go',
  'h',
  'hpp',
  'htm',
  'html',
  'ini',
  'java',
  'js',
  'json',
  'jsx',
  'kotlin',
  'kt',
  'kts',
  'less',
  'lua',
  'markdown',
  'md',
  'mdx',
  'mjs',
  'php',
  'py',
  'rb',
  'rs',
  'sass',
  'scss',
  'sh',
  'sql',
  'svelte',
  'swift',
  'toml',
  'ts',
  'tsx',
  'tsv',
  'txt',
  'vue',
  'xml',
  'yaml',
  'yml',
  'zsh',
])
const IMAGE_EXTENSIONS = new Set(['gif', 'jpeg', 'jpg', 'png', 'webp'])
const IMAGE_MIME_TYPES: Record<string, string> = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

type AttachmentErrorKey = 'format' | 'tooLarge' | 'read' | 'vision' | 'limit'

class AttachmentError extends Error {
  constructor(readonly key: AttachmentErrorKey) {
    super(key)
  }
}

interface PendingAttachment extends ChatAttachmentPayload {
  id: string
  previewUrl?: string
}

function fileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath
}

function fileExtension(filePath: string): string {
  const name = fileName(filePath).toLowerCase()
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index + 1) : ''
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function readAttachment(
  filePath: string,
  canAttachImages: boolean,
): Promise<PendingAttachment> {
  const name = fileName(filePath)
  const extension = fileExtension(filePath)
  if (IMAGE_EXTENSIONS.has(extension)) {
    if (!canAttachImages) throw new AttachmentError('vision')
    const bytes = new Uint8Array(await api.fs.readFile(filePath))
    if (bytes.byteLength > MAX_IMAGE_ATTACHMENT_BYTES) throw new AttachmentError('tooLarge')
    const mimeType = IMAGE_MIME_TYPES[extension]
    const data = bytesToBase64(bytes)
    return {
      id: crypto.randomUUID(),
      name,
      kind: 'image',
      mimeType,
      size: bytes.byteLength,
      data,
      previewUrl: `data:${mimeType};base64,${data}`,
    }
  }

  if (!TEXT_EXTENSIONS.has(extension)) throw new AttachmentError('format')
  const text = await api.fs.readTextFile(filePath)
  const size = new TextEncoder().encode(text).byteLength
  if (size > MAX_TEXT_ATTACHMENT_BYTES) throw new AttachmentError('tooLarge')
  return {
    id: crypto.randomUUID(),
    name,
    kind: 'text',
    mimeType: extension === 'md' || extension === 'markdown' ? 'text/markdown' : 'text/plain',
    size,
    text,
  }
}

interface AgentPanelProps {
  sessionId: string
  /** The session's stored model; null for legacy sessions (falls back visually). */
  modelRef: ModelRef | null
  providers: ProviderMetadata[]
  settings: AiSettings | null
  modelSupportsImages: boolean
  onConfigChange: (update: { providerId?: string; modelId?: string }) => void
  onOpenFile: (path: string) => void
  serverPort: number | null
  initialMessages?: UiMessage[]
  onFileActivity?: () => void
  onSessionActivity?: () => void
  onRunningChange?: (running: boolean) => void
  onAgentEnd?: () => void
  quickPrompt?: { id: string; text: string } | null
}

/**
 * The main chat view: agent conversation in a centered reading column.
 * File viewing/editing lives in the screenplay workbench's central editor.
 */
export function AgentPanel({
  sessionId,
  modelRef,
  providers,
  settings,
  modelSupportsImages,
  onConfigChange,
  onOpenFile,
  serverPort,
  initialMessages,
  onFileActivity,
  onSessionActivity,
  onRunningChange,
  onAgentEnd,
  quickPrompt,
}: AgentPanelProps) {
  const { t } = useTranslation()
  const { messages, toolExecutions, running, error, send, steer, abort, hydrate } = useAgentChat({
    sessionId,
    serverPort,
    onFileActivity,
    onSessionActivity,
    onRunningChange,
    onAgentEnd,
  })
  const [input, setInput] = React.useState('')
  const [pendingAttachments, setPendingAttachments] = React.useState<PendingAttachment[]>([])
  const [attachmentError, setAttachmentError] = React.useState<AttachmentErrorKey | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const hydratedRef = React.useRef(false)
  const handledPromptRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!hydratedRef.current && initialMessages) {
      hydratedRef.current = true
      hydrate(initialMessages)
    }
  }, [initialMessages, hydrate])

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const maxHeight = 176
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 76), maxHeight)}px`
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [input])

  const addAttachments = React.useCallback(
    async (kind: 'text' | 'image') => {
      setAttachmentError(null)
      const result = await api.dialog.showOpenDialog({
        title: kind === 'image' ? t('agent.attachImage') : t('agent.attachText'),
        properties: ['openFile', 'multiSelections'],
        filters:
          kind === 'image'
            ? [{ name: t('agent.attachImage'), extensions: Array.from(IMAGE_EXTENSIONS) }]
            : [{ name: t('agent.attachText'), extensions: Array.from(TEXT_EXTENSIONS) }],
      })
      if (result.canceled) return
      if (pendingAttachments.length >= MAX_ATTACHMENTS) {
        setAttachmentError('limit')
        return
      }
      const remaining = MAX_ATTACHMENTS - pendingAttachments.length
      const loaded: PendingAttachment[] = []
      for (const path of result.filePaths.slice(0, remaining)) {
        try {
          loaded.push(await readAttachment(path, modelSupportsImages))
        } catch (error) {
          setAttachmentError(error instanceof AttachmentError ? error.key : 'read')
        }
      }
      if (loaded.length > 0) setPendingAttachments((previous) => [...previous, ...loaded])
      if (result.filePaths.length > remaining) setAttachmentError('limit')
    },
    [modelSupportsImages, pendingAttachments.length, t],
  )

  const submit = React.useCallback(
    async (
      text: string,
      attachments: PendingAttachment[] = pendingAttachments,
      clearAttachments = true,
    ) => {
      const trimmed = text.trim()
      if (!trimmed && attachments.length === 0) return
      const payload = attachments.map(
        (attachment): ChatAttachmentPayload => ({
          name: attachment.name,
          kind: attachment.kind,
          mimeType: attachment.mimeType,
          size: attachment.size,
          ...(attachment.text !== undefined ? { text: attachment.text } : {}),
          ...(attachment.data !== undefined ? { data: attachment.data } : {}),
        }),
      )
      try {
        if (running) {
          await steer(trimmed, payload)
        } else {
          await send(trimmed, payload)
        }
        setInput('')
        if (clearAttachments) setPendingAttachments([])
        setAttachmentError(null)
      } catch {
        setAttachmentError('read')
      }
    },
    [pendingAttachments, running, send, steer],
  )

  React.useEffect(() => {
    if (!quickPrompt || handledPromptRef.current === quickPrompt.id) return
    handledPromptRef.current = quickPrompt.id
    void submit(quickPrompt.text, [], false)
  }, [quickPrompt, submit])

  const empty = messages.length === 0 && !running
  const sendDisabled = (!input.trim() && pendingAttachments.length === 0) || !serverPort
  const sendButton = (
    <Button
      variant="default"
      size="icon-sm"
      onClick={() => void submit(input)}
      disabled={sendDisabled}
      aria-label={t('agent.send')}
    >
      <SendHorizonalIcon className="size-3.5" />
    </Button>
  )

  return (
    <div className="relative flex h-full flex-col">
      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport aria-label={t('agent.title')}>
            <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-5 px-4 py-5 sm:px-6">
              {empty ? (
                <div className="flex min-h-[18rem] flex-1 flex-col justify-center">
                  <EmptyState onPick={(text) => void submit(text)} />
                </div>
              ) : (
                messages.map((message, index) => (
                  <MessageScrollerItem
                    key={index}
                    messageId={`message-${index}`}
                    scrollAnchor={index === messages.length - 1}
                  >
                    <MessageView
                      message={message}
                      toolExecutions={toolExecutions}
                      onOpenFile={onOpenFile}
                      streaming={running && index === messages.length - 1}
                    />
                  </MessageScrollerItem>
                ))
              )}
              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton
            direction="end"
            aria-label={t('agent.backToBottom')}
            className="right-4 bottom-4"
          />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="shrink-0 border-t border-border">
        <div className="mx-auto w-full max-w-3xl px-6 py-3">
          {pendingAttachments.length > 0 && (
            <AttachmentGroup className="mb-2 gap-2">
              {pendingAttachments.map((attachment) => (
                <PendingAttachmentCard
                  key={attachment.id}
                  attachment={attachment}
                  onRemove={() =>
                    setPendingAttachments((previous) =>
                      previous.filter((item) => item.id !== attachment.id),
                    )
                  }
                />
              ))}
            </AttachmentGroup>
          )}
          {attachmentError && (
            <p className="mb-2 text-[11px] text-destructive">
              {attachmentErrorMessage(t, attachmentError, modelSupportsImages)}
            </p>
          )}
          <InputGroup>
            <InputGroupTextarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={running ? t('agent.steerPlaceholder') : t('agent.placeholder')}
              className="max-h-44 min-h-[76px] px-3 py-3 text-sm leading-5"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void submit(input)
                }
              }}
            />
            <InputGroupAddon
              align="block-end"
              className="justify-between border-t border-border/60"
            >
              <div className="flex min-w-0 items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <InputGroupButton
                        size="icon-sm"
                        aria-label={t('agent.attach')}
                        disabled={!serverPort}
                      />
                    }
                  >
                    <PaperclipIcon className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="start" className="w-52">
                    <DropdownMenuItem onClick={() => void addAttachments('text')}>
                      <FileCode2Icon />
                      {t('agent.attachText')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!modelSupportsImages}
                      onClick={() => void addAttachments('image')}
                      title={!modelSupportsImages ? t('agent.attachmentVisionRequired') : undefined}
                    >
                      <ImageIcon />
                      <span className="min-w-0 truncate">{t('agent.attachImage')}</span>
                      {!modelSupportsImages && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {t('agent.unavailable')}
                        </span>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ConfigPickers
                  modelRef={modelRef}
                  providers={providers}
                  settings={settings}
                  disabled={running}
                  onConfigChange={onConfigChange}
                />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {running ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <InputGroupButton
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void abort()}
                          aria-label={t('agent.stop')}
                        />
                      }
                    >
                      <SquareIcon className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent>{t('agent.stop')}</TooltipContent>
                  </Tooltip>
                ) : null}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      sendDisabled ? <span className="inline-flex">{sendButton}</span> : sendButton
                    }
                  />
                  <TooltipContent>{t('agent.send')}</TooltipContent>
                </Tooltip>
              </div>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>
    </div>
  )
}

function attachmentErrorMessage(
  translate: ReturnType<typeof useTranslation>['t'],
  key: AttachmentErrorKey,
  modelSupportsImages: boolean,
): string {
  if (key === 'format') return translate('agent.attachmentUnsupported')
  if (key === 'tooLarge') return translate('agent.attachmentTooLarge')
  if (key === 'vision') {
    return modelSupportsImages
      ? translate('agent.attachmentReadFailed')
      : translate('agent.attachmentVisionRequired')
  }
  if (key === 'limit') return translate('agent.attachmentLimit')
  return translate('agent.attachmentReadFailed')
}

function AttachmentCard({
  meta,
  data,
  onRemove,
}: {
  meta: ChatAttachmentMeta
  data?: string
  onRemove?: () => void
}) {
  const { t } = useTranslation()
  const isImage = meta.kind === 'image'
  return (
    <Attachment size="xs" className="max-w-[13rem]">
      <AttachmentMedia variant={isImage && data ? 'image' : 'icon'}>
        {isImage && data ? (
          <img src={`data:${meta.mimeType};base64,${data}`} alt="" />
        ) : isImage ? (
          <FileImageIcon />
        ) : (
          <FileTextIcon />
        )}
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{meta.name}</AttachmentTitle>
        <AttachmentDescription>
          {isImage ? t('agent.attachmentImage') : t('agent.attachmentText')} ·{' '}
          {formatFileSize(meta.size)}
        </AttachmentDescription>
      </AttachmentContent>
      {onRemove && (
        <AttachmentActions>
          <AttachmentAction aria-label={t('agent.removeAttachment')} onClick={onRemove}>
            <XIcon />
          </AttachmentAction>
        </AttachmentActions>
      )}
    </Attachment>
  )
}

function PendingAttachmentCard({
  attachment,
  onRemove,
}: {
  attachment: PendingAttachment
  onRemove: () => void
}) {
  return (
    <AttachmentCard
      meta={attachment}
      data={attachment.kind === 'image' ? attachment.data : undefined}
      onRemove={onRemove}
    />
  )
}

// ---------- Model picker ----------

function encodeModel(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`
}

function decodeModel(value: string): ModelRef | null {
  const index = value.indexOf('::')
  if (index <= 0) return null
  return { providerId: value.slice(0, index), modelId: value.slice(index + 2) }
}

interface ConfigPickersProps {
  modelRef: ModelRef | null
  providers: ProviderMetadata[]
  settings: AiSettings | null
  disabled: boolean
  onConfigChange: AgentPanelProps['onConfigChange']
}

function ConfigPickers({
  modelRef,
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
    <div className="flex min-w-0 items-center">
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
          className="h-7 max-w-[10rem] gap-1 border-none px-1.5 text-[11px] text-muted-foreground shadow-none hover:text-foreground"
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

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const { t } = useTranslation()
  const starters = t('agent.starters.screenwriter', {
    returnObjects: true,
    defaultValue: [],
  }) as string[]

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <ClapperboardIcon className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">写作教练</p>
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
  onOpenFile,
}: {
  message: UiMessage
  toolExecutions: Map<string, ToolExecutionState>
  streaming: boolean
  onOpenFile: (path: string) => void
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
        onOpenFile={onOpenFile}
      />
    )
  }
  return null
}

function UserMessageView({ message }: { message: UiUserMessage }) {
  const blocks = typeof message.content === 'string' ? [] : message.content
  const text =
    typeof message.content === 'string'
      ? message.content
      : blocks
          .filter((block) => !('attachment' in block && block.attachment))
          .map((block) => ('text' in block ? (block.text ?? '') : ''))
          .join('')
  const attachments = blocks.flatMap((block) => {
    if (!('attachment' in block) || !block.attachment) return []
    return [
      {
        meta: block.attachment,
        data: block.type === 'image' && 'data' in block ? block.data : undefined,
      },
    ]
  })
  return (
    <Message align="end">
      <MessageContent className="items-end">
        {text && (
          <Bubble align="end">
            <BubbleContent className="whitespace-pre-wrap">{text}</BubbleContent>
          </Bubble>
        )}
        {attachments.length > 0 && (
          <AttachmentGroup className="max-w-full justify-end gap-2">
            {attachments.map(({ meta, data }) => (
              <AttachmentCard key={`${meta.name}-${meta.size}`} meta={meta} data={data} />
            ))}
          </AttachmentGroup>
        )}
      </MessageContent>
    </Message>
  )
}

function AssistantMessageView({
  message,
  toolExecutions,
  streaming,
  onOpenFile,
}: {
  message: UiAssistantMessage
  toolExecutions: Map<string, ToolExecutionState>
  streaming: boolean
  onOpenFile: (path: string) => void
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
              onOpenFile={onOpenFile}
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
const OPENABLE_TOOLS = new Set(['write_file', 'edit_file', 'read_file', 'propose_file_change'])

function ToolCallView({
  name,
  args,
  execution,
  onOpenFile,
}: {
  name: string
  args: Record<string, unknown>
  execution?: ToolExecutionState
  onOpenFile: (path: string) => void
}) {
  const { t } = useTranslation()
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
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="mr-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => onOpenFile(path)}
                  aria-label={t('agent.openFile')}
                >
                  <SquareArrowOutUpRightIcon className="size-3" />
                </button>
              }
            />
            <TooltipContent>{t('agent.openFile')}</TooltipContent>
          </Tooltip>
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
