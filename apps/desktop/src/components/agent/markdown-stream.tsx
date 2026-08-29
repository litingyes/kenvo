import MarkdownRender from 'markstream-react'
import { useTheme } from 'next-themes'

import 'markstream-react/index.css'

interface MarkdownStreamProps {
  content: string
  /** True once the message stream is complete (disables mid-state parsing). */
  final: boolean
}

/**
 * Streaming-friendly Markdown renderer for agent chat messages.
 * Tolerates incomplete Markdown while streaming; Mermaid diagrams render
 * automatically when a `mermaid` code block appears.
 */
export function MarkdownStream({ content, final }: MarkdownStreamProps) {
  const { resolvedTheme } = useTheme()
  // Streaming vs recovered history (per .agents/skills/markstream-react):
  // while streaming, 'auto' pacing + no fade (fade flickers on appended text);
  // for static final content, pacing must be off (it stalls mid-reveal) and
  // fade gives a polished entry.
  return (
    <MarkdownRender
      content={content}
      final={final}
      isDark={resolvedTheme === 'dark'}
      customId="agent"
      smoothStreaming={final ? false : 'auto'}
      fade={final}
    />
  )
}
