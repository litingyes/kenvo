import { useNavigate } from '@tanstack/react-router'
import {
  CopyIcon,
  FileIcon,
  ExternalLinkIcon,
  FolderIcon,
  FolderOpenIcon,
  LinkIcon,
  LockIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useTerminalStore } from '@/lib/store/terminal-store'
import { copyToClipboard, openInEditor, revealInFinder } from '@/lib/terminal/opener-helpers'

import { formatBytes, formatDate, formatMode, getParentDirs, usePathInfo } from './use-path-info'

export function PathInfoPanel({ cwd }: { cwd: string }) {
  const { info, loading, error } = usePathInfo(cwd)
  const activeId = useTerminalStore((s) => s.activeId)
  const updateSessionCwd = useTerminalStore((s) => s.updateSessionCwd)
  const refreshSessions = useTerminalStore((s) => s.refreshSessions)
  const navigate = useNavigate()

  const parents = getParentDirs(cwd)

  const handleSwitchCwd = async (path: string) => {
    if (!activeId) return
    await updateSessionCwd(activeId, path)
    await refreshSessions()
    void navigate({ to: '/terminal/$sessionId', params: { sessionId: activeId } })
  }

  const handleCopy = async () => {
    try {
      await copyToClipboard(cwd)
      toast.success('Path copied to clipboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to copy path')
    }
  }

  const handleReveal = async () => {
    try {
      await revealInFinder(cwd)
      toast.success('Revealed in Finder')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reveal in Finder')
    }
  }

  const handleOpenInEditor = async () => {
    try {
      await openInEditor(cwd, 'code')
      toast.success('Opened in VS Code')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open VS Code')
    }
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section>
        <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">Current Path</h3>
        <p className="mb-2 font-mono text-xs break-all text-foreground">{cwd}</p>
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" size="xs" onClick={handleCopy}>
            <CopyIcon /> Copy
          </Button>
          <Button variant="outline" size="xs" onClick={handleReveal}>
            <FolderOpenIcon /> Reveal
          </Button>
          <Button variant="outline" size="xs" onClick={handleOpenInEditor}>
            <ExternalLinkIcon /> in VS Code
          </Button>
        </div>
      </section>

      <section>
        <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">Parent Directories</h3>
        <div className="flex flex-col gap-0.5">
          {parents.map((dir) => (
            <button
              key={dir.path}
              onClick={() => void handleSwitchCwd(dir.path)}
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
