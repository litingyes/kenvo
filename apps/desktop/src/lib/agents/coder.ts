import { createAgentServerClient, isAgentServerRunning } from '@/lib/ai/server-client'
import {
  getAgentServerStatus,
  getAiSettings,
  resolveAgentModel,
  startAgentServer,
} from '@/lib/ai/settings-bridge'
import { logger } from '@/lib/logger'
import { runExternalQuiet } from '@/lib/terminal/external-runner'

const MAX_DIFF_CHARS = 20000

export interface CommitContext {
  diffStat: string
  diff: string
  untrackedFiles: string[]
  recentCommits: string[]
}

export async function collectCommitContext(cwd: string): Promise<CommitContext> {
  const [diffStat, rawDiff, untrackedOut, logOut] = await Promise.all([
    runExternalQuiet('git diff HEAD --stat 2>/dev/null || git diff --stat 2>/dev/null', cwd),
    runExternalQuiet('git diff HEAD 2>/dev/null || git diff 2>/dev/null', cwd),
    runExternalQuiet('git ls-files --others --exclude-standard 2>/dev/null', cwd),
    runExternalQuiet('git log -5 --format=%s 2>/dev/null', cwd),
  ])

  const truncated = rawDiff.length > MAX_DIFF_CHARS
  return {
    diffStat,
    diff: truncated ? `${rawDiff.slice(0, MAX_DIFF_CHARS)}\n... (diff truncated)` : rawDiff,
    untrackedFiles: untrackedOut.split('\n').filter(Boolean),
    recentCommits: logOut.split('\n').filter(Boolean),
  }
}

export type GenerateCommitMessageError = 'no-model' | 'provider-not-configured' | 'run-failed'

export async function generateCommitMessage(cwd: string): Promise<string> {
  const startedAt = Date.now()
  const settings = await getAiSettings()
  const assignment = resolveAgentModel(settings, 'coder')
  if (!assignment) {
    void logger.error('[coder] generate commit message failed: no-model')
    throw new Error('no-model')
  }

  const provider = settings.providers.find((p) => p.id === assignment.providerId)
  if (!provider?.apiKey) {
    void logger.error(
      `[coder] generate commit message failed: provider-not-configured (${assignment.providerId})`,
    )
    throw new Error('provider-not-configured')
  }

  void logger.info(
    `[coder] generate commit message started (provider=${assignment.providerId}, model=${assignment.modelId})`,
  )

  const status = await getAgentServerStatus()
  let port: number
  if (await isAgentServerRunning(settings.serverPort)) {
    // Dev mode: a locally running agent-server (e.g. tsx watch) takes precedence.
    port = settings.serverPort
  } else if (status.running && status.port) {
    port = status.port
  } else {
    port = await startAgentServer()
  }

  const client = createAgentServerClient(port)
  await client.configureProvider(provider.id, {
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    enabled: true,
  })

  const input = await collectCommitContext(cwd)

  try {
    const output = (await client.runAgent('coder', {
      task: 'commit-message',
      providerId: assignment.providerId,
      modelId: assignment.modelId,
      input,
    })) as { message?: string }

    if (!output.message) {
      void logger.error('[coder] generate commit message failed: empty output')
      throw new Error('run-failed')
    }
    void logger.info(
      `[coder] generate commit message succeeded in ${Date.now() - startedAt}ms (provider=${assignment.providerId}, model=${assignment.modelId})`,
    )
    return output.message
  } catch (error) {
    if (error instanceof Error && error.message === 'run-failed') {
      throw error
    }
    const reason = error instanceof Error ? error.message : 'run-failed'
    void logger.error(`[coder] generate commit message failed: ${reason}`)
    throw new Error(reason)
  }
}
