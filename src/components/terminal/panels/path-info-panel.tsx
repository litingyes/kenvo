import { FolderIcon, FileIcon, LinkIcon, LockIcon } from 'lucide-react'

import { useTerminalStore } from '@/lib/store/terminal-store'

import { formatBytes, formatDate, formatMode, getParentDirs, usePathInfo } from './use-path-info'

export function PathInfoPanel({ cwd }: { cwd: string }) {
  const { info, loading, error } = usePathInfo(cwd)
  const refreshSessions = useTerminalStore((s) => s.refreshSessions)

  const parents = getParentDirs(cwd)

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section>
        <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">Current Path</h3>
        <p className="font-mono text-xs break-all text-foreground">{cwd}</p>
      </section>

      <section>
        <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">Parent Directories</h3>
        <div className="flex flex-col gap-0.5">
          {parents.map((dir) => (
            <button
              key={dir.path}
              onClick={() => {
                void refreshSessions()
              }}
              className="truncate rounded px-1.5 py-0.5 text-left font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              title={dir.path}
            >
              {dir.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">Details</h3>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : info ? (
          <dl className="flex flex-col gap-1 text-xs">
            <Row label="Type" value={getTypeLabel(info)} />
            <Row label="Size" value={formatBytes(info.size)} />
            <Row label="Modified" value={formatDate(info.mtime)} />
            <Row label="Mode" value={formatMode(info.mode)} />
            <Row
              label="Read-only"
              value={
                <span className="flex items-center gap-1">
                  {info.readonly && <LockIcon className="size-3" />}
                  {info.readonly ? 'Yes' : 'No'}
                </span>
              }
            />
          </dl>
        ) : null}
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  )
}

function getTypeLabel(info: {
  isFile: boolean
  isDirectory: boolean
  isSymlink: boolean
}): React.ReactNode {
  if (info.isDirectory)
    return (
      <span className="flex items-center gap-1">
        <FolderIcon className="size-3" />
        Directory
      </span>
    )
  if (info.isSymlink)
    return (
      <span className="flex items-center gap-1">
        <LinkIcon className="size-3" />
        Symlink
      </span>
    )
  if (info.isFile)
    return (
      <span className="flex items-center gap-1">
        <FileIcon className="size-3" />
        File
      </span>
    )
  return 'Unknown'
}
