import type { AgentMessage } from '@earendil-works/pi-agent-core'
import { z } from 'zod'

export const MAX_CHAT_ATTACHMENTS = 5
export const MAX_TEXT_ATTACHMENT_BYTES = 200 * 1024
export const MAX_IMAGE_ATTACHMENT_BYTES = 5 * 1024 * 1024

const TEXT_MIME_TYPES = new Set([
  'application/javascript',
  'application/json',
  'application/typescript',
  'application/xml',
  'text/css',
  'text/csv',
  'text/html',
  'text/javascript',
  'text/markdown',
  'text/plain',
  'text/typescript',
  'text/xml',
])

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

const IMAGE_MIME_TYPES = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp'])

export interface ChatAttachmentInput {
  name: string
  kind: 'text' | 'image'
  mimeType: string
  size: number
  text?: string
  data?: string
}

export interface ChatAttachmentMeta {
  name: string
  kind: 'text' | 'image'
  mimeType: string
  size: number
}

export const chatAttachmentSchema = z
  .object({
    name: z.string().trim().min(1).max(240),
    kind: z.enum(['text', 'image']),
    mimeType: z.string().trim().min(1).max(120),
    size: z.number().int().nonnegative(),
    text: z.string().optional(),
    data: z.string().optional(),
  })
  .superRefine((attachment, ctx) => {
    const extension = attachment.name.toLowerCase().split('.').pop() ?? ''
    const supportedText =
      TEXT_MIME_TYPES.has(attachment.mimeType.toLowerCase()) || TEXT_EXTENSIONS.has(extension)

    if (attachment.kind === 'text') {
      if (!supportedText) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Unsupported text attachment format' })
      }
      if (typeof attachment.text !== 'string') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Text attachment content is missing' })
      } else if (new TextEncoder().encode(attachment.text).byteLength > MAX_TEXT_ATTACHMENT_BYTES) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Text attachment exceeds 200 KB' })
      }
      if (attachment.size > MAX_TEXT_ATTACHMENT_BYTES) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Text attachment exceeds 200 KB' })
      }
      return
    }

    if (!IMAGE_MIME_TYPES.has(attachment.mimeType.toLowerCase())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Unsupported image attachment format' })
    }
    if (!attachment.data || !/^[A-Za-z0-9+/]*={0,2}$/.test(attachment.data)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Image attachment data is invalid' })
      return
    }
    const padding = attachment.data.endsWith('==') ? 2 : attachment.data.endsWith('=') ? 1 : 0
    const decodedBytes = Math.max(0, Math.floor((attachment.data.length * 3) / 4) - padding)
    if (attachment.size > MAX_IMAGE_ATTACHMENT_BYTES || decodedBytes > MAX_IMAGE_ATTACHMENT_BYTES) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Image attachment exceeds 5 MB' })
    }
  })

export const chatMessageSchema = z
  .object({
    input: z.string().max(100_000).default(''),
    attachments: z.array(chatAttachmentSchema).max(MAX_CHAT_ATTACHMENTS).default([]),
  })
  .superRefine((message, ctx) => {
    if (!message.input.trim() && message.attachments.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['input'], message: 'Message is empty' })
    }
  })

export type AgentUserMessage = AgentMessage & {
  role: 'user'
  content: Array<
    | { type: 'text'; text: string; attachment?: ChatAttachmentMeta }
    | { type: 'image'; data: string; mimeType: string; attachment?: ChatAttachmentMeta }
  >
}

export function buildAgentUserMessage(
  input: string,
  attachments: ChatAttachmentInput[],
): AgentUserMessage {
  const content: AgentUserMessage['content'] = []
  if (input.trim()) content.push({ type: 'text', text: input })

  for (const attachment of attachments) {
    const meta: ChatAttachmentMeta = {
      name: attachment.name,
      kind: attachment.kind,
      mimeType: attachment.mimeType,
      size: attachment.size,
    }
    if (attachment.kind === 'text') {
      content.push({
        type: 'text',
        text: `\n\n[附件：${attachment.name}]\n${attachment.text ?? ''}\n[/附件：${attachment.name}]`,
        attachment: meta,
      })
    } else {
      content.push({
        type: 'image',
        data: attachment.data ?? '',
        mimeType: attachment.mimeType,
        attachment: meta,
      })
    }
  }

  return {
    role: 'user',
    content,
    timestamp: Date.now(),
  } as AgentUserMessage
}
