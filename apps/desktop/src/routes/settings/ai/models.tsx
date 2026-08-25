import AlibabaIcon from '@lobehub/icons/es/Alibaba'
import AnthropicIcon from '@lobehub/icons/es/Anthropic'
import DeepSeekIcon from '@lobehub/icons/es/DeepSeek'
import MoonshotIcon from '@lobehub/icons/es/Moonshot'
import OpenAIIcon from '@lobehub/icons/es/OpenAI'
import XAIIcon from '@lobehub/icons/es/XAI'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Switch } from '@/components/ui/switch'
import {
  createAgentServerClient,
  type ModelMetadata,
  type ProviderMetadata,
} from '@/lib/ai/server-client'
import {
  getAgentServerStatus,
  getAiSettings,
  setAiSettings,
  toggleModelEnabled,
  type AiSettings,
} from '@/lib/ai/settings-bridge'

const ICONS: Record<string, React.ComponentType<{ size?: number | string }>> = {
  OpenAI: OpenAIIcon,
  Anthropic: AnthropicIcon,
  DeepSeek: DeepSeekIcon,
  Moonshot: MoonshotIcon,
  Alibaba: AlibabaIcon,
  XAI: XAIIcon,
}

export const Route = createFileRoute('/settings/ai/models')({
  component: AiModelsPage,
})

function AiModelsPage() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [providerModels, setProviderModels] = useState<Record<string, ModelMetadata[]>>({})
  const [providers, setProviders] = useState<ProviderMetadata[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void init()
  }, [])

  async function init() {
    const settingsData = await getAiSettings()
    setSettings(settingsData)
    await loadStatus(settingsData)
  }

  async function loadStatus(settingsData: AiSettings) {
    const statusData = await getAgentServerStatus()
    const port = statusData.running && statusData.port ? statusData.port : settingsData.serverPort
    await loadModels(port, settingsData)
  }

  async function loadModels(port: number, settingsData: AiSettings) {
    setLoading(true)
    try {
      const client = createAgentServerClient(port)
      const providerList = await client.getProviders()
      setProviders(providerList)

      const models: Record<string, ModelMetadata[]> = {}
      for (const provider of providerList) {
        const existing = settingsData.providers.find((p) => p.id === provider.id)
        if (existing?.apiKey) {
          await client.configureProvider(provider.id, {
            apiKey: existing.apiKey,
            baseUrl: existing.baseUrl,
            enabled: existing.enabled,
          })
          models[provider.id] = await client.getModels(provider.id)
        }
      }
      setProviderModels(models)
    } catch {
      setProviderModels({})
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleModel(providerId: string, modelId: string) {
    if (!settings) return

    const updated = toggleModelEnabled(settings, providerId, modelId)
    await setAiSettings(updated)
    setSettings(updated)
  }

  const groupedModels = useMemo(() => {
    return providers
      .filter((p) => providerModels[p.id]?.length > 0)
      .map((provider) => ({
        provider,
        models: providerModels[provider.id] || [],
      }))
  }, [providers, providerModels])

  return (
    <>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl space-y-8">
          {groupedModels.length === 0 && !loading && (
            <div className="text-sm text-muted-foreground">
              {t('settings.aiCapabilities.models.empty')}
            </div>
          )}

          {groupedModels.map(({ provider, models }) => {
            const Icon = ICONS[provider.iconKey]

            return (
              <div key={provider.id} className="space-y-3">
                <div className="flex items-center gap-2 font-medium">
                  {Icon && <Icon size={18} />}
                  {provider.name}
                </div>
                <div className="space-y-1 rounded-lg border border-border">
                  {models.map((model) => {
                    const enabled =
                      settings?.enabledModels[provider.id]?.includes(model.id) ?? false

                    return (
                      <div
                        key={model.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-mono text-sm">{model.id}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {[
                              model.contextWindow
                                ? `${Math.round(model.contextWindow / 1000)}k ctx`
                                : null,
                              model.reasoning ? 'reasoning' : null,
                              model.input.includes('image') ? 'vision' : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </div>
                        <Switch
                          checked={enabled}
                          onCheckedChange={() => handleToggleModel(provider.id, model.id)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
