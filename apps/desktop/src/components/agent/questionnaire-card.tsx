import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  LoaderCircleIcon,
  XIcon,
} from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from '@/components/ui/questionnaire'
import {
  parseQuestionnaireDetails,
  parseQuestionnaireParams,
  questionnaireResponseFromForm,
  type QuestionnaireDetails,
  type QuestionnaireParams,
} from '@/lib/agent/questionnaire'
import type { UiToolResultMessage, ToolExecutionState } from '@/lib/agent/use-agent-chat'
import type { QuestionnaireResponsePayload } from '@/lib/ai/server-client'
import { cn } from '@/lib/utils'

interface QuestionnaireCardProps {
  toolCallId: string
  args: Record<string, unknown>
  execution?: ToolExecutionState
  result?: UiToolResultMessage
  onRespond: (toolCallId: string, response: QuestionnaireResponsePayload) => Promise<void>
}

function QuestionnaireStatus({
  icon,
  children,
  className,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <span aria-hidden="true">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

function CompletedQuestionnaire({ details }: { details: QuestionnaireDetails }) {
  const { t } = useTranslation()
  return (
    <Bubble variant="outline" className="w-full max-w-3xl">
      <BubbleContent className="w-full max-w-none p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckIcon className="text-primary" data-icon="inline-start" />
            {t('agent.questionnaire.completed')}
          </div>
          <div className="flex flex-col gap-2">
            {details.answers.map((answer) => {
              const question = details.questions.find((item) => item.id === answer.id)
              return (
                <div key={answer.id} className="flex min-w-0 flex-col gap-0.5 text-sm">
                  <span className="font-medium">
                    {question?.label || question?.prompt || answer.id}
                  </span>
                  <span className="text-muted-foreground">
                    {answer.status === 'skipped'
                      ? t('agent.questionnaire.skipped')
                      : answer.labels.join(', ')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </BubbleContent>
    </Bubble>
  )
}

function CancelledQuestionnaire() {
  const { t } = useTranslation()
  return (
    <Bubble variant="outline" className="w-full max-w-3xl">
      <BubbleContent className="w-full max-w-none p-4 sm:p-5">
        <QuestionnaireStatus icon={<XIcon />}>
          {t('agent.questionnaire.cancelled')}
        </QuestionnaireStatus>
      </BubbleContent>
    </Bubble>
  )
}

export function QuestionnaireCard({
  toolCallId,
  args,
  execution,
  result,
  onRespond,
}: QuestionnaireCardProps) {
  const { t } = useTranslation()
  const params = React.useMemo(() => parseQuestionnaireParams(args), [args])
  const details = React.useMemo(
    () => parseQuestionnaireDetails(result?.details ?? execution?.result?.details),
    [execution?.result?.details, result?.details],
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (details) setSubmitted(true)
  }, [details])

  const respond = React.useCallback(
    async (response: QuestionnaireResponsePayload) => {
      setSubmitting(true)
      setError(null)
      try {
        await onRespond(toolCallId, response)
        setSubmitted(true)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught))
      } finally {
        setSubmitting(false)
      }
    },
    [onRespond, toolCallId],
  )

  if (!params) return null
  if (details?.cancelled) return <CancelledQuestionnaire />
  if (details) return <CompletedQuestionnaire details={details} />

  if (submitted) {
    return (
      <Bubble variant="outline" className="w-full max-w-3xl">
        <BubbleContent className="w-full max-w-none p-4 sm:p-5">
          <QuestionnaireStatus
            icon={<LoaderCircleIcon className="motion-safe:animate-spin" />}
            className="text-foreground"
          >
            {t('agent.questionnaire.waiting')}
          </QuestionnaireStatus>
        </BubbleContent>
      </Bubble>
    )
  }

  const hasToolError = execution?.status === 'error' || result?.isError
  if (hasToolError) {
    return (
      <Bubble variant="destructive" className="w-full max-w-3xl">
        <BubbleContent className="w-full max-w-none p-4 sm:p-5">
          <QuestionnaireStatus icon={<CircleHelpIcon />} className="text-destructive">
            {result?.content?.[0]?.text || t('agent.questionnaire.unavailable')}
          </QuestionnaireStatus>
        </BubbleContent>
      </Bubble>
    )
  }

  if (execution?.status !== 'running') {
    return (
      <Bubble variant="outline" className="w-full max-w-3xl">
        <BubbleContent className="w-full max-w-none p-4 sm:p-5">
          <QuestionnaireStatus icon={<CircleHelpIcon />}>
            {t('agent.questionnaire.unavailable')}
          </QuestionnaireStatus>
        </BubbleContent>
      </Bubble>
    )
  }

  return (
    <Bubble variant="outline" className="w-full max-w-3xl">
      <BubbleContent className="w-full max-w-none p-4 sm:p-5">
        <Questionnaire
          items={params.questions.map((question) => ({
            name: question.id,
            required: question.required,
            choices: question.options.map((option) => ({ value: option.value })),
          }))}
          shortcuts="numbers"
          onSubmit={(event) => {
            event.preventDefault()
            void respond(questionnaireResponseFromForm(event.currentTarget, params.questions))
          }}
          aria-busy={submitting}
          aria-label={t('agent.questionnaire.title')}
          className="gap-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <CircleHelpIcon data-icon="inline-start" />
              {t('agent.questionnaire.title')}
            </div>
            <QuestionnaireProgress />
          </div>

          {params.questions.map((question) => (
            <QuestionnaireItem
              key={question.id}
              name={question.id}
              disabled={submitting}
              required={question.required}
              multiple={question.multiple}
            >
              <QuestionnaireTitle>
                {question.label && (
                  <span className="mb-1 block text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {question.label}
                  </span>
                )}
                <span>
                  {question.prompt}
                  <span className="ms-2 text-xs font-normal text-muted-foreground">
                    (
                    {t(
                      question.required
                        ? 'agent.questionnaire.required'
                        : 'agent.questionnaire.optional',
                    )}
                    )
                  </span>
                </span>
              </QuestionnaireTitle>
              {question.description && (
                <QuestionnaireDescription>{question.description}</QuestionnaireDescription>
              )}
              <QuestionnaireChoices>
                {question.options.map((option) => (
                  <QuestionnaireChoice key={option.value} value={option.value}>
                    <span>{option.label}</span>
                    {option.description && (
                      <QuestionnaireChoiceDescription>
                        {option.description}
                      </QuestionnaireChoiceDescription>
                    )}
                  </QuestionnaireChoice>
                ))}
              </QuestionnaireChoices>
              {question.allowOther && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('agent.questionnaire.other')}
                  </span>
                  <QuestionnaireInput
                    placeholder={t('agent.questionnaire.otherPlaceholder')}
                    aria-label={t('agent.questionnaire.other')}
                  />
                </div>
              )}
              <QuestionnaireError>
                {t(
                  question.required
                    ? 'agent.questionnaire.requiredError'
                    : 'agent.questionnaire.optionalError',
                )}
              </QuestionnaireError>
            </QuestionnaireItem>
          ))}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 sm:min-h-0"
              disabled={submitting}
              onClick={() => void respond({ cancelled: true, answers: [] })}
            >
              {t('agent.questionnaire.cancel')}
            </Button>
          </div>
          <QuestionnaireActions>
            <QuestionnairePrevious disabled={submitting}>
              <ChevronLeftIcon data-icon="inline-start" />
              {t('agent.questionnaire.previous')}
            </QuestionnairePrevious>
            <QuestionnaireSkip disabled={submitting}>
              {t('agent.questionnaire.skip')}
            </QuestionnaireSkip>
            <QuestionnaireNext disabled={submitting}>
              {t('agent.questionnaire.next')}
              <ChevronRightIcon data-icon="inline-end" />
            </QuestionnaireNext>
            <QuestionnaireSubmit disabled={submitting}>
              {submitting && (
                <LoaderCircleIcon className="motion-safe:animate-spin" data-icon="inline-start" />
              )}
              {t('agent.questionnaire.submit')}
            </QuestionnaireSubmit>
          </QuestionnaireActions>
        </Questionnaire>
      </BubbleContent>
    </Bubble>
  )
}

export type { QuestionnaireParams }
