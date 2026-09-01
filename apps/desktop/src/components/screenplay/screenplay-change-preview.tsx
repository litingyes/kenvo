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
  const proposal = proposals[proposals.length - 1]
  if (!proposal || proposal.changes.length === 0) return null

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
          <p className="truncate text-xs font-semibold">{proposal.title}</p>
          <p className="text-[10px] text-muted-foreground">
            {proposal.changes.length} 个文件等待确认
          </p>
        </div>
        <Badge variant="outline" className="border-amber-500/30 text-[10px] text-amber-600">
          待确认
        </Badge>
      </div>
      <ScrollArea className="h-40 max-h-40" viewportClassName="px-3" contentClassName="pb-2">
        <div className="flex flex-col gap-1.5">
          {proposal.changes.map((change) => (
            <div
              key={change.path}
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
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{change.summary}</p>
              {change.operation !== 'delete' && change.afterText && (
                <pre className="mt-1 max-h-16 overflow-hidden rounded bg-muted/60 p-1.5 font-mono text-[9px] leading-4 whitespace-pre-wrap text-muted-foreground">
                  {change.afterText.slice(0, 320)}
                  {change.afterText.length > 320 ? '…' : ''}
                </pre>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="flex items-center justify-end gap-1.5 px-3 py-2">
        <Button variant="ghost" size="xs" onClick={() => onDiscard(proposal)} disabled={busy}>
          <XIcon />
          放弃
        </Button>
        <Button size="xs" onClick={() => onApply(proposal)} disabled={busy}>
          {busy ? <LoaderCircleIcon className="animate-spin" /> : <CheckIcon />}
          确认写入
        </Button>
      </div>
    </section>
  )
}
