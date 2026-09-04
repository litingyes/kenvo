import type { QuestionnaireResponsePayload } from '@/lib/ai/server-client'

const MAX_QUESTIONS = 8
const MAX_OPTIONS = 12

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

export interface QuestionnaireParams {
  questions: QuestionnaireQuestion[]
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

export function parseQuestionnaireParams(value: unknown): QuestionnaireParams | null {
  if (!isRecord(value) || !Array.isArray(value.questions)) return null
  if (value.questions.length === 0 || value.questions.length > MAX_QUESTIONS) return null

  const ids = new Set<string>()
  const questions: QuestionnaireQuestion[] = []
  for (const rawQuestion of value.questions) {
    if (!isRecord(rawQuestion)) return null
    const id = stringValue(rawQuestion.id)
    const prompt = stringValue(rawQuestion.prompt)
    if (!id || !prompt || ids.has(id) || !Array.isArray(rawQuestion.options)) return null
    if (rawQuestion.options.length === 0 || rawQuestion.options.length > MAX_OPTIONS) return null
    ids.add(id)

    const optionValues = new Set<string>()
    const options: QuestionnaireOption[] = []
    for (const rawOption of rawQuestion.options) {
      if (!isRecord(rawOption)) return null
      const optionValue = stringValue(rawOption.value)
      const label = stringValue(rawOption.label)
      if (!optionValue || !label || optionValues.has(optionValue)) return null
      optionValues.add(optionValue)
      const description = stringValue(rawOption.description)
      options.push({
        value: optionValue,
        label,
        ...(description ? { description } : {}),
      })
    }

    const label = stringValue(rawQuestion.label)
    const description = stringValue(rawQuestion.description)
    questions.push({
      id,
      ...(label ? { label } : {}),
      prompt,
      ...(description ? { description } : {}),
      options,
      required: rawQuestion.required !== false,
      multiple: rawQuestion.multiple === true,
      allowOther: rawQuestion.allowOther !== false,
    })
  }

  return { questions }
}

export function parseQuestionnaireDetails(value: unknown): QuestionnaireDetails | null {
  if (!isRecord(value) || typeof value.cancelled !== 'boolean') return null
  const params = parseQuestionnaireParams({ questions: value.questions })
  if (!params || !Array.isArray(value.answers)) return null

  const questionIds = new Set(params.questions.map((question) => question.id))
  const answers: QuestionnaireAnswer[] = []
  const seen = new Set<string>()
  for (const rawAnswer of value.answers) {
    if (!isRecord(rawAnswer)) return null
    const id = stringValue(rawAnswer.id)
    const status = rawAnswer.status
    if (
      !id ||
      !questionIds.has(id) ||
      seen.has(id) ||
      (status !== 'answered' && status !== 'skipped') ||
      !Array.isArray(rawAnswer.values) ||
      !Array.isArray(rawAnswer.labels) ||
      !rawAnswer.values.every((item) => typeof item === 'string') ||
      !rawAnswer.labels.every((item) => typeof item === 'string')
    ) {
      return null
    }
    seen.add(id)
    answers.push({
      id,
      status,
      values: rawAnswer.values,
      labels: rawAnswer.labels,
    })
  }

  return { questions: params.questions, answers, cancelled: value.cancelled }
}

export function questionnaireResponseFromForm(
  form: HTMLFormElement,
  questions: QuestionnaireQuestion[],
): QuestionnaireResponsePayload {
  const formData = new FormData(form)
  return {
    answers: questions.map((question) => ({
      id: question.id,
      values: formData
        .getAll(question.id)
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    })),
  }
}
