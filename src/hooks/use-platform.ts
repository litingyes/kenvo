import { type } from '@tauri-apps/plugin-os'
import * as React from 'react'

export type Platform = 'macos' | 'windows' | 'linux' | 'ios' | 'android' | 'unknown'

export function usePlatform() {
  const [platform, setPlatform] = React.useState<Platform>('unknown')

  React.useEffect(() => {
    try {
      setPlatform(type() as Platform)
    } catch {
      // ignore
    }
  }, [])

  return platform
}

export function useIsMacOS() {
  const platform = usePlatform()
  return platform === 'macos'
}
