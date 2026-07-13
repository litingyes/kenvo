import { GitBranchIcon, GitCommitIcon, GitPullRequestIcon, RefreshCwIcon } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { runExternalQuiet } from '@/lib/terminal/external-runner'
import { cn } from '@/lib/utils'

interface GitStatus {
  branch: string
  ahead: number
  behind: number
  files: { path: string; status: string }[]
  commits: { hash: string; message: string; author: string; date: string }[]
}

export function GitPanel({ cwd }: { cwd: string }) {
  const [status, setStatus] = React.useState<GitStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [notRepo, setNotRepo] = React.useState(false)
  const [actionLoading, setActionLoading] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    setNotRepo(false)
    try {
      const branchOut = await runExternalQuiet('git rev-parse --abbrev-ref HEAD 2>/dev/null', cwd)
      if (!branchOut) {
        setNotRepo(true)
        return
      }
      const branch = branchOut.trim()

      const trackingOut = await runExternalQuiet(
        'git rev-list --left-right --count @{upstream}...HEAD 2>/dev/null || echo "0 0"',
        cwd,
      )
      const [behind, ahead] = trackingOut.trim().split(/\s+/).map(Number)

      const statusOut = await runExternalQuiet('git status --porcelain 2>/dev/null', cwd)
      const files = statusOut
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => ({
          path: line.slice(3),
          status: line.slice(0, 2).trim(),
        }))

      const logOut = await runExternalQuiet(
        'git log --oneline -10 --format="%H|%s|%an|%cr" 2>/dev/null',
        cwd,
      )
      const commits = logOut
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const parts = line.split('|')
          return {
            hash: parts[0]!.slice(0, 7),
            message: parts[1] ?? '',
            author: parts[2] ?? '',
            date: parts[3] ?? '',
          }
        })

      setStatus({ branch, ahead: ahead ?? 0, behind: behind ?? 0, files, commits })
    } catch {
      setNotRepo(true)
    } finally {
      setLoading(false)
    }
  }, [cwd])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const runGitAction = async (name: string, cmd: string) => {
    setActionLoading(name)
    await runExternalQuiet(cmd, cwd)
    setActionLoading(null)
    void refresh()
  }

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading git info...</p>
  }

  if (notRepo) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-muted-foreground">
        <GitBranchIcon className="size-6 opacity-40" />
        <p>Not a git repository</p>
      </div>
    )
  }

  if (!status) return null

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <GitBranchIcon className="size-3.5" />
            {status.branch}
          </h3>
          <Button variant="ghost" size="icon" className="size-6" onClick={refresh}>
            <RefreshCwIcon className="size-3" />
          </Button>
        </div>
        {(status.ahead > 0 || status.behind > 0) && (
          <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground">
            {status.ahead > 0 && (
              <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                <GitPullRequestIcon className="size-2.5" />
                {status.ahead} ahead
              </span>
            )}
            {status.behind > 0 && <span className="text-orange-500">{status.behind} behind</span>}
          </div>
        )}
      </section>

      <section>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-6 flex-1 text-xs"
            disabled={actionLoading !== null}
            onClick={() => runGitAction('pull', 'git pull --rebase 2>&1')}
          >
            Pull
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 flex-1 text-xs"
            disabled={actionLoading !== null}
            onClick={() => runGitAction('push', 'git push 2>&1')}
          >
            Push
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 flex-1 text-xs"
            disabled={actionLoading !== null}
            onClick={() => runGitAction('stage', 'git add -A 2>&1')}
          >
            Stage
          </Button>
        </div>
        {actionLoading && (
          <p className="mt-1 text-[10px] text-muted-foreground">Running {actionLoading}...</p>
        )}
      </section>

      {status.files.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">
            Changes ({status.files.length})
          </h3>
          <div className="flex flex-col gap-0.5">
            {status.files.slice(0, 20).map((f) => (
              <div key={f.path} className="flex items-center gap-1.5 text-xs">
                <span
                  className={cn('w-4 shrink-0 font-mono text-[10px]', getStatusColor(f.status))}
                >
                  {f.status}
                </span>
                <span className="truncate text-foreground">{f.path}</span>
              </div>
            ))}
            {status.files.length > 20 && (
              <p className="text-[10px] text-muted-foreground">+{status.files.length - 20} more</p>
            )}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <GitCommitIcon className="size-3.5" />
          Recent Commits
        </h3>
        <div className="flex flex-col gap-1.5">
          {status.commits.map((c) => (
            <div key={c.hash} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">{c.hash}</span>
                <span className="truncate text-xs text-foreground">{c.message}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/70">
                {c.author} · {c.date}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function getStatusColor(status: string): string {
  if (status.includes('M')) return 'text-orange-500'
  if (status.includes('A') || status === '??') return 'text-green-600 dark:text-green-400'
  if (status.includes('D')) return 'text-red-500'
  if (status.includes('R')) return 'text-blue-400'
  return 'text-muted-foreground'
}
