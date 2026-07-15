import { useNavigate } from '@tanstack/react-router'
import {
  ChevronDownIcon,
  MonitorIcon,
  MoonIcon,
  PanelLeftIcon,
  PanelRightIcon,
  SunIcon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
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
  const activeView = useActiveView()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
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

  const handleModeChange = React.useCallback(
    (mode: string) => {
      setTheme(mode)
      setOpen(false)
    },
    [setTheme],
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
        <span>{activeView.label}</span>
        <ChevronDownIcon className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        <DropdownMenuRadioGroup value={activeView.id} onValueChange={handleViewChange}>
          {APP_VIEWS.map((view) => (
            <DropdownMenuRadioItem key={view.id} value={view.id}>
              <view.icon className="size-3.5" />
              {view.label}
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
                Left sidebar
              </DropdownMenuCheckboxItem>
            )}
            {onToggleRightSidebar && (
              <DropdownMenuCheckboxItem
                checked={rightSidebarOpen}
                onCheckedChange={onToggleRightSidebar}
              >
                <PanelRightIcon className="size-3.5" />
                Right sidebar
              </DropdownMenuCheckboxItem>
            )}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={handleModeChange}>
            <DropdownMenuRadioItem value="light">
              <SunIcon className="size-3.5" />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <MoonIcon className="size-3.5" />
              Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <MonitorIcon className="size-3.5" />
              System
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
