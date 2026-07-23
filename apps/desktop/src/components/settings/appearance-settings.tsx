import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { applyTheme, type ThemeMode } from '@/lib/settings/theme-bridge'

const MODES: { value: ThemeMode; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'light', icon: SunIcon },
  { value: 'dark', icon: MoonIcon },
  { value: 'system', icon: MonitorIcon },
]

export function AppearanceSettings() {
  const { t } = useTranslation()
  const { theme: currentMode } = useTheme()

  const [mode, setMode] = React.useState<ThemeMode>((currentMode as ThemeMode) ?? 'dark')

  React.useEffect(() => {
    if (currentMode) setMode(currentMode as ThemeMode)
  }, [currentMode])

  const handleModeChange = (value: string) => {
    const next = value as ThemeMode
    setMode(next)
    void applyTheme(next)
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
    </div>
  )
}
