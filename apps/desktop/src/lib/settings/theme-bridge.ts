import { useTheme } from 'next-themes'
import { useEffect } from 'react'

import { IPC_CHANNELS, invoke, listen } from '@/lib/electron/api'
import { useThemeStore, isThemePreset, type ThemePreset } from '@/lib/store/theme-store'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeSettings {
  mode: ThemeMode
  preset: ThemePreset
}

export function useThemeBridge() {
  const { setTheme } = useTheme()
  const { setThemePreset } = useThemeStore()

  useEffect(() => {
    invoke<ThemeSettings>(IPC_CHANNELS.GET_THEME)
      .then((settings) => {
        const safePreset = isThemePreset(settings.preset) ? settings.preset : 'kenvo'
        setTheme(settings.mode)
        setThemePreset(safePreset)
      })
      .catch(console.error)

    const unlisten = listen<ThemeSettings>(IPC_CHANNELS.THEME_CHANGED, (event) => {
      const safePreset = isThemePreset(event.preset) ? event.preset : 'kenvo'
      setTheme(event.mode)
      setThemePreset(safePreset)
    })

    return () => {
      unlisten()
    }
  }, [setTheme, setThemePreset])
}

export async function applyTheme(mode: ThemeMode, preset: ThemePreset) {
  await invoke(IPC_CHANNELS.SET_THEME, mode, preset)
}
