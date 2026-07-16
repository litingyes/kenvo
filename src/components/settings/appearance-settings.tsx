import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { applyTheme, type ThemeMode } from '@/lib/settings/theme-bridge'
import { type ThemePreset, useThemeStore } from '@/lib/store/theme-store'

const MODES: { value: ThemeMode; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'light', icon: SunIcon },
  { value: 'dark', icon: MoonIcon },
  { value: 'system', icon: MonitorIcon },
]

const PRESETS: { value: ThemePreset }[] = [
  { value: 'terminal' },
  { value: 'ocean' },
  { value: 'midnight' },
]

export function AppearanceSettings() {
  const { t } = useTranslation()
  const { theme: currentMode } = useTheme()
  const { themePreset } = useThemeStore()

  const [mode, setMode] = React.useState<ThemeMode>((currentMode as ThemeMode) ?? 'dark')
  const [preset, setPreset] = React.useState<ThemePreset>(themePreset)

  React.useEffect(() => {
    if (currentMode) setMode(currentMode as ThemeMode)
  }, [currentMode])

  React.useEffect(() => {
    setPreset(themePreset)
  }, [themePreset])

  const handleModeChange = (value: string) => {
    const next = value as ThemeMode
    setMode(next)
    void applyTheme(next, preset)
  }

  const handlePresetChange = (value: string) => {
    const next = value as ThemePreset
    setPreset(next)
    void applyTheme(mode, next)
  }

  return (
    <div className="max-w-xl space-y-8">
      <div className="space-y-3">
        <Label>{t('settings.appearance.theme')}</Label>
        <RadioGroup value={mode} onValueChange={handleModeChange}>
          <div className="flex gap-3">
            {MODES.map((m) => {
              const Icon = m.icon
              return (
                <label
                  key={m.value}
                  className="flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-lg border border-border p-4 transition-colors hover:bg-accent/50 has-[[data-checked]]:border-primary has-[[data-checked]]:bg-accent"
                >
                  <RadioGroupItem value={m.value} />
                  <Icon className="size-5 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {t(`settings.appearance.modes.${m.value}`)}
                  </span>
                </label>
              )
            })}
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-3">
        <Label htmlFor="theme-preset">{t('settings.appearance.themePreset')}</Label>
        <Select value={preset} onValueChange={(value) => value && handlePresetChange(value)}>
          <SelectTrigger id="theme-preset" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {t(`settings.appearance.presets.${p.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
