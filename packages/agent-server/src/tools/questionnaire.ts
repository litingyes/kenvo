import type { AgentTool } from '@earendil-works/pi-agent-core'
import { Type } from '@earendil-works/pi-ai'

const MAX_QUESTIONS = 8
const MAX_OPTIONS = 12
const MAX_TEXT_LENGTH = 2_000

const optionSchema = Type.Object({
  value: Type.String({ minLength: 1, maxLength: 200 }),
  label: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.Optional(Type.String({ maxLength: MAX_TEXT_LENGTH })),
})

const questionSchema = Type.Object({
  id: Type.String({ minLength: 1, maxLength: 100 }),
  label: Type.Optional(Type.String({ maxLength: 200 })),
  prompt: Type.String({ minLength: 1, maxLength: MAX_TEXT_LENGTH }),
  description: Type.Optional(Type.String({ maxLength: MAX_TEXT_LENGTH })),
  options: Type.Array(optionSchema, { minItems: 1, maxItems: MAX_OPTIONS }),
  required: Type.Optional(Type.Boolean()),
  multiple: Type.Optional(Type.Boolean()),
  allowOther: Type.Optional(Type.Boolean()),
})

export const questionnaireParameters = Type.Object({
  questions: Type.Array(questionSchema, { minItems: 1, maxItems: MAX_QUESTIONS }),
})

export interface QuestionnaireOption {
  value: string
  label: string
  description?: string
}

export interface QuestionnaireQuestion {
  id: string
  label?: string
  prompt: string
  description?: string
  options: QuestionnaireOption[]
  required: boolean
  multiple: boolean
  allowOther: boolean
}

export interface QuestionnaireAnswer {
  id: string
  status: 'answered' | 'skipped'
  values: string[]
  labels: string[]
}

export interface QuestionnaireDetails {
  questions: QuestionnaireQuestion[]
  answers: QuestionnaireAnswer[]
  cancelled: boolean
}

export interface QuestionnaireResponseInput {
  cancelled?: boolean
  answers?: Array<{
    id: string
    values?: string[]
    status?: 'answered' | 'skipped'
  }>
}

export class QuestionnaireInteractionError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message)
  }
}

interface PendingQuestionnaire {
  key: string
  sessionId: string
  toolCallId: string
  questions: QuestionnaireQuestion[]
  resolve: (details: QuestionnaireDetails) => void
  reject: (error: Error) => void
  signal?: AbortSignal
  onAbort?: () => void
}

const pendingQuestionnaires = new Map<string, PendingQuestionnaire>()

function pendingKey(sessionId: string, toolCallId: string): string {
  return `${sessionId}\u0000${toolCallId}`
}

function normalizeQuestions(
  questions: Array<{
    id: string
    label?: string
    prompt: string
    description?: string
    options: QuestionnaireOption[]
    required?: boolean
    multiple?: boolean
    allowOther?: boolean
  }>,
): QuestionnaireQuestion[] {
  const ids = new Set<string>()
  return questions.map((question) => {
    if (ids.has(question.id)) {
      throw new QuestionnaireInteractionError(`Question id is duplicated: ${question.id}`)
    }
    ids.add(question.id)

    const optionValues = new Set<string>()
    for (const option of question.options) {
      if (optionValues.has(option.value)) {
        throw new QuestionnaireInteractionError(
          `Option value is duplicated in question ${question.id}: ${option.value}`,
        )
      }
      optionValues.add(option.value)
    }

    return {
      id: question.id,
      ...(question.label ? { label: question.label } : {}),
      prompt: question.prompt,
      ...(question.description ? { description: question.description } : {}),
      options: question.options.map((option) => ({
        value: option.value,
        label: option.label,
        ...(option.description ? { description: option.description } : {}),
      })),
      required: question.required ?? true,
      multiple: question.multiple ?? false,
      allowOther: question.allowOther ?? true,
    }
  })
}

function removePending(pending: PendingQuestionnaire): void {
  if (pendingQuestionnaires.get(pending.key) === pending) {
    pendingQuestionnaires.delete(pending.key)
  }
  if (pending.signal && pending.onAbort) {
    pending.signal.removeEventListener('abort', pending.onAbort)
  }
}

function createAnswer(
  question: QuestionnaireQuestion,
  input: { id: string; values?: string[]; status?: 'answered' | 'skipped' },
): QuestionnaireAnswer {
  const values = Array.from(
    new Set((input.values ?? []).map((value) => value.trim()).filter(Boolean)),
  )
  const optionByValue = new Map(question.options.map((option) => [option.value, option]))

  if (input.status === 'skipped' || values.length === 0) {
    if (question.required) {
      throw new QuestionnaireInteractionError(`Question requires an answer: ${question.id}`)
    }
    return { id: question.id, status: 'skipped', values: [], labels: [] }
  }

  if (!question.multiple && values.length > 1) {
    throw new QuestionnaireInteractionError(`Question only accepts one answer: ${question.id}`)
  }

  const unknownValues = values.filter((value) => !optionByValue.has(value))
  if (unknownValues.length > 0 && !question.allowOther) {
    throw new QuestionnaireInteractionError(
      `Question does not allow custom answers: ${question.id}`,
    )
  }

  const labels = values.map((value) => optionByValue.get(value)?.label ?? value)
  return { id: question.id, status: 'answered', values, labels }
}

function resolveResponse(
  pending: PendingQuestionnaire,
  input: QuestionnaireResponseInput,
): QuestionnaireDetails {
  if (input.cancelled !== undefined && typeof input.cancelled !== 'boolean') {
    throw new QuestionnaireInteractionError('Questionnaire cancelled must be a boolean')
  }
  if (input.cancelled) {
    return { questions: pending.questions, answers: [], cancelled: true }
  }

  if (!Array.isArray(input.answers)) {
    throw new QuestionnaireInteractionError('Questionnaire answers must be an array')
  }

  const questionById = new Map(pending.questions.map((question) => [question.id, question]))
  const seen = new Set<string>()
  for (const answer of input.answers) {
    if (
      !answer ||
      typeof answer !== 'object' ||
      typeof answer.id !== 'string' ||
      !questionById.has(answer.id)
    ) {
      throw new QuestionnaireInteractionError(`Unknown questionnaire answer: ${answer?.id ?? ''}`)
    }
    if (
      answer.status !== undefined &&
      answer.status !== 'answered' &&
      answer.status !== 'skipped'
    ) {
      throw new QuestionnaireInteractionError(`Invalid answer status: ${answer.id}`)
    }
    if (
      answer.values !== undefined &&
      (!Array.isArray(answer.values) || !answer.values.every((value) => typeof value === 'string'))
    ) {
      throw new QuestionnaireInteractionError(`Invalid answer values: ${answer.id}`)
    }
    if (seen.has(answer.id)) {
      throw new QuestionnaireInteractionError(`Question answer is duplicated: ${answer.id}`)
    }
    seen.add(answer.id)
  }

  const answers = pending.questions.map((question) => {
    const inputAnswer = input.answers?.find((answer) => answer.id === question.id)
    return createAnswer(question, inputAnswer ?? { id: question.id, status: 'skipped' })
  })

  return { questions: pending.questions, answers, cancelled: false }
}

function answerText(details: QuestionnaireDetails): string {
  if (details.cancelled) return 'The user cancelled the questionnaire.'
  const lines = details.answers.map((answer) => {
    const question = details.questions.find((item) => item.id === answer.id)
    const title = question?.label || question?.prompt || answer.id
    return `${title}: ${answer.status === 'skipped' ? '(skipped)' : answer.labels.join(', ')}`
  })
  return ['The user answered the questionnaire:', ...lines].join('\n')
}

async function waitForQuestionnaire(
  sessionId: string,
  toolCallId: string,
  questions: QuestionnaireQuestion[],
  signal?: AbortSignal,
): Promise<QuestionnaireDetails> {
  const key = pendingKey(sessionId, toolCallId)
  if (pendingQuestionnaires.has(key)) {
    throw new QuestionnaireInteractionError('Questionnaire is already waiting for a response', 409)
  }

  return new Promise<QuestionnaireDetails>((resolve, reject) => {
    const pending: PendingQuestionnaire = {
      key,
      sessionId,
      toolCallId,
      questions,
      resolve: (details) => {
        removePending(pending)
        resolve(details)
      },
      reject: (error) => {
        removePending(pending)
        reject(error)
      },
      signal,
    }
    pending.onAbort = () => pending.reject(new Error('Questionnaire interaction aborted'))
    pendingQuestionnaires.set(key, pending)
    if (signal?.aborted) pending.onAbort()
    else signal?.addEventListener('abort', pending.onAbort, { once: true })
  })
}

export function createQuestionnaireTool(
  sessionId: string,
): AgentTool<typeof questionnaireParameters, QuestionnaireDetails> {
  return {
    name: 'questionnaire',
    label: 'Questionnaire',
    description:
      'Ask the user one or more structured questions with selectable options. Use this for discrete choices or clarification branches; use normal conversation for open-ended discussion.',
    parameters: questionnaireParameters,
    executionMode: 'sequential',
    execute: async (_toolCallId, params, signal) => {
      const questions = normalizeQuestions(params.questions)
      const details = await waitForQuestionnaire(sessionId, _toolCallId, questions, signal)
      return { content: [{ type: 'text', text: answerText(details) }], details }
    },
  }
}

export function respondToQuestionnaire(
  sessionId: string,
  toolCallId: string,
  input: unknown,
): void {
  const key = pendingKey(sessionId, toolCallId)
  const pending = pendingQuestionnaires.get(key)
  if (!pending) {
    throw new QuestionnaireInteractionError('Questionnaire is no longer waiting for a response', 404)
  }

  if (!input || typeof input !== 'object') {
    throw new QuestionnaireInteractionError('Invalid questionnaire response')
  }

  const response = input as QuestionnaireResponseInput
  const details = resolveResponse(pending, response)
  pending.resolve(details)
}

export function hasPendingQuestionnaire(sessionId: string): boolean {
  for (const pending of pendingQuestionnaires.values()) {
    if (pending.sessionId === sessionId) return true
  }
  return false
}

export function cancelPendingQuestionnaires(sessionId: string): void {
  for (const pending of Array.from(pendingQuestionnaires.values())) {
    if (pending.sessionId === sessionId) {
      pending.reject(new Error('Questionnaire interaction aborted'))
    }
  }
}
