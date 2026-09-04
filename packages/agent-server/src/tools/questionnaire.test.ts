import assert from 'node:assert/strict'
import test from 'node:test'

import {
  cancelPendingQuestionnaires,
  createQuestionnaireTool,
  hasPendingQuestionnaire,
  respondToQuestionnaire,
} from './questionnaire.js'

const params = {
  questions: [
    {
      id: 'direction',
      label: '方向',
      prompt: '选择一个方向',
      options: [
        { value: 'realistic', label: '现实主义' },
        { value: 'fantasy', label: '奇幻' },
      ],
      allowOther: false,
    },
  ],
}

test('问卷工具等待回答，并返回结构化答案和可读文本', async () => {
  const tool = createQuestionnaireTool('session-1')
  const execution = tool.execute('call-1', params)

  respondToQuestionnaire('session-1', 'call-1', {
    answers: [{ id: 'direction', values: ['realistic'] }],
  })

  const result = await execution
  assert.equal(result.details.cancelled, false)
  assert.deepEqual(result.details.answers[0], {
    id: 'direction',
    status: 'answered',
    values: ['realistic'],
    labels: ['现实主义'],
  })
  const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
  assert.match(text, /方向: 现实主义/)
})

test('问卷支持多选、自由输入、可选题跳过和取消', async () => {
  const tool = createQuestionnaireTool('session-2')
  const optionalParams = {
    questions: [
      {
        ...params.questions[0],
        multiple: true,
        allowOther: true,
      },
      {
        id: 'tone',
        prompt: '选择基调',
        required: false,
        options: [{ value: 'quiet', label: '克制' }],
      },
    ],
  }
  const execution = tool.execute('call-2', optionalParams)

  respondToQuestionnaire('session-2', 'call-2', {
    answers: [{ id: 'direction', values: ['realistic', '原创城市'] }],
  })

  const result = await execution
  assert.deepEqual(result.details.answers, [
    {
      id: 'direction',
      status: 'answered',
      values: ['realistic', '原创城市'],
      labels: ['现实主义', '原创城市'],
    },
    { id: 'tone', status: 'skipped', values: [], labels: [] },
  ])

  const cancelledExecution = tool.execute('call-3', params)
  respondToQuestionnaire('session-2', 'call-3', { cancelled: true, answers: [] })
  const cancelled = await cancelledExecution
  assert.equal(cancelled.details.cancelled, true)
  assert.deepEqual(cancelled.details.answers, [])
})

test('问卷拒绝非法选项、必填缺失和单选多值，并允许重试', async () => {
  const tool = createQuestionnaireTool('session-3')
  const execution = tool.execute('call-4', params)

  assert.throws(
    () =>
      respondToQuestionnaire('session-3', 'call-4', {
        answers: [{ id: 'direction', values: ['unknown'] }],
      }),
    /custom answers/,
  )
  assert.throws(
    () => respondToQuestionnaire('session-3', 'call-4', { answers: [] }),
    /requires an answer/,
  )
  assert.throws(
    () =>
      respondToQuestionnaire('session-3', 'call-4', {
        answers: [{ id: 'direction', values: ['realistic', 'fantasy'] }],
      }),
    /only accepts one answer/,
  )

  respondToQuestionnaire('session-3', 'call-4', {
    answers: [{ id: 'direction', values: ['fantasy'] }],
  })
  await execution
})

test('工具执行收到 abort signal 时清理等待中的问卷', async () => {
  const tool = createQuestionnaireTool('session-4')
  const controller = new AbortController()
  const execution = tool.execute('call-5', params, controller.signal)
  controller.abort()
  await assert.rejects(execution, /aborted/)

  assert.throws(
    () =>
      respondToQuestionnaire('session-4', 'call-5', {
        answers: [{ id: 'direction', values: ['realistic'] }],
      }),
    /no longer waiting/,
  )
})

test('session abort 会拒绝并清理所有等待中的问卷', async () => {
  const tool = createQuestionnaireTool('session-5')
  const first = tool.execute('call-6', params)
  const second = tool.execute('call-7', params)

  assert.equal(hasPendingQuestionnaire('session-5'), true)
  cancelPendingQuestionnaires('session-5')
  await assert.rejects(first, /aborted/)
  await assert.rejects(second, /aborted/)
  assert.equal(hasPendingQuestionnaire('session-5'), false)
})
