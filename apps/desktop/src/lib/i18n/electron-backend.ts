import type { BackendModule } from 'i18next'

import { api } from '@/lib/electron/api'

export const electronBackend: BackendModule = {
  type: 'backend',
  init: () => {},
  read: async (language, _namespace, callback) => {
    try {
      const text = await api.resources.readLocale(language)
      const data = JSON.parse(text) as Record<string, unknown>
      callback(null, data)
    } catch (error: unknown) {
      callback(error instanceof Error ? error.message : String(error), null)
    }
  },
}
