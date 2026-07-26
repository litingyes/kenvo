import {
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  HomeIcon,
  SearchIcon,
} from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, type DirEntry } from '@/lib/electron/api'
import { getFileIconClass, getFolderIconClass, getRootIconClass } from '@/lib/file-icons'
import { shellQuote } from '@/lib/terminal/external-runner'
import { cn } from '@/lib/utils'

interface FileTreePanelProps {
  cwd: string
  homeDir: string
  isGitRepo?: boolean
  onOpenFile?: (filePath: string) => void
  onPinFile?: (filePath: string) => void
}

interface TreeNode {
  name: string
  path: string
  isDir: boolean
  isHidden: boolean
  isIgnored?: boolean
  children?: TreeNode[]
  loaded?: boolean
}

export function FileTreePanel({
  cwd,
  homeDir,
  isGitRepo,
  onOpenFile,
  onPinFile,
}: FileTreePanelProps) {
  const { t } = useTranslation()
  const [tree, setTree] = React.useState<TreeNode[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showHidden, setShowHidden] = React.useState(false)
  const [filter, setFilter] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    void loadChildren(cwd, showHidden, { checkIgnored: isGitRepo })
      .then((nodes) => {
        if (!cancelled) setTree(nodes)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cwd, showHidden, isGitRepo])

  const filterLc = filter.trim().toLowerCase()

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <SearchIcon className="absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('files.search')}
            className="h-7 pl-7 text-xs"
          />
        </div>
        <Button
          variant={showHidden ? 'secondary' : 'ghost'}
          size="icon-sm"
          onClick={() => setShowHidden((v) => !v)}
          aria-label={showHidden ? t('files.hideHidden') : t('files.showHidden')}
          title={showHidden ? t('files.hideDotfiles') : t('files.showDotfiles')}
        >
          {showHidden ? <EyeIcon className="size-3.5" /> : <EyeOffIcon className="size-3.5" />}
        </Button>
      </div>

      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <span className={cn('size-3.5 shrink-0', getRootIconClass(false))} aria-hidden="true" />
        <HomeIcon className="size-3" />
        {shortenPath(cwd, homeDir)}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">{t('files.loading')}</p>
      ) : tree.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('files.emptyDirectory')}</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {tree
            .filter((node) => !filterLc || node.name.toLowerCase().includes(filterLc))
            .map((node) => (
              <TreeItem
                key={node.path}
                node={node}
                depth={0}
                showHidden={showHidden}
                filter={filterLc}
                checkIgnored={isGitRepo}
                onOpenFile={onOpenFile}
                onPinFile={onPinFile}
              />
            ))}
        </div>
      )}
    </div>
  )
}

function TreeItem({
  node,
  depth,
  showHidden,
  filter,
  checkIgnored,
  parentIgnored,
  onOpenFile,
  onPinFile,
}: {
  node: TreeNode
  depth: number
  showHidden: boolean
  filter: string
  checkIgnored?: boolean
  parentIgnored?: boolean
  onOpenFile?: (filePath: string) => void
  onPinFile?: (filePath: string) => void
}) {
  const [expanded, setExpanded] = React.useState(false)
  const [children, setChildren] = React.useState<TreeNode[] | null>(null)
  const [loading, setLoading] = React.useState(false)
  const isDimmed = node.isHidden || node.isIgnored

  const handleToggle = async () => {
    if (!node.isDir) {
      onOpenFile?.(node.path)
      return
    }
    if (!expanded && !children) {
      setLoading(true)
      const nodes = await loadChildren(node.path, showHidden, {
        checkIgnored,
        parentIgnored,
      })
      setChildren(nodes)
      setLoading(false)
    }
    setExpanded(!expanded)
  }

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!node.isDir) {
      onPinFile?.(node.path)
    }
  }

  const visibleChildren = React.useMemo(() => {
    if (!children) return []
    if (!filter) return children
    return children.filter((c) => c.name.toLowerCase().includes(filter))
  }, [children, filter])

  return (
    <div>
      <button
        onClick={handleToggle}
        onDoubleClick={node.isDir ? undefined : handlePin}
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-muted"
        style={{ paddingLeft: depth * 12 + 4 }}
      >
        {node.isDir ? (
          <>
            {loading ? (
              <span className="w-3 shrink-0" />
            ) : expanded ? (
              <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground" />
            )}
            <span
              className={cn(
                'size-3.5 shrink-0',
                getFolderIconClass(node.name, expanded),
                isDimmed && 'opacity-50',
              )}
              aria-hidden="true"
            />
            <span className={cn('truncate text-foreground', isDimmed && 'opacity-50')}>
              {node.name}
            </span>
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <span
              className={cn(
                'size-3.5 shrink-0',
                getFileIconClass(node.name),
                isDimmed && 'opacity-50',
              )}
              aria-hidden="true"
            />
            <span className={cn('truncate text-muted-foreground', isDimmed && 'opacity-50')}>
              {node.name}
            </span>
          </>
        )}
      </button>
      {expanded && visibleChildren.length > 0 && (
        <div>
          {visibleChildren.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              showHidden={showHidden}
              filter={filter}
              checkIgnored={checkIgnored}
              parentIgnored={node.isIgnored}
              onOpenFile={onOpenFile}
              onPinFile={onPinFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}

async function loadChildren(
  dirPath: string,
  showHidden: boolean,
  options: { checkIgnored?: boolean; parentIgnored?: boolean } = {},
): Promise<TreeNode[]> {
  const { checkIgnored = false, parentIgnored = false } = options
  try {
    const { api: electronApi } = await import('@/lib/electron/api')
    const entries: DirEntry[] = await electronApi.fs.readDir(dirPath)
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    const nodes: TreeNode[] = []
    for (const entry of sorted) {
      const isHidden = entry.name.startsWith('.')
      if (isHidden && !showHidden) continue
      const path = dirPath === '/' ? '/' + entry.name : dirPath + '/' + entry.name
      nodes.push({
        name: entry.name,
        path,
        isDir: entry.isDirectory,
        isHidden,
        isIgnored: parentIgnored ? true : undefined,
      })
    }

    if (parentIgnored || nodes.length === 0 || !checkIgnored) {
      return nodes.slice(0, 100)
    }

    const ignored = await getIgnoredNames(
      dirPath,
      nodes.map((n) => n.name),
    )
    if (ignored.size > 0) {
      for (const node of nodes) {
        if (ignored.has(node.name)) {
          node.isIgnored = true
        }
      }
    }

    return nodes.slice(0, 100)
  } catch {
    return []
  }
}

async function getIgnoredNames(dirPath: string, names: string[]): Promise<Set<string>> {
  const command = `printf '%s\\0' ${names.map(shellQuote).join(' ')} | git check-ignore --stdin -z 2>/dev/null`
  const { stdout } = await api.shell.execute('/bin/sh', ['-c', command], { cwd: dirPath })
  if (!stdout) return new Set()
  return new Set(stdout.split('\0').filter(Boolean))
}

function shortenPath(cwd: string, homeDir: string): string {
  if (homeDir && cwd.startsWith(homeDir)) {
    return '~' + cwd.slice(homeDir.length)
  }
  return cwd
}
