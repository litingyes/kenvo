import AlibabaIcon from '@lobehub/icons/es/Alibaba'
import AnthropicIcon from '@lobehub/icons/es/Anthropic'
import DeepSeekIcon from '@lobehub/icons/es/DeepSeek'
import MoonshotIcon from '@lobehub/icons/es/Moonshot'
import OpenAIIcon from '@lobehub/icons/es/OpenAI'
import XAIIcon from '@lobehub/icons/es/XAI'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  createAgentServerClient,
  isAgentServerRunning,
  type ProviderMetadata,
} from '@/lib/ai/server-client'
import {
  getAgentServerStatus,
  getAiSettings,
  setAiSettings,
  startAgentServer,
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

export const Route = createFileRoute('/settings/ai/providers')({
  component: AiProvidersPage,
})

function AiProvidersPage() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [providers, setProviders] = useState<ProviderMetadata[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<ProviderMetadata | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  useEffect(() => {
    void init()
  }, [])

  async function init() {
    const settingsData = await getAiSettings()
    setSettings(settingsData)
    setLoading(true)
    setError(null)
    try {
      const port = await ensureServerRunning(settingsData.serverPort)
      await loadProviders(port)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setProviders([])
    } finally {
      setLoading(false)
    }
  }

  async function loadProviders(port: number) {
    const client = createAgentServerClient(port)
    const data = await client.getProviders()
    setProviders(data)
  }

  async function ensureServerRunning(preferredPort: number): Promise<number> {
    if (await isAgentServerRunning(preferredPort)) {
      return preferredPort
    }

    const statusData = await getAgentServerStatus()
    if (statusData.running && statusData.port) {
      if (await isAgentServerRunning(statusData.port)) {
        return statusData.port
      }
    }

    return startAgentServer()
  }

  async function handleConnect(provider: ProviderMetadata) {
    const existing = settings?.providers.find((p) => p.id === provider.id)
    setSelectedProvider(provider)
    setApiKey(existing?.apiKey ?? '')
    setBaseUrl(existing?.baseUrl ?? '')
    setTestResult(null)
  }

  async function handleSaveConnection() {
    if (!selectedProvider || !settings) return

    setLoading(true)
    try {
      const port = await ensureServerRunning(settings.serverPort)
      const client = createAgentServerClient(port)
      await client.configureProvider(selectedProvider.id, {
        apiKey,
        baseUrl: baseUrl || undefined,
        enabled: true,
      })

      const updatedSettings = {
        ...settings,
        providers: [
          ...settings.providers.filter((p) => p.id !== selectedProvider.id),
          { id: selectedProvider.id, apiKey, baseUrl: baseUrl || undefined, enabled: true },
        ],
      }
      await setAiSettings(updatedSettings)
      setSettings(updatedSettings)
      setSelectedProvider(null)
      await loadProviders(port)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect(provider: ProviderMetadata) {
    if (!settings) return

    setLoading(true)
    try {
      const port = await ensureServerRunning(settings.serverPort)
      const client = createAgentServerClient(port)
      await client.configureProvider(provider.id, {
        apiKey: undefined,
        baseUrl: undefined,
        enabled: false,
      })

      const updatedSettings = {
        ...settings,
        providers: settings.providers.filter((p) => p.id !== provider.id),
      }
      await setAiSettings(updatedSettings)
      setSettings(updatedSettings)
      await loadProviders(port)
    } finally {
      setLoading(false)
    }
  }

  async function handleTest(provider: ProviderMetadata) {
    if (!settings) return

    setLoading(true)
    try {
      const port = await ensureServerRunning(settings.serverPort)
      const client = createAgentServerClient(port)
      const existing = settings.providers.find((p) => p.id === provider.id)
      if (existing) {
        await client.configureProvider(provider.id, {
          apiKey: existing.apiKey,
          baseUrl: existing.baseUrl,
          enabled: existing.enabled,
        })
      }
      const result = await client.testProvider(provider.id)
      setTestResult(result)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleEnabled(provider: ProviderMetadata, enabled: boolean) {
    if (!settings) return

    const existing = settings.providers.find((p) => p.id === provider.id)
    const updatedSettings = {
      ...settings,
      providers: [
        ...settings.providers.filter((p) => p.id !== provider.id),
        { id: provider.id, apiKey: existing?.apiKey, baseUrl: existing?.baseUrl, enabled },
      ],
    }
    await setAiSettings(updatedSettings)
    setSettings(updatedSettings)
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl space-y-4">
          {loading && <div className="text-sm text-muted-foreground">{t('ui.loading')}...</div>}
          {error && (
            <div className="space-y-2">
              <div className="text-sm text-red-600">{error}</div>
              <Button variant="outline" size="sm" onClick={() => init()}>
                {t('ui.retry')}
              </Button>
            </div>
          )}
          {!loading && !error && providers.length === 0 && (
            <div className="text-sm text-muted-foreground">
              {t('settings.aiCapabilities.providers.empty')}
            </div>
          )}
          {providers.map((provider) => {
            const Icon = ICONS[provider.iconKey]
            const connected = Boolean(settings?.providers.find((p) => p.id === provider.id)?.apiKey)
            const enabled = settings?.providers.find((p) => p.id === provider.id)?.enabled ?? false

            return (
              <div
                key={provider.id}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div className="flex items-center gap-3">
                  {Icon && <Icon size={24} />}
                  <div>
                    <div className="font-medium">{provider.name}</div>
                    <div className="text-sm text-muted-foreground">{provider.description}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => handleToggleEnabled(provider, checked)}
                    disabled={!connected}
                  />
                  {connected ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(provider)}
                        disabled={loading}
                      >
                        {t('settings.aiCapabilities.providers.test')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleConnect(provider)}>
                        {t('settings.aiCapabilities.providers.edit')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDisconnect(provider)}
                      >
                        {t('settings.aiCapabilities.providers.disconnect')}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => handleConnect(provider)} disabled={loading}>
                      {t('settings.aiCapabilities.providers.connect')}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Dialog open={Boolean(selectedProvider)} onOpenChange={() => setSelectedProvider(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedProvider?.name} {t('settings.aiCapabilities.providers.connection')}
            </DialogTitle>
            <DialogDescription>
              {t('settings.aiCapabilities.providers.connectionDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">{t('settings.aiCapabilities.providers.apiKey')}</Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t('settings.aiCapabilities.providers.apiKeyPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="base-url">{t('settings.aiCapabilities.providers.baseUrl')}</Label>
              <Input
                id="base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={selectedProvider?.defaultBaseUrl}
              />
            </div>
            {testResult && (
              <div className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.success
                  ? t('settings.aiCapabilities.providers.testSuccess')
                  : testResult.error || t('settings.aiCapabilities.providers.testFailed')}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProvider(null)}>
              {t('settings.aiCapabilities.providers.cancel')}
            </Button>
            <Button
              onClick={() => selectedProvider && handleTest(selectedProvider)}
              disabled={loading}
            >
              {t('settings.aiCapabilities.providers.test')}
            </Button>
            <Button onClick={handleSaveConnection} disabled={loading}>
              {t('settings.aiCapabilities.providers.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
