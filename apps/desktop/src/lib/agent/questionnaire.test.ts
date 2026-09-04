import assert from 'node:assert/strict'
import test from 'node:test'

import {
  parseQuestionnaireDetails,
  parseQuestionnaireParams,
  questionnaireResponseFromForm,
} from './questionnaire.js'

const args = {
  questions: [
    {
      id: 'genre',
      prompt: '选择题材',
      options: [
        { value: 'realistic', label: '现实主义', description: '贴近真实生活' },
        { value: 'fantasy', label: '奇幻' },
      ],
    },
  ],
}

void test('前端问卷参数解析会补齐默认值并保留选项描述', () => {
  const parsed = parseQuestionnaireParams(args)
  assert.ok(parsed)
  assert.deepEqual(parsed.questions[0], {
    id: 'genre',
    prompt: '选择题材',
    options: [
      { value: 'realistic', label: '现实主义', description: '贴近真实生活' },
      { value: 'fantasy', label: '奇幻' },
    ],
    required: true,
    multiple: false,
    allowOther: true,
  })
})

void test('前端问卷参数解析拒绝重复 id、重复选项和空问题', () => {
  assert.equal(
    parseQuestionnaireParams({
      questions: [args.questions[0], args.questions[0]],
    }),
    null,
  )
  assert.equal(
    parseQuestionnaireParams({
      questions: [
        {
          ...args.questions[0],
          options: [args.questions[0].options[0], args.questions[0].options[0]],
        },
      ],
    }),
    null,
  )
  assert.equal(
    parseQuestionnaireParams({ questions: [{ id: 'empty', prompt: '', options: [] }] }),
    null,
  )
})

void test('前端只读取合法的已提交详情，取消结果也可只读展示', () => {
  const parsed = parseQuestionnaireDetails({
    questions: args.questions,
    answers: [
      {
        id: 'genre',
        status: 'answered',
        values: ['realistic'],
        labels: ['现实主义'],
      },
    ],
    cancelled: false,
  })
  assert.ok(parsed)
  assert.equal(parsed.answers[0]?.labels[0], '现实主义')

  const cancelled = parseQuestionnaireDetails({
    questions: args.questions,
    answers: [],
    cancelled: true,
  })
  assert.equal(cancelled?.cancelled, true)
  assert.equal(
    parseQuestionnaireDetails({ questions: args.questions, answers: [], cancelled: 'yes' }),
    null,
  )
})

void test('前端回答序列化会保留选项和自由输入，并过滤空值', () => {
  const OriginalFormData = globalThis.FormData
  class StubFormData {
    getAll(name: string): FormDataEntryValue[] {
      return name === 'genre' ? ['realistic', '原创城市', ''] : []
    }
  }

  globalThis.FormData = StubFormData as unknown as typeof FormData
  try {
    assert.deepEqual(questionnaireResponseFromForm({} as HTMLFormElement, args.questions), {
      answers: [{ id: 'genre', values: ['realistic', '原创城市'] }],
    })
  } finally {
    globalThis.FormData = OriginalFormData
  }
})
