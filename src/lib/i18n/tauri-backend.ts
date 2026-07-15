import { resolveResource } from '@tauri-apps/api/path'
import { readTextFile } from '@tauri-apps/plugin-fs'
import type { BackendModule } from 'i18next'

export const tauriBackend: BackendModule = {
  type: 'backend',
  init: () => {},
  read: async (language, _namespace, callback) => {
    try {
      const path = await resolveResource(`resources/locales/${language}.json`)
      const text = await readTextFile(path)
      const data = JSON.parse(text) as Record<string, unknown>
      callback(null, data)
    } catch (error: unknown) {
      callback(error instanceof Error ? error.message : String(error), null)
    }
  },
}
