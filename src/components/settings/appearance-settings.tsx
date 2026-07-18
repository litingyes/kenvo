import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { applyTheme, type ThemeMode } from '@/lib/settings/theme-bridge'
import { type ThemePreset, useThemeStore } from '@/lib/store/theme-store'

const MODES: { value: ThemeMode; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'light', icon: SunIcon },
  { value: 'dark', icon: MoonIcon },
  { value: 'system', icon: MonitorIcon },
]

const PRESETS: { value: ThemePreset }[] = [
  { value: 'kenvo' },
  { value: 'ayu' },
  { value: 'catppuccin' },
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
                  <RadioGroupItem value={m.value} className="sr-only" />
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
        <Label>{t('settings.appearance.themePreset')}</Label>
        <RadioGroup value={preset} onValueChange={handlePresetChange}>
          <div className="grid grid-cols-3 gap-3">
            {PRESETS.map((p) => (
              <label
                key={p.value}
                className="flex cursor-pointer flex-col gap-2 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50 has-[[data-checked]]:border-primary has-[[data-checked]]:bg-accent"
              >
                <RadioGroupItem value={p.value} className="sr-only" />
                <div
                  data-theme={p.value}
                  className="h-24 w-full rounded-md border border-border bg-background p-2"
                >
                  <div className="mb-2 h-2 w-1/3 rounded bg-primary" />
                  <div className="space-y-1.5">
                    <div className="h-1.5 w-full rounded bg-primary/20" />
                    <div className="h-1.5 w-4/5 rounded bg-primary/20" />
                  </div>
                  <div className="mt-2 h-5 w-12 rounded bg-primary" />
                </div>
                <span className="text-center text-sm font-medium">
                  {t(`settings.appearance.presets.${p.value}`)}
                </span>
              </label>
            ))}
          </div>
        </RadioGroup>
      </div>
    </div>
  )
}
