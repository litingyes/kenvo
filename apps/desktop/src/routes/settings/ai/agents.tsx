import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createAgentServerClient, type ProviderMetadata } from '@/lib/ai/server-client'
import {
  getAgentServerStatus,
  getAiSettings,
  resolveAgentModel,
  setAgentModel,
  setAiSettings,
  type AiSettings,
} from '@/lib/ai/settings-bridge'

const AUTO_VALUE = 'auto'

const BUILT_IN_AGENTS: { id: string; name: string }[] = [
  { id: 'writer', name: 'Writer' },
  { id: 'novelist', name: 'Novelist' },
  { id: 'screenwriter', name: 'Screenwriter' },
  { id: 'prompt-engineer', name: 'Prompt Engineer' },
]

export const Route = createFileRoute('/settings/ai/agents')({
  component: AiAgentsPage,
})

function encodeAssignment(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`
}

function decodeAssignment(value: string): { providerId: string; modelId: string } | null {
  const index = value.indexOf('::')
  if (index <= 0) return null
  return { providerId: value.slice(0, index), modelId: value.slice(index + 2) }
}

function AiAgentsPage() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [providers, setProviders] = useState<ProviderMetadata[]>([])

  useEffect(() => {
    void init()
  }, [])

  async function init() {
    const settingsData = await getAiSettings()
    setSettings(settingsData)

    const status = await getAgentServerStatus()
    const port = status.running && status.port ? status.port : null
    if (!port) return
    try {
      const client = createAgentServerClient(port)
      setProviders(await client.getProviders())
    } catch {
      // Server metadata is cosmetic here; fall back to provider ids.
    }
  }

  const providerNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const provider of providers) {
      names[provider.id] = provider.name
    }
    return names
  }, [providers])

  const enabledGroups = useMemo(() => {
    if (!settings) return []
    return Object.entries(settings.enabledModels)
      .filter(([, models]) => models.length > 0)
      .map(([providerId, models]) => ({ providerId, models }))
  }, [settings])

  async function handleModelChange(agentId: string, value: string) {
    if (!settings) return
    const assignment = value === AUTO_VALUE ? null : decodeAssignment(value)
    const updated = setAgentModel(settings, agentId, assignment)
    await setAiSettings(updated)
    setSettings(updated)
  }

  if (!settings) return null

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl space-y-8">
        <p className="text-sm text-muted-foreground">
          {t('settings.aiCapabilities.agents.description')}
        </p>

        {enabledGroups.length === 0 && (
          <div className="text-sm text-muted-foreground">
            {t('settings.aiCapabilities.agents.noModel')}
          </div>
        )}

        {BUILT_IN_AGENTS.map((agent) => {
          const assigned = settings.agentModels[agent.id]
          const value = assigned
            ? encodeAssignment(assigned.providerId, assigned.modelId)
            : AUTO_VALUE
          const fallback = resolveAgentModel(settings, agent.id)

          return (
            <div key={agent.id} className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    {agent.name}
                    <Badge variant="secondary">{agent.id}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t(`settings.aiCapabilities.agents.${agent.id}.description`, {
                      defaultValue: '',
                    })}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Select
                    value={value}
                    onValueChange={(next) => next && void handleModelChange(agent.id, next)}
                    disabled={enabledGroups.length === 0}
                  >
                    <SelectTrigger size="sm" aria-label={t('settings.aiCapabilities.agents.model')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={AUTO_VALUE}>
                          {t('settings.aiCapabilities.agents.auto')}
                        </SelectItem>
                      </SelectGroup>
                      {enabledGroups.map(({ providerId, models }) => (
                        <SelectGroup key={providerId}>
                          <SelectLabel>{providerNames[providerId] ?? providerId}</SelectLabel>
                          {models.map((modelId) => (
                            <SelectItem key={modelId} value={encodeAssignment(providerId, modelId)}>
                              {modelId}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  {!assigned && fallback && (
                    <span className="text-[10px] text-muted-foreground">
                      {t('settings.aiCapabilities.agents.autoHint', {
                        model: `${providerNames[fallback.providerId] ?? fallback.providerId} / ${fallback.modelId}`,
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
