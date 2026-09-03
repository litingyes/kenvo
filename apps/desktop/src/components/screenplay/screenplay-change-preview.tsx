import {
  CheckIcon,
  FilePlus2Icon,
  FileTextIcon,
  FolderInputIcon,
  LoaderCircleIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { AgentProposal } from '@/lib/ai/server-client'

interface ScreenplayChangePreviewProps {
  proposals: AgentProposal[]
  busy: boolean
  onApply: (proposal: AgentProposal) => void
  onDiscard: (proposal: AgentProposal) => void
}

function operationLabel(operation: AgentProposal['changes'][number]['operation']): string {
  if (operation === 'create') return '新建'
  if (operation === 'update') return '更新'
  if (operation === 'delete') return '删除'
  return '移动'
}

export function ScreenplayChangePreview({
  proposals,
  busy,
  onApply,
  onDiscard,
}: ScreenplayChangePreviewProps) {
  const pendingProposals = proposals.filter((proposal) => proposal.changes.length > 0)
  if (pendingProposals.length === 0) return null

  return (
    <section
      className="shrink-0 border-b border-amber-500/30 bg-amber-500/[0.06]"
      data-testid="change-preview"
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-600">
          <FileTextIcon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">待确认的剧本提案</p>
          <p className="text-[10px] text-muted-foreground">
            {pendingProposals.reduce((count, proposal) => count + proposal.changes.length, 0)}{' '}
            个文件 · {pendingProposals.length} 组 Agent 改动
          </p>
        </div>
        <Badge variant="outline" className="border-amber-500/30 text-[10px] text-amber-600">
          待确认
        </Badge>
      </div>
      <ScrollArea className="max-h-72" viewportClassName="px-3" contentClassName="pb-2">
        <div className="flex flex-col gap-2">
          {pendingProposals.map((proposal) => (
            <div
              key={proposal.id}
              className="rounded-lg border border-amber-500/20 bg-background/45 p-2"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                  {proposal.title}
                </p>
                <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                  {new Date(proposal.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {proposal.changes.map((change) => (
                  <div
                    key={`${proposal.id}-${change.path}`}
                    className="rounded-md border border-border/70 bg-background/70 px-2 py-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      {change.operation === 'create' ? (
                        <FilePlus2Icon className="size-3 text-emerald-600" />
                      ) : change.operation === 'delete' ? (
                        <Trash2Icon className="size-3 text-destructive" />
                      ) : change.operation === 'move' ? (
                        <FolderInputIcon className="size-3 text-blue-600" />
                      ) : (
                        <FileTextIcon className="size-3 text-amber-600" />
                      )}
                      <span className="min-w-0 flex-1 truncate font-mono text-[10px]">
                        {change.operation === 'move' && change.fromPath
                          ? `${change.fromPath} → ${change.path}`
                          : change.path}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {operationLabel(change.operation)}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                      {change.summary}
                    </p>
                    <details className="group mt-1.5">
                      <summary className="cursor-pointer text-[10px] text-amber-700 outline-none group-open:mb-1 dark:text-amber-300">
                        查看 before / after Diff
                      </summary>
                      <div className="grid gap-1 md:grid-cols-2">
                        <DiffBlock
                          label="before"
                          value={change.beforeText ?? '(文件不存在)'}
                          tone="muted"
                        />
                        <DiffBlock
                          label="after"
                          value={
                            change.operation === 'delete'
                              ? '(将删除)'
                              : (change.afterText ?? change.beforeText ?? '(内容不变，仅移动)')
                          }
                          tone={change.operation === 'delete' ? 'danger' : 'success'}
                        />
                      </div>
                    </details>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-end gap-1.5">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onDiscard(proposal)}
                  disabled={busy}
                >
                  <XIcon />
                  放弃
                </Button>
                <Button size="xs" onClick={() => onApply(proposal)} disabled={busy}>
                  {busy ? <LoaderCircleIcon className="animate-spin" /> : <CheckIcon />}
                  批量确认写入
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </section>
  )
}

function DiffBlock({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'muted' | 'success' | 'danger'
}) {
  return (
    <div className="min-w-0 rounded border border-border/60 bg-muted/40">
      <div className="border-b border-border/60 px-1.5 py-1 font-mono text-[9px] text-muted-foreground">
        {label}
      </div>
      <pre
        className={`max-h-24 overflow-hidden p-1.5 font-mono text-[9px] leading-4 whitespace-pre-wrap ${tone === 'success' ? 'text-emerald-700 dark:text-emerald-300' : tone === 'danger' ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        {value.slice(0, 480)}
        {value.length > 480 ? '…' : ''}
      </pre>
    </div>
  )
}
