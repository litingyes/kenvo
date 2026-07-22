import * as React from 'react'

import { useIsMacOS } from '@/hooks/use-platform'
import { api } from '@/lib/electron/api'

const DEFAULT_TRAFFIC_LIGHT_INSET = 84

export function useTrafficLightInset(): number {
  const isMacOS = useIsMacOS()
  const [inset, setInset] = React.useState(DEFAULT_TRAFFIC_LIGHT_INSET)

  React.useEffect(() => {
    if (!isMacOS) return

    api.window
      .getTrafficLightInset()
      .then((data) => setInset(data.paddingLeft))
      .catch(() => {
        // ignore
      })
  }, [isMacOS])

  return isMacOS ? inset : 0
}
