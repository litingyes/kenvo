import assert from 'node:assert/strict'
import test from 'node:test'

import { aggregateAssistantUsage } from './message-usage'
import type {
  UiAssistantMessage,
  UiMessage,
  UiToolResultMessage,
  UiUserMessage,
} from './use-agent-chat'

function user(text: string): UiUserMessage {
  return { role: 'user', content: text, timestamp: 1 }
}

function assistant(usage?: UiAssistantMessage['usage'], text = 'assistant'): UiAssistantMessage {
  return {
    role: 'assistant',
    content: [{ type: 'text', text }],
    usage,
    timestamp: 2,
  }
}

function toolResult(): UiToolResultMessage {
  return {
    role: 'toolResult',
    toolCallId: 'tool-1',
    toolName: 'read_file',
    content: [{ type: 'text', text: 'result' }],
    isError: false,
    timestamp: 3,
  }
}

void test('只把一次用户请求的累计 usage 绑定到最后一个 assistant', () => {
  const messages: UiMessage[] = [
    user('检查总纲'),
    assistant({ input: 100, output: 20, cost: { total: 0.001 } }, '先读取文件'),
    toolResult(),
    assistant({ input: 200, output: 30, cost: { total: 0.002 } }, '完成分析'),
  ]

  const usageByMessage = aggregateAssistantUsage(messages)

  assert.deepEqual([...usageByMessage.keys()], [3])
  assert.deepEqual(usageByMessage.get(3), {
    input: 300,
    output: 50,
    cost: { total: 0.003 },
  })
})

void test('新的 user message 会开启新的 usage 分组', () => {
  const messages: UiMessage[] = [
    user('第一次'),
    assistant({ input: 10, output: 5, cost: { total: 0.001 } }),
    user('第二次'),
    assistant({ input: 20, output: 6, cost: { total: 0.002 } }),
    toolResult(),
    assistant({ input: 30, output: 7, cost: { total: 0.003 } }),
  ]

  const usageByMessage = aggregateAssistantUsage(messages)

  assert.deepEqual([...usageByMessage.keys()], [1, 5])
  assert.deepEqual(usageByMessage.get(1), {
    input: 10,
    output: 5,
    cost: { total: 0.001 },
  })
  assert.deepEqual(usageByMessage.get(5), {
    input: 50,
    output: 13,
    cost: { total: 0.005 },
  })
})

void test('流式进行中的末尾分组不显示，但保留已完成分组', () => {
  const usageByMessage = aggregateAssistantUsage(
    [
      user('第一次'),
      assistant({ input: 10, output: 20, cost: { total: 0.001 } }),
      user('第二次'),
      assistant({ input: 30, output: 40, cost: { total: 0.003 } }),
      assistant({ input: 50, output: 60, cost: { total: 0.005 } }),
    ],
    { includeTrailingSegment: false },
  )

  assert.deepEqual([...usageByMessage.keys()], [1])
  assert.deepEqual(usageByMessage.get(1), {
    input: 10,
    output: 20,
    cost: { total: 0.001 },
  })
})

void test('缺少 usage 或 cost 时保持有限数值', () => {
  const messages: UiMessage[] = [
    user('继续'),
    assistant(),
    toolResult(),
    assistant({ input: 12, output: 8 }),
  ]

  const usageByMessage = aggregateAssistantUsage(messages)

  assert.deepEqual(usageByMessage.get(3), { input: 12, output: 8 })
})
