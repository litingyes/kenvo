import { useNavigate } from '@tanstack/react-router'
import type { TFunction } from 'i18next'
import {
  CopyIcon,
  FileIcon,
  ExternalLinkIcon,
  FolderIcon,
  FolderOpenIcon,
  LinkIcon,
  LockIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useTerminalStore } from '@/lib/store/terminal-store'
import { copyToClipboard, openInEditor, revealInFinder } from '@/lib/terminal/opener-helpers'

import { formatBytes, formatDate, formatMode, getParentDirs, usePathInfo } from './use-path-info'

export function PathInfoPanel({ cwd }: { cwd: string }) {
  const { t } = useTranslation()
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
      toast.success(t('toast.copyPath'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.copyPathError'))
    }
  }

  const handleReveal = async () => {
    try {
      await revealInFinder(cwd)
      toast.success(t('toast.reveal'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.revealError'))
    }
  }

  const handleOpenInEditor = async () => {
    try {
      await openInEditor(cwd, 'code')
      toast.success(t('toast.openVSCode'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.openVSCodeError'))
    }
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section>
        <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">
          {t('pathInfo.currentPath')}
        </h3>
        <p className="mb-2 font-mono text-xs break-all text-foreground">{cwd}</p>
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" size="xs" onClick={handleCopy}>
            <CopyIcon /> {t('pathInfo.copy')}
          </Button>
          <Button variant="outline" size="xs" onClick={handleReveal}>
            <FolderOpenIcon /> {t('pathInfo.reveal')}
          </Button>
          <Button variant="outline" size="xs" onClick={handleOpenInEditor}>
            <ExternalLinkIcon /> {t('pathInfo.openInVSCode')}
          </Button>
        </div>
      </section>

      <section>
        <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">
          {t('pathInfo.parentDirectories')}
        </h3>
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
        <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">
          {t('pathInfo.details')}
        </h3>
        {loading ? (
          <p className="text-xs text-muted-foreground">{t('pathInfo.loading')}</p>
        ) : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : info ? (
          <dl className="flex flex-col gap-1 text-xs">
            <Row label={t('pathInfo.type')} value={getTypeLabel(info, t)} />
            <Row label={t('pathInfo.size')} value={formatBytes(info.size)} />
            <Row label={t('pathInfo.modified')} value={formatDate(info.mtime)} />
            <Row label={t('pathInfo.mode')} value={formatMode(info.mode)} />
            <Row
              label={t('pathInfo.readOnly')}
              value={
                <span className="flex items-center gap-1">
                  {info.readonly && <LockIcon className="size-3" />}
                  {info.readonly ? t('pathInfo.yes') : t('pathInfo.no')}
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

function getTypeLabel(
  info: {
    isFile: boolean
    isDirectory: boolean
    isSymlink: boolean
  },
  t: TFunction,
): React.ReactNode {
  if (info.isDirectory)
    return (
      <span className="flex items-center gap-1">
        <FolderIcon className="size-3" />
        {t('pathInfo.directory')}
      </span>
    )
  if (info.isSymlink)
    return (
      <span className="flex items-center gap-1">
        <LinkIcon className="size-3" />
        {t('pathInfo.symlink')}
      </span>
    )
  if (info.isFile)
    return (
      <span className="flex items-center gap-1">
        <FileIcon className="size-3" />
        {t('pathInfo.file')}
      </span>
    )
  return t('pathInfo.unknown')
}
