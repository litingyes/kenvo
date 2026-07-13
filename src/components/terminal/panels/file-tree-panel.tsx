import { readDir } from '@tauri-apps/plugin-fs'
import type { DirEntry } from '@tauri-apps/plugin-fs'
import { ChevronDownIcon, ChevronRightIcon, FolderIcon, FileIcon, HomeIcon } from 'lucide-react'
import * as React from 'react'

interface FileTreePanelProps {
  cwd: string
  homeDir: string
}

interface TreeNode {
  name: string
  path: string
  isDir: boolean
  children?: TreeNode[]
  loaded?: boolean
}

export function FileTreePanel({ cwd, homeDir }: FileTreePanelProps) {
  const [tree, setTree] = React.useState<TreeNode[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadChildren(cwd)
      .then((nodes) => {
        if (!cancelled) setTree(nodes)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cwd])

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading...</p>
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <HomeIcon className="size-3" />
        {shortenPath(cwd, homeDir)}
      </div>
      {tree.map((node) => (
        <TreeItem key={node.path} node={node} depth={0} cwd={cwd} />
      ))}
    </div>
  )
}

function TreeItem({ node, depth, cwd }: { node: TreeNode; depth: number; cwd: string }) {
  const [expanded, setExpanded] = React.useState(false)
  const [children, setChildren] = React.useState<TreeNode[] | null>(null)
  const [loading, setLoading] = React.useState(false)

  const handleToggle = async () => {
    if (!expanded && !children) {
      setLoading(true)
      const nodes = await loadChildren(node.path)
      setChildren(nodes)
      setLoading(false)
    }
    setExpanded(!expanded)
  }

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
            <FolderIcon className="size-3 shrink-0 text-blue-400" />
            <span className="truncate text-foreground">{node.name}</span>
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <FileIcon className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate text-muted-foreground">{node.name}</span>
          </>
        )}
      </button>
      {expanded && children && (
        <div>
          {children.map((child) => (
            <TreeItem key={child.path} node={child} depth={depth + 1} cwd={cwd} />
          ))}
        </div>
      )}
    </div>
  )
}

async function loadChildren(dirPath: string): Promise<TreeNode[]> {
  try {
    const entries: DirEntry[] = await readDir(dirPath)
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    const nodes: TreeNode[] = []
    for (const entry of sorted) {
      if (entry.name.startsWith('.')) continue
      const path = dirPath === '/' ? '/' + entry.name : dirPath + '/' + entry.name
      nodes.push({
        name: entry.name,
        path,
        isDir: entry.isDirectory,
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
