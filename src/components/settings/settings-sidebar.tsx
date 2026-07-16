import { Link, useLocation } from '@tanstack/react-router'
import {
  BrainCircuitIcon,
  CpuIcon,
  GlobeIcon,
  InfoIcon,
  PaletteIcon,
  ServerIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface NavItemProps {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

function NavItem({ to, icon: Icon, label }: NavItemProps) {
  const { pathname } = useLocation()
  const active = pathname === to || pathname.startsWith(`${to}/`)

  return (
    <Link
      to={to}
      className={
        active
          ? 'flex w-full items-center gap-2 rounded-md bg-accent px-2 py-1.5 text-sm font-medium text-accent-foreground'
          : 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground'
      }
    >
      <Icon className="size-4" />
      {label}
    </Link>
  )
}

export function SettingsSidebar() {
  const { t } = useTranslation()

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-muted/30 p-4">
      <div className="mb-2 px-2 text-xs font-medium text-muted-foreground">
        {t('settings.title')}
      </div>
      <nav className="space-y-1">
        <NavItem
          to="/settings/appearance"
          icon={PaletteIcon}
          label={t('settings.appearance.title')}
        />
        <NavItem to="/settings/language" icon={GlobeIcon} label={t('settings.language.title')} />
        <NavItem to="/settings/about" icon={InfoIcon} label={t('settings.about.title')} />
      </nav>

      <div className="mt-6 mb-2 px-2 text-xs font-medium text-muted-foreground">
        {t('settings.aiCapabilities.title')}
      </div>
      <nav className="space-y-1">
        <NavItem
          to="/settings/ai/basic"
          icon={ServerIcon}
          label={t('settings.aiCapabilities.basic.title')}
        />
        <NavItem
          to="/settings/ai/providers"
          icon={BrainCircuitIcon}
          label={t('settings.aiCapabilities.providers.title')}
        />
        <NavItem
          to="/settings/ai/models"
          icon={CpuIcon}
          label={t('settings.aiCapabilities.models.title')}
        />
      </nav>
    </aside>
  )
}
