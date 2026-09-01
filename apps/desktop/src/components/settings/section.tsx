import { cn } from '@/lib/utils'

interface SettingsRowProps {
  label: string
  description?: string
  htmlFor?: string
  className?: string
  children: React.ReactNode
}

export function SettingsRow({
  label,
  description,
  htmlFor,
  className,
  children,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-4 py-3.5',
        '[&:not(:last-child)]:border-b [&:not(:last-child)]:border-border',
        className,
      )}
    >
      <div className="space-y-0.5">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  )
}
