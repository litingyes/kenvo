import { ChevronDownIcon, ChevronRightIcon, FileTextIcon, FolderIcon } from 'lucide-react'
import * as React from 'react'

import { api, type DirEntry } from '@/lib/electron/api'
import { useProjectStore } from '@/lib/store/project-store'
import { cn } from '@/lib/utils'

const IGNORED = new Set(['node_modules', '.git', '.DS_Store'])

interface TreeNode {
  name: string
  relPath: string
  isDirectory: boolean
  children?: TreeNode[]
  expanded?: boolean
}

interface ProjectTreeProps {
  rootPath: string
  /** Bump to force reload (e.g. after agent file activity). */
  refreshKey: number
}

export function ProjectTree({ rootPath, refreshKey }: ProjectTreeProps) {
  const [tree, setTree] = React.useState<TreeNode[]>([])
  const openFile = useProjectStore((s) => s.openFile)
  const tabs = useProjectStore((s) => s.tabs)
  const activeTabId = useProjectStore((s) => s.activeTabId)
  const activeFile = tabs.find((t) => t.id === activeTabId)?.file_path
  const expandedRef = React.useRef<Set<string>>(new Set())

  const load = React.useCallback(async () => {
    async function build(dirAbs: string, relBase: string): Promise<TreeNode[]> {
      let entries: DirEntry[] = []
      try {
        entries = await api.fs.readDir(dirAbs)
      } catch {
        return []
      }
      const nodes: TreeNode[] = []
      entries
        .filter((e) => !IGNORED.has(e.name) && !e.name.startsWith('.'))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      for (const entry of entries) {
        if (IGNORED.has(entry.name) || entry.name.startsWith('.')) continue
        const relPath = relBase ? `${relBase}/${entry.name}` : entry.name
        if (entry.isDirectory) {
          const expanded = expandedRef.current.has(relPath)
          nodes.push({
            name: entry.name,
            relPath,
            isDirectory: true,
            expanded,
            children: expanded ? await build(`${dirAbs}/${entry.name}`, relPath) : undefined,
          })
        } else {
          nodes.push({ name: entry.name, relPath, isDirectory: false })
        }
      }
      return nodes
    }
    const nodes = await build(rootPath, '')
    setTree(nodes)
  }, [rootPath])

  React.useEffect(() => {
    void load()
  }, [load, refreshKey])

  const toggleDir = React.useCallback(
    (relPath: string) => {
      if (expandedRef.current.has(relPath)) {
        expandedRef.current.delete(relPath)
      } else {
        expandedRef.current.add(relPath)
      }
      void load()
    },
    [load],
  )

  const renderNodes = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => (
      <React.Fragment key={node.relPath}>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-xs hover:bg-accent',
            !node.isDirectory && activeFile === node.relPath && 'bg-accent text-accent-foreground',
          )}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          onClick={() => {
            if (node.isDirectory) {
              toggleDir(node.relPath)
            } else {
              void openFile(node.relPath)
            }
          }}
        >
          {node.isDirectory ? (
            <>
              {node.expanded ? (
                <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground" />
              )}
              <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
            </>
          ) : (
            <>
              <span className="w-3 shrink-0" />
              <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
            </>
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {node.isDirectory && node.expanded && node.children
          ? renderNodes(node.children, depth + 1)
          : null}
      </React.Fragment>
    ))

  if (tree.length === 0) {
    return <div className="px-3 py-2 text-xs text-muted-foreground">Empty project</div>
  }

  return <div className="px-1.5 py-1">{renderNodes(tree, 0)}</div>
}
