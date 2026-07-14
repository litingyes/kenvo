import { CheckIcon, SettingsIcon } from 'lucide-react'

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

const GROUP_OPTIONS: { value: GroupMode; label: string }[] = [
  { value: 'none', label: 'No Group' },
  { value: 'time', label: 'Time' },
  { value: 'path', label: 'Path' },
]

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'updated', label: 'Updated Time' },
  { value: 'created', label: 'Created Time' },
]

export function SessionGroupMenu() {
  const groupMode = useTerminalStore((s) => s.groupMode)
  const sortMode = useTerminalStore((s) => s.sortMode)
  const setGroupMode = useTerminalStore((s) => s.setGroupMode)
  const setSortMode = useTerminalStore((s) => s.setSortMode)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="size-7" aria-label="Group & sort" />}
      >
        <SettingsIcon className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Group by</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={groupMode}
            onValueChange={(v) => setGroupMode(v as GroupMode)}
          >
            {GROUP_OPTIONS.map((opt) => (
              <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                {opt.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          {SORT_OPTIONS.map((opt) => (
            <DropdownMenuItem key={opt.value} onClick={() => setSortMode(opt.value)}>
              <CheckIcon
                className={sortMode === opt.value ? 'size-3 opacity-100' : 'size-3 opacity-0'}
              />
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
