import { readDir } from '@tauri-apps/plugin-fs'
import type { DirEntry } from '@tauri-apps/plugin-fs'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  HomeIcon,
  SearchIcon,
} from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getFolderIconUrl, getFileIconUrl, getRootIconUrl } from '@/lib/file-icons'
import { cn } from '@/lib/utils'

interface FileTreePanelProps {
  cwd: string
  homeDir: string
}

interface TreeNode {
  name: string
  path: string
  isDir: boolean
  isHidden: boolean
  children?: TreeNode[]
  loaded?: boolean
}

export function FileTreePanel({ cwd, homeDir }: FileTreePanelProps) {
  const [tree, setTree] = React.useState<TreeNode[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showHidden, setShowHidden] = React.useState(false)
  const [filter, setFilter] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadChildren(cwd, showHidden)
      .then((nodes) => {
        if (!cancelled) setTree(nodes)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cwd, showHidden])

  const filterLc = filter.trim().toLowerCase()

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <SearchIcon className="absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search files…"
            className="h-7 pl-7 text-xs"
          />
        </div>
        <Button
          variant={showHidden ? 'secondary' : 'ghost'}
          size="icon-sm"
          onClick={() => setShowHidden((v) => !v)}
          aria-label={showHidden ? 'Hide hidden files' : 'Show hidden files'}
          title={showHidden ? 'Hide dotfiles' : 'Show dotfiles'}
        >
          {showHidden ? <EyeIcon className="size-3.5" /> : <EyeOffIcon className="size-3.5" />}
        </Button>
      </div>

      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <img src={getRootIconUrl(false)} alt="" className="size-3.5 shrink-0" />
        <HomeIcon className="size-3" />
        {shortenPath(cwd, homeDir)}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : tree.length === 0 ? (
        <p className="text-xs text-muted-foreground">Empty directory</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {tree
            .filter((node) => !filterLc || node.name.toLowerCase().includes(filterLc))
            .map((node) => (
              <TreeItem
                key={node.path}
                node={node}
                depth={0}
                cwd={cwd}
                showHidden={showHidden}
                filter={filterLc}
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
  cwd,
  showHidden,
  filter,
}: {
  node: TreeNode
  depth: number
  cwd: string
  showHidden: boolean
  filter: string
}) {
  const [expanded, setExpanded] = React.useState(false)
  const [children, setChildren] = React.useState<TreeNode[] | null>(null)
  const [loading, setLoading] = React.useState(false)

  const handleToggle = async () => {
    if (!node.isDir) return
    if (!expanded && !children) {
      setLoading(true)
      const nodes = await loadChildren(node.path, showHidden)
      setChildren(nodes)
      setLoading(false)
    }
    setExpanded(!expanded)
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
            <img src={getFolderIconUrl(node.name, expanded)} alt="" className="size-3.5 shrink-0" />
            <span className={cn('truncate text-foreground', node.isHidden && 'opacity-50')}>
              {node.name}
            </span>
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <img src={getFileIconUrl(node.name)} alt="" className="size-3.5 shrink-0" />
            <span className={cn('truncate text-muted-foreground', node.isHidden && 'opacity-50')}>
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
              cwd={cwd}
              showHidden={showHidden}
              filter={filter}
            />
          ))}
        </div>
      )}
    </div>
  )
}

async function loadChildren(dirPath: string, showHidden: boolean): Promise<TreeNode[]> {
  try {
    const entries: DirEntry[] = await readDir(dirPath)
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
      })
    }
    return nodes.slice(0, 100)
  } catch {
    return []
  }
}

function shortenPath(cwd: string, homeDir: string): string {
  if (homeDir && cwd.startsWith(homeDir)) {
    return '~' + cwd.slice(homeDir.length)
  }
  return cwd
}
