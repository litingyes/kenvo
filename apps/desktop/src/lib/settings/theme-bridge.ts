import { useTheme } from 'next-themes'
import { useEffect } from 'react'

import { IPC_CHANNELS, invoke, listen } from '@/lib/electron/api'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeSettings {
  mode: ThemeMode
}

export function useThemeBridge() {
  const { setTheme } = useTheme()

  useEffect(() => {
    invoke<ThemeSettings>(IPC_CHANNELS.GET_THEME)
      .then((settings) => {
        setTheme(settings.mode)
      })
      .catch(console.error)

    const unlisten = listen<ThemeSettings>(IPC_CHANNELS.THEME_CHANGED, (event) => {
      setTheme(event.mode)
    })

    return () => {
      unlisten()
    }
  }, [setTheme])
}

export async function applyTheme(mode: ThemeMode) {
  await invoke(IPC_CHANNELS.SET_THEME, mode)
}
