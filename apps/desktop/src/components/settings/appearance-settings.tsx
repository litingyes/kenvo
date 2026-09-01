import { useTheme } from 'next-themes'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { SettingsRow } from '@/components/settings/section'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SUPPORTED_LANGUAGES, changeLanguage, type SupportedLanguage } from '@/lib/i18n'
import { applyTheme, type ThemeMode } from '@/lib/settings/theme-bridge'

const THEME_OPTIONS: ThemeMode[] = ['light', 'dark', 'system']

export function AppearanceSettings() {
  const { t } = useTranslation()
  const { theme: currentMode } = useTheme()
  const { i18n } = useTranslation()

  const [mode, setMode] = React.useState<ThemeMode>((currentMode as ThemeMode) ?? 'dark')

  React.useEffect(() => {
    if (currentMode) setMode(currentMode as ThemeMode)
  }, [currentMode])

  const handleModeChange = (value: string) => {
    const next = value as ThemeMode
    setMode(next)
    void applyTheme(next)
  }

  const currentLanguage = (i18n.resolvedLanguage ?? 'en-US') as SupportedLanguage
  const currentLanguageName =
    SUPPORTED_LANGUAGES.find((lang) => lang.code === currentLanguage)?.name ?? currentLanguage

  const handleLanguageChange = async (value: string) => {
    await changeLanguage(value as SupportedLanguage)
  }

  return (
    <div className="max-w-xl overflow-hidden rounded-xl border border-border">
      <SettingsRow label={t('settings.appearance.theme')} htmlFor="theme">
        <Select value={mode} onValueChange={(value) => value && handleModeChange(value)}>
          <SelectTrigger id="theme" className="w-40">
            <SelectValue>{t(`settings.appearance.modes.${mode}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {THEME_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`settings.appearance.modes.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>

      <SettingsRow
        label={t('settings.appearance.language')}
        description={t('settings.appearance.languageDescription')}
        htmlFor="language"
      >
        <Select
          value={currentLanguage}
          onValueChange={(value) => value && void handleLanguageChange(value)}
        >
          <SelectTrigger id="language" className="w-40">
            <SelectValue>{currentLanguageName}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>
    </div>
  )
}
