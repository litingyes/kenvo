import type { Telemetry } from 'ai'

import { writeAiRecord } from './logging.js'

interface CallState {
  functionId?: string
  operationId?: string
  provider?: string
  modelId?: string
  instructions?: unknown
  messages?: unknown
  startedAt: number
}

function summarizeUsage(usage: unknown): Record<string, unknown> | undefined {
  if (!usage || typeof usage !== 'object') {
    return undefined
  }
  const u = usage as {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    inputTokenDetails?: {
      noCacheTokens?: number
      cacheReadTokens?: number
      cacheWriteTokens?: number
    }
    outputTokenDetails?: { textTokens?: number; reasoningTokens?: number }
  }
  return {
    inputTokens: u.inputTokens,
    outputTokens: u.outputTokens,
    totalTokens: u.totalTokens,
    cacheReadTokens: u.inputTokenDetails?.cacheReadTokens,
    cacheWriteTokens: u.inputTokenDetails?.cacheWriteTokens,
    reasoningTokens: u.outputTokenDetails?.reasoningTokens,
  }
}

export class LocalFileTelemetry implements Telemetry {
  private calls = new Map<string, CallState>()

  onStart = (raw: unknown): void => {
    const event = raw as Record<string, unknown>
    const callId = event.callId as string | undefined
    if (!callId) {
      return
    }
    this.calls.set(callId, {
      functionId: event.functionId as string | undefined,
      operationId: event.operationId as string | undefined,
      provider: event.provider as string | undefined,
      modelId: event.modelId as string | undefined,
      instructions: event.instructions,
      messages: event.messages,
      startedAt: Date.now(),
    })
    writeAiRecord({
      type: 'call-start',
      callId,
      functionId: event.functionId,
      operationId: event.operationId,
      provider: event.provider,
      modelId: event.modelId,
    })
  }

  onEnd = (raw: unknown): void => {
    const event = raw as Record<string, unknown>
    const callId = event.callId as string | undefined
    if (!callId) {
      return
    }
    const state = this.calls.get(callId)
    this.calls.delete(callId)

    writeAiRecord({
      type: 'conversation',
      callId,
      functionId: state?.functionId ?? (event.functionId as string | undefined),
      operationId: state?.operationId,
      provider: state?.provider,
      modelId: state?.modelId,
      instructions: state?.instructions,
      messages: state?.messages,
      responseMessages: event.responseMessages,
      text: event.text,
      finishReason: event.finishReason,
      usage: summarizeUsage(event.usage),
      stepCount: Array.isArray(event.steps) ? event.steps.length : undefined,
      durationMs: state ? Date.now() - state.startedAt : undefined,
    })
  }

  onError = (raw: unknown): void => {
    const event = (raw ?? {}) as Record<string, unknown>
    const callId = event.callId as string | undefined
    const state = callId ? this.calls.get(callId) : undefined
    if (callId) {
      this.calls.delete(callId)
    }
    const error = event.error
    writeAiRecord({
      type: 'error',
      callId,
      functionId: state?.functionId,
      operationId: state?.operationId,
      provider: state?.provider,
      modelId: state?.modelId,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : undefined,
      durationMs: state ? Date.now() - state.startedAt : undefined,
    })
  }
}
