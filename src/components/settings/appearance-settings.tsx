import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'

import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { applyTheme, type ThemeMode } from '@/lib/settings/theme-bridge'
import { type ThemePreset, useThemeStore } from '@/lib/store/theme-store'

const MODES: {
  value: ThemeMode
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: MonitorIcon },
]

const PRESETS: { value: ThemePreset; label: string }[] = [
  { value: 'terminal', label: 'Terminal' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'midnight', label: 'Midnight' },
]

export function AppearanceSettings() {
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
        <Label>Theme</Label>
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
                  <span className="text-sm font-medium">{m.label}</span>
                </label>
              )
            })}
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-3">
        <Label htmlFor="theme-preset">Theme preset</Label>
        <NativeSelect
          id="theme-preset"
          value={preset}
          onChange={(e) => handlePresetChange(e.target.value)}
        >
          {PRESETS.map((p) => (
            <NativeSelectOption key={p.value} value={p.value}>
              {p.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </div>
  )
}
