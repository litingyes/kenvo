import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { IPC_CHANNELS, api, invoke } from '@/lib/electron/api'

import { electronBackend } from './electron-backend'

export const DEFAULT_LANGUAGE = 'en-US'

export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English' },
  { code: 'zh-CN', name: '简体中文' },
] as const

export const SUPPORTED_LANGUAGE_CODES: SupportedLanguage[] = SUPPORTED_LANGUAGES.map((l) => l.code)

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code']

export async function detectSystemLanguage(): Promise<SupportedLanguage> {
  const systemLocale = await api.os.getLocale().catch(() => DEFAULT_LANGUAGE)
  if (!systemLocale) return DEFAULT_LANGUAGE
  const normalized = systemLocale.toLowerCase().replace(/_/g, '-')
  if (normalized.startsWith('zh')) return 'zh-CN'
  return DEFAULT_LANGUAGE
}

export async function resolveInitialLanguage(): Promise<SupportedLanguage> {
  try {
    const persisted = await invoke<string>(IPC_CHANNELS.GET_LANGUAGE)
    if ((SUPPORTED_LANGUAGE_CODES as string[]).includes(persisted)) {
      return persisted as SupportedLanguage
    }
  } catch {
    // No persisted language yet, fall back to system detection.
  }
  return detectSystemLanguage()
}

export async function initializeI18n(): Promise<void> {
  const language = await resolveInitialLanguage()

  i18n.use(electronBackend).use(initReactI18next)

  return new Promise((resolve) => {
    void i18n.init(
      {
        lng: language,
        fallbackLng: DEFAULT_LANGUAGE,
        supportedLngs: SUPPORTED_LANGUAGE_CODES,
        ns: ['translation'],
        defaultNS: 'translation',
        interpolation: { escapeValue: false },
        react: { useSuspense: false },
      },
      () => resolve(),
    )
  })
}

export async function changeLanguage(language: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(language)
  try {
    await invoke(IPC_CHANNELS.SET_LANGUAGE, language)
  } catch {
    // Persist failed, but the UI language is already updated.
  }
}

export default i18n
