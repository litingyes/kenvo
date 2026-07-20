import { CheckIcon, SettingsIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTerminalStore } from '@/lib/store/terminal-store'
import type { GroupMode, SortMode } from '@/lib/terminal/types'

const GROUP_OPTIONS: { value: GroupMode }[] = [
  { value: 'none' },
  { value: 'time' },
  { value: 'path' },
]

const SORT_OPTIONS: { value: SortMode }[] = [{ value: 'updated' }, { value: 'created' }]

export function SessionGroupMenu() {
  const { t } = useTranslation()
  const groupMode = useTerminalStore((s) => s.groupMode)
  const sortMode = useTerminalStore((s) => s.sortMode)
  const setGroupMode = useTerminalStore((s) => s.setGroupMode)
  const setSortMode = useTerminalStore((s) => s.setSortMode)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`${t('terminal.groupBy')} / ${t('terminal.sortBy')}`}
          />
        }
      >
        <SettingsIcon className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('terminal.groupBy')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={groupMode}
            onValueChange={(v) => setGroupMode(v as GroupMode)}
          >
            {GROUP_OPTIONS.map((opt) => (
              <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                {t(`terminal.groupOptions.${opt.value}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('terminal.sortBy')}</DropdownMenuLabel>
          {SORT_OPTIONS.map((opt) => (
            <DropdownMenuItem key={opt.value} onClick={() => setSortMode(opt.value)}>
              <CheckIcon
                className={sortMode === opt.value ? 'size-3 opacity-100' : 'size-3 opacity-0'}
              />
              {t(`terminal.sortOptions.${opt.value}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
