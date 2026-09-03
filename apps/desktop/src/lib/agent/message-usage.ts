import type { UiMessage } from './use-agent-chat'

export type DisplayUsage = NonNullable<Extract<UiMessage, { role: 'assistant' }>['usage']>

/**
 * Aggregate assistant usage for each user-request segment without changing
 * the message list. Only the last assistant in a segment receives the result.
 */
export function aggregateAssistantUsage(
  messages: readonly UiMessage[],
  options: { includeTrailingSegment?: boolean } = {},
): Map<number, DisplayUsage> {
  const { includeTrailingSegment = true } = options
  const usageByMessage = new Map<number, DisplayUsage>()
  let assistantIndices: number[] = []
  let input = 0
  let output = 0
  let cost = 0
  let hasUsage = false
  let hasCost = false

  const flush = (include = true) => {
    const lastAssistantIndex = assistantIndices[assistantIndices.length - 1]
    if (include && lastAssistantIndex !== undefined && hasUsage) {
      usageByMessage.set(lastAssistantIndex, {
        input,
        output,
        ...(hasCost ? { cost: { total: cost } } : {}),
      })
    }
    assistantIndices = []
    input = 0
    output = 0
    cost = 0
    hasUsage = false
    hasCost = false
  }

  messages.forEach((message, index) => {
    if (message.role === 'user') {
      flush()
      return
    }
    if (message.role !== 'assistant') return

    assistantIndices.push(index)
    if (!message.usage) return

    hasUsage = true
    if (Number.isFinite(message.usage.input)) input += message.usage.input
    if (Number.isFinite(message.usage.output)) output += message.usage.output
    if (message.usage.cost && Number.isFinite(message.usage.cost.total)) {
      hasCost = true
      cost += message.usage.cost.total
    }
  })
  flush(includeTrailingSegment)

  return usageByMessage
}
