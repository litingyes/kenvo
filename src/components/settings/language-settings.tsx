import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
      <Select value={currentLanguage} onValueChange={(value) => value && void handleChange(value)}>
        <SelectTrigger id="language" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t('settings.language.description')}</p>
    </div>
  )
}
