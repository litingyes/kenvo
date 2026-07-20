import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { openAppFolder } from '@/lib/app-paths'
import { api } from '@/lib/electron/api'
import { logger } from '@/lib/logger'
import { checkForUpdate } from '@/lib/updater'

export function AboutSettings() {
  const { t } = useTranslation()
  const [version, setVersion] = useState('')
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    void api.app.getVersion().then(setVersion)
  }, [])

  const handleCheck = async () => {
    setChecking(true)
    try {
      await checkForUpdate()
    } finally {
      setChecking(false)
    }
  }

  const handleOpenFolder = async (kind: 'log' | 'data') => {
    try {
      await openAppFolder(kind)
    } catch (error) {
      void logger.error(
        `[settings] ${t('settings.about.openFolderFailed')}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return (
    <div className="space-y-3">
      <Label>{t('settings.about.title')}</Label>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {t('settings.about.version')}: {version}
        </span>
        <Button variant="outline" size="sm" disabled={checking} onClick={() => void handleCheck()}>
          {checking ? t('settings.about.checking') : t('settings.about.checkForUpdates')}
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => void handleOpenFolder('log')}>
          {t('settings.about.openLogFolder')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleOpenFolder('data')}>
          {t('settings.about.openDataFolder')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('settings.about.description')}</p>
    </div>
  )
}
