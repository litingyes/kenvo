import { Loader2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  const { t } = useTranslation()
  return (
    <output aria-label={t('ui.loading')}>
      <Loader2Icon
        data-slot="spinner"
        className={cn('size-4 animate-spin', className)}
        {...props}
      />
    </output>
  )
}

export { Spinner }
