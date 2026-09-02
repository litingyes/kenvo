import * as React from 'react'

import {
  createAgentServerClient,
  type AgentStreamEvent,
  type ChatAttachmentPayload,
} from '@/lib/ai/server-client'
import {
  appendChatMessage,
  countChatMessages,
  touchChatSession,
  updateChatSessionTitle,
} from '@/lib/db/chat-repo'

// ---------- Pi message shapes (subset, structurally typed) ----------

export interface TextContent {
  type: 'text'
  text: string
  attachment?: ChatAttachmentMeta
}

export interface ImageContent {
  type: 'image'
  data: string
  mimeType: string
  attachment?: ChatAttachmentMeta
}

export interface ChatAttachmentMeta {
  name: string
  kind: 'text' | 'image'
  mimeType: string
  size: number
}

export interface ThinkingContent {
  type: 'thinking'
  thinking: string
}

export interface ToolCallContent {
  type: 'toolCall'
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type AssistantContentBlock = TextContent | ThinkingContent | ToolCallContent

export interface UiUserMessage {
  role: 'user'
  content: string | Array<TextContent | ImageContent | { type: string; text?: string }>
  timestamp: number
}

export interface UiAssistantMessage {
  role: 'assistant'
  content: AssistantContentBlock[]
  stopReason?: string
  errorMessage?: string
  usage?: { input: number; output: number; cost?: { total: number } }
  timestamp: number
}

export interface UiToolResultMessage {
  role: 'toolResult'
  toolCallId: string
  toolName: string
  content: Array<{ type: string; text?: string }>
  isError: boolean
  timestamp: number
}

export type UiMessage = UiUserMessage | UiAssistantMessage | UiToolResultMessage

export interface ToolExecutionState {
  toolCallId: string
  toolName: string
  args?: Record<string, unknown>
  status: 'running' | 'done' | 'error'
  summary?: string
}

interface UseAgentChatOptions {
  sessionId: string
  serverPort: number | null
  onFileActivity?: () => void
  /** Fired when the session list should refresh (title set, activity timestamp bumped). */
  onSessionActivity?: () => void
  /** Fired after a run settles so feature panels can refresh derived state. */
  onAgentEnd?: () => void
  /** Fired whenever the run state changes (for session-switch guards). */
  onRunningChange?: (running: boolean) => void
}

export interface UseAgentChatResult {
  messages: UiMessage[]
  toolExecutions: Map<string, ToolExecutionState>
  running: boolean
  error: string | null
  send: (input: string, attachments?: ChatAttachmentPayload[]) => Promise<void>
  steer: (input: string, attachments?: ChatAttachmentPayload[]) => Promise<void>
  abort: () => Promise<void>
  hydrate: (messages: UiMessage[]) => void
}

function messageRole(message: Record<string, unknown>): string {
  return typeof message.role === 'string' ? message.role : 'unknown'
}

function userMessageText(message: UiUserMessage): string {
  if (typeof message.content === 'string') return message.content
  return message.content
    .filter((c) => !('attachment' in c && c.attachment))
    .map((c) => ('text' in c ? (c.text ?? '') : ''))
    .join('')
}

/** Derive a short session title from the first user message. */
function sessionTitleFrom(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 40)
}

export function useAgentChat(options: UseAgentChatOptions): UseAgentChatResult {
  const { sessionId, serverPort, onFileActivity, onSessionActivity, onRunningChange, onAgentEnd } =
    options
  const [messages, setMessages] = React.useState<UiMessage[]>([])
  const [toolExecutions, setToolExecutions] = React.useState<Map<string, ToolExecutionState>>(
    new Map(),
  )
  const [running, setRunning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const fileActivityRef = React.useRef(onFileActivity)
  fileActivityRef.current = onFileActivity
  const sessionActivityRef = React.useRef(onSessionActivity)
  sessionActivityRef.current = onSessionActivity
  const agentEndRef = React.useRef(onAgentEnd)
  agentEndRef.current = onAgentEnd
  const hasUserMessageRef = React.useRef(false)

  React.useEffect(() => {
    onRunningChange?.(running)
  }, [running, onRunningChange])

  const persistMessage = React.useCallback(
    (message: UiMessage) => {
      void appendChatMessage(sessionId, message.role, JSON.stringify(message)).catch(() => {})
    },
    [sessionId],
  )

  const handleEvent = React.useCallback(
    (event: AgentStreamEvent) => {
      switch (event.type) {
        case 'agent_start':
          setRunning(true)
          setError(null)
          setToolExecutions(new Map())
          break

        case 'message_start':
        case 'message_update':
        case 'message_end': {
          const message = event.message as UiMessage | undefined
          if (!message) break
          const role = messageRole(message as unknown as Record<string, unknown>)
          if (role === 'assistant') {
            // The event carries the full (partial) assistant message — replace in place.
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last && last.role === 'assistant') {
                next[next.length - 1] = message
              } else {
                next.push(message)
              }
              return next
            })
            if (event.type === 'message_end') persistMessage(message)
          } else if (role === 'user' || role === 'toolResult') {
            if (event.type === 'message_start') {
              setMessages((prev) => [...prev, message])
            }
            if (event.type === 'message_end') {
              persistMessage(message)
              // Auto-title the session from its first user message.
              if (role === 'user' && !hasUserMessageRef.current) {
                hasUserMessageRef.current = true
                const title = sessionTitleFrom(userMessageText(message as UiUserMessage))
                if (title) {
                  void updateChatSessionTitle(sessionId, title)
                    .then(() => sessionActivityRef.current?.())
                    .catch(() => {})
                }
              }
            }
          }
          break
        }

        case 'tool_execution_start': {
          const toolCallId = event.toolCallId as string
          setToolExecutions((prev) => {
            const next = new Map(prev)
            next.set(toolCallId, {
              toolCallId,
              toolName: event.toolName as string,
              args: event.args as Record<string, unknown>,
              status: 'running',
            })
            return next
          })
          if (
            event.toolName === 'write_file' ||
            event.toolName === 'edit_file' ||
            event.toolName === 'delete_file'
          ) {
            fileActivityRef.current?.()
          }
          break
        }

        case 'tool_execution_update': {
          const toolCallId = event.toolCallId as string
          setToolExecutions((prev) => {
            const existing = prev.get(toolCallId)
            if (!existing) return prev
            const next = new Map(prev)
            const partial = event.partialResult as
              | { content?: Array<{ text?: string }> }
              | undefined
            next.set(toolCallId, {
              ...existing,
              summary: partial?.content?.[0]?.text ?? existing.summary,
            })
            return next
          })
          break
        }

        case 'tool_execution_end': {
          const toolCallId = event.toolCallId as string
          setToolExecutions((prev) => {
            const existing = prev.get(toolCallId)
            if (!existing) return prev
            const next = new Map(prev)
            next.set(toolCallId, {
              ...existing,
              status: event.isError ? 'error' : 'done',
            })
            return next
          })
          fileActivityRef.current?.()
          break
        }

        case 'agent_end':
          setRunning(false)
          abortRef.current = null
          void touchChatSession(sessionId)
            .then(() => sessionActivityRef.current?.())
            .catch(() => {})
          fileActivityRef.current?.()
          agentEndRef.current?.()
          break
      }
    },
    [persistMessage, sessionId],
  )

  const send = React.useCallback(
    async (input: string, attachments: ChatAttachmentPayload[] = []) => {
      if (!serverPort) {
        setError('Agent server is not running')
        return
      }
      const client = createAgentServerClient(serverPort)
      const controller = new AbortController()
      abortRef.current = controller
      setRunning(true)
      setError(null)
      try {
        await client.sendMessage(sessionId, input, attachments, handleEvent, controller.signal)
      } catch (e) {
        if (controller.signal.aborted) {
          setRunning(false)
          return
        }
        setError(e instanceof Error ? e.message : String(e))
        setRunning(false)
      }
    },
    [serverPort, sessionId, handleEvent],
  )

  const steer = React.useCallback(
    async (input: string, attachments: ChatAttachmentPayload[] = []) => {
      if (!serverPort) return
      const client = createAgentServerClient(serverPort)
      await client.steerSession(sessionId, input, attachments)
    },
    [serverPort, sessionId],
  )

  const abort = React.useCallback(async () => {
    if (!serverPort) return
    const client = createAgentServerClient(serverPort)
    await client.abortSession(sessionId).catch(() => {})
    abortRef.current?.abort()
    setRunning(false)
  }, [serverPort, sessionId])

  const hydrate = React.useCallback((historical: UiMessage[]) => {
    hasUserMessageRef.current = historical.some((m) => m.role === 'user')
    setMessages(historical)
  }, [])

  return { messages, toolExecutions, running, error, send, steer, abort, hydrate }
}

export { countChatMessages }
