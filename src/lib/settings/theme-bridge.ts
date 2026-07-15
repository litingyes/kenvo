import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useTheme } from 'next-themes'
import { useEffect } from 'react'

import { useThemeStore, type ThemePreset } from '@/lib/store/theme-store'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeSettings {
  mode: ThemeMode
  preset: ThemePreset
}

export function useThemeBridge() {
  const { setTheme } = useTheme()
  const { setThemePreset } = useThemeStore()

  useEffect(() => {
    invoke<ThemeSettings>('get_theme')
      .then((settings) => {
        setTheme(settings.mode)
        setThemePreset(settings.preset)
      })
      .catch(console.error)

    const unlisten = listen<ThemeSettings>('theme-changed', (event) => {
      setTheme(event.payload.mode)
      setThemePreset(event.payload.preset)
    })

    return () => {
      void unlisten.then((fn) => fn())
    }
  }, [setTheme, setThemePreset])
}

export async function applyTheme(mode: ThemeMode, preset: ThemePreset) {
  await invoke('set_theme', { mode, preset })
}
