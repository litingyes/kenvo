import * as React from 'react'

import { api } from '@/lib/electron/api'

export type Platform = 'macos' | 'windows' | 'linux' | 'ios' | 'android' | 'unknown'

export function usePlatform() {
  const [platform, setPlatform] = React.useState<Platform>('unknown')

  React.useEffect(() => {
    api.os
      .getType()
      .then((type) => setPlatform(type as Platform))
      .catch(() => {
        // ignore
      })
  }, [])

  return platform
}

export function useIsMacOS() {
  const platform = usePlatform()
  return platform === 'macos'
}
