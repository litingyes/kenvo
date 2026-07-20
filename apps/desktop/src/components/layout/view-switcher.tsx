import { useNavigate } from '@tanstack/react-router'
import { ChevronDownIcon, PanelLeftIcon, PanelRightIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { APP_VIEWS, useActiveView } from '@/lib/views'

interface ViewSwitcherProps {
  leftSidebarOpen?: boolean
  rightSidebarOpen?: boolean
  onToggleLeftSidebar?: () => void
  onToggleRightSidebar?: () => void
}

export function ViewSwitcher({
  leftSidebarOpen,
  rightSidebarOpen,
  onToggleLeftSidebar,
  onToggleRightSidebar,
}: ViewSwitcherProps) {
  const { t } = useTranslation()
  const activeView = useActiveView()
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)

  const handleViewChange = React.useCallback(
    (id: string) => {
      const view = APP_VIEWS.find((v) => v.id === id)
      if (view && view.id !== activeView.id) {
        void navigate({ to: view.route })
      }
      setOpen(false)
    },
    [activeView.id, navigate],
  )

  const ActiveIcon = activeView.icon

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1 px-2 text-xs font-medium [-webkit-app-region:no-drag]"
          />
        }
      >
        <ActiveIcon className="size-3.5" />
        <span>{t('terminal.title')}</span>
        <ChevronDownIcon className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        <DropdownMenuRadioGroup value={activeView.id} onValueChange={handleViewChange}>
          {APP_VIEWS.map((view) => (
            <DropdownMenuRadioItem key={view.id} value={view.id}>
              <view.icon className="size-3.5" />
              {t('terminal.title')}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        {(onToggleLeftSidebar || onToggleRightSidebar) && (
          <>
            <DropdownMenuSeparator />
            {onToggleLeftSidebar && (
              <DropdownMenuCheckboxItem
                checked={leftSidebarOpen}
                onCheckedChange={onToggleLeftSidebar}
              >
                <PanelLeftIcon className="size-3.5" />
                {t('terminal.leftSidebar')}
              </DropdownMenuCheckboxItem>
            )}
            {onToggleRightSidebar && (
              <DropdownMenuCheckboxItem
                checked={rightSidebarOpen}
                onCheckedChange={onToggleRightSidebar}
              >
                <PanelRightIcon className="size-3.5" />
                {t('terminal.rightSidebar')}
              </DropdownMenuCheckboxItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
