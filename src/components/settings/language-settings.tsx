import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { SUPPORTED_LANGUAGES, changeLanguage, type SupportedLanguage } from '@/lib/i18n'

export function LanguageSettings() {
  const { t, i18n } = useTranslation()
  const currentLanguage = (i18n.resolvedLanguage ?? 'en') as SupportedLanguage

  const handleChange = async (value: string) => {
    const language = value as SupportedLanguage
    await changeLanguage(language)
  }

  return (
    <div className="space-y-3">
      <Label htmlFor="language">{t('settings.language.title')}</Label>
      <NativeSelect
        id="language"
        value={currentLanguage}
        onChange={(e) => handleChange(e.target.value)}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <NativeSelectOption key={lang.code} value={lang.code}>
            {lang.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <p className="text-xs text-muted-foreground">{t('settings.language.description')}</p>
    </div>
  )
}
