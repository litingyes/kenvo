import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { isAgentServerRunning } from '@/lib/ai/server-client'
import {
  getAgentServerStatus,
  getAiSettings,
  setAiSettings,
  startAgentServer,
  stopAgentServer,
  type AiSettings,
  type AgentServerStatus,
} from '@/lib/ai/settings-bridge'

export const Route = createFileRoute('/settings/ai/basic')({
  component: AiBasicPage,
})

function AiBasicPage() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [status, setStatus] = useState<AgentServerStatus | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void init()
  }, [])

  async function init() {
    const data = await loadSettings()
    await loadStatus(data.serverPort)
  }

  async function loadSettings() {
    const data = await getAiSettings()
    setSettings(data)
    return data
  }

  async function loadStatus(preferredPort: number) {
    const statusData = await getAgentServerStatus()
    const port = statusData.port ?? preferredPort
    if (await isAgentServerRunning(port)) {
      setStatus({ running: true, port })
    } else {
      setStatus(statusData)
    }
  }

  async function handleSave(updated: AiSettings) {
    setLoading(true)
    try {
      await setAiSettings(updated)
      setSettings(updated)
      await loadStatus(updated.serverPort)
    } finally {
      setLoading(false)
    }
  }

  async function handleStart() {
    if (!settings) return
    setLoading(true)
    try {
      await startAgentServer()
      await loadStatus(settings.serverPort)
    } finally {
      setLoading(false)
    }
  }

  async function handleStop() {
    if (!settings) return
    setLoading(true)
    try {
      await stopAgentServer()
      await loadStatus(settings.serverPort)
    } finally {
      setLoading(false)
    }
  }

  if (!settings) {
    return <div className="p-8">{t('ui.loading')}...</div>
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-xl space-y-8">
          <div className="space-y-3">
            <Label htmlFor="server-port">{t('settings.aiCapabilities.basic.serverPort')}</Label>
            <Input
              id="server-port"
              type="number"
              value={settings.serverPort}
              onChange={(e) => {
                const port = Number(e.target.value)
                if (!Number.isNaN(port)) {
                  void handleSave({ ...settings, serverPort: port })
                }
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-start">{t('settings.aiCapabilities.basic.autoStart')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.aiCapabilities.basic.autoStartDescription')}
              </p>
            </div>
            <Switch
              id="auto-start"
              checked={settings.serverAutoStart}
              onCheckedChange={(checked) => {
                void handleSave({ ...settings, serverAutoStart: checked })
              }}
            />
          </div>

          <div className="space-y-3">
            <Label>{t('settings.aiCapabilities.basic.status')}</Label>
            <div className="flex items-center gap-4">
              <div className="text-sm">
                {status?.running
                  ? t('settings.aiCapabilities.basic.running', { port: status.port })
                  : t('settings.aiCapabilities.basic.stopped')}
              </div>
              <Button
                variant={status?.running ? 'destructive' : 'default'}
                onClick={status?.running ? handleStop : handleStart}
                disabled={loading}
              >
                {status?.running
                  ? t('settings.aiCapabilities.basic.stop')
                  : t('settings.aiCapabilities.basic.start')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
