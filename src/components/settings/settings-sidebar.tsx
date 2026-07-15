import { PaletteIcon } from 'lucide-react'

export function SettingsSidebar() {
  return (
    <aside className="flex w-56 flex-col border-r border-border bg-muted/30 p-4">
      <div className="mb-2 px-2 text-xs font-medium text-muted-foreground">Settings</div>
      <nav className="space-y-1">
        <button className="flex w-full items-center gap-2 rounded-md bg-accent px-2 py-1.5 text-sm font-medium text-accent-foreground">
          <PaletteIcon className="size-4" />
          Appearance
        </button>
      </nav>
    </aside>
  )
}
