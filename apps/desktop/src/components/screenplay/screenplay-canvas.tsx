import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClapperboardIcon,
  Clock3Icon,
  FilmIcon,
  FileTextIcon,
  GripVerticalIcon,
  Layers3Icon,
  PencilLineIcon,
  SparklesIcon,
  WandSparklesIcon,
} from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

import type { EpisodeSummary, SceneSummary, ScreenplayDocumentRef, ShotCard } from './types'

interface ScreenplayCanvasProps {
  episodes: EpisodeSummary[]
  unorganized: ScreenplayDocumentRef[]
  selectedSceneId: string | null
  onOrganize: () => void
  organizeDisabled?: boolean
  onSelectScene: (scene: SceneSummary) => void
  onEditScene: (scene: SceneSummary) => void
  onOpenDocument: (document: ScreenplayDocumentRef) => void
  onReorderScene: (episode: EpisodeSummary, from: number, to: number) => void
  onReorderShot: (scene: SceneSummary, from: number, to: number) => void
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '未计时'
  if (seconds < 60) return `${seconds} 秒`
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    idea: '构思',
    outline: '大纲',
    draft: '草稿',
    revision: '修改中',
    locked: '已完成',
  }
  return labels[status] ?? status
}

function statusClass(status: string): string {
  if (status === 'locked') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
  if (status === 'revision') return 'border-amber-500/30 bg-amber-500/10 text-amber-600'
  if (status === 'draft') return 'border-blue-500/30 bg-blue-500/10 text-blue-600'
  return 'border-border bg-muted text-muted-foreground'
}

function SceneCard({
  scene,
  episode,
  index,
  selected,
  expanded,
  onSelect,
  onEdit,
  onMove,
  onReorderShot,
}: {
  scene: SceneSummary
  episode: EpisodeSummary
  index: number
  selected: boolean
  expanded: boolean
  onSelect: () => void
  onEdit: () => void
  onMove: (to: number) => void
  onReorderShot: (from: number, to: number) => void
}) {
  const [draggingShot, setDraggingShot] = React.useState<number | null>(null)
  const width = Math.max(220, Math.min(420, 220 + (scene.duration ?? 0) * 8))

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', String(index))
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const from = Number(event.dataTransfer.getData('text/plain'))
        if (Number.isInteger(from) && from !== index) onMove(from)
      }}
      className={cn('relative shrink-0 snap-start', expanded ? 'w-[min(100%,520px)]' : 'w-auto')}
      style={{ minWidth: expanded ? undefined : `${width}px` }}
      data-testid={`scene-card-${scene.id}`}
    >
      <Card
        className={cn(
          'h-full border-l-2 transition-[border-color,box-shadow,background-color] duration-200',
          selected ? 'border-l-amber-500 bg-accent/40 shadow-sm' : 'border-l-border',
        )}
      >
        <CardHeader className="gap-2 px-3 py-3">
          <div className="flex items-start gap-2">
            <GripVerticalIcon
              className="mt-0.5 size-4 shrink-0 cursor-grab text-muted-foreground/60 active:cursor-grabbing"
              aria-hidden="true"
            />
            <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {String(scene.order).padStart(2, '0')}
                </span>
                <CardTitle className="truncate text-sm">{scene.title}</CardTitle>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {[scene.location, scene.time].filter(Boolean).join(' · ') || '地点与时间待补充'}
              </p>
            </button>
            {scene.example && (
              <Badge variant="outline" className="text-[10px]">
                示例
              </Badge>
            )}
            <Badge variant="outline" className={cn('text-[10px]', statusClass(scene.status))}>
              {statusLabel(scene.status)}
            </Badge>
          </div>

          <div className="flex items-center gap-1 pl-6 text-[10px] text-muted-foreground">
            <Clock3Icon className="size-3" />
            {formatDuration(scene.duration)}
            <span className="px-0.5">·</span>
            <FilmIcon className="size-3" />
            {scene.shotCount} 镜头
            {scene.warningCount > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 text-amber-600">
                <AlertTriangleIcon className="size-3" />
                {scene.warningCount}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-2 px-3 pb-3">
          <div className="grid gap-1 text-[11px] leading-5">
            <p className="line-clamp-2 text-foreground/85">{scene.summary || '还没有场景摘要。'}</p>
            <p className="line-clamp-2 text-muted-foreground">
              <span className="font-medium text-foreground/70">冲突：</span>
              {scene.conflict || '待补充'}
            </p>
            {scene.turn && (
              <p className="line-clamp-2 text-muted-foreground">
                <span className="font-medium text-foreground/70">变化：</span>
                {scene.turn}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 border-t border-border/70 pt-2">
            <Button
              variant="ghost"
              size="xs"
              className="mr-auto text-[11px]"
              onClick={onSelect}
              aria-expanded={expanded}
            >
              {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
              {expanded ? '收起镜头' : `查看 ${scene.shotCount} 个镜头`}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onMove(index - 1)}
              disabled={index === 0}
              aria-label="场景上移"
            >
              <ArrowUpIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onMove(index + 1)}
              disabled={index === episode.scenes.length - 1}
              aria-label="场景下移"
            >
              <ArrowDownIcon />
            </Button>
            <Button variant="outline" size="xs" onClick={onEdit}>
              <PencilLineIcon />
              编辑
            </Button>
          </div>

          {expanded && (
            <ShotList
              shots={scene.shots}
              draggingShot={draggingShot}
              setDraggingShot={setDraggingShot}
              onReorderShot={onReorderShot}
            />
          )}
        </CardContent>
      </Card>
    </article>
  )
}

function ShotList({
  shots,
  draggingShot,
  setDraggingShot,
  onReorderShot,
}: {
  shots: ShotCard[]
  draggingShot: number | null
  setDraggingShot: (index: number | null) => void
  onReorderShot: (from: number, to: number) => void
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border/70 pt-2">
      <div className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        <Layers3Icon className="size-3" />
        镜头序列
      </div>
      {shots.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">还没有镜头卡片。</p>
      ) : (
        shots.map((shot, index) => (
          <div
            key={shot.id}
            draggable
            onDragStart={(event) => {
              setDraggingShot(index)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', String(index))
            }}
            onDragEnd={() => setDraggingShot(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const from = Number(event.dataTransfer.getData('text/plain'))
              if (Number.isInteger(from) && from !== index) onReorderShot(from, index)
              setDraggingShot(null)
            }}
            className={cn(
              'rounded-md border border-border/70 bg-background/60 px-2 py-1.5 transition-colors',
              draggingShot === index && 'border-amber-500/60 bg-amber-500/5',
            )}
          >
            <div className="flex items-start gap-1.5">
              <GripVerticalIcon className="mt-0.5 size-3 shrink-0 cursor-grab text-muted-foreground/50" />
              <span className="font-mono text-[10px] text-amber-600">
                {String(shot.order).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium">{shot.heading}</p>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
                  {shot.fields['画面'] || '画面待补充'}
                </p>
              </div>
              {shot.duration && (
                <span className="shrink-0 text-[10px] text-muted-foreground">{shot.duration}s</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function EpisodeHeader({
  episode,
  expanded,
  onToggle,
}: {
  episode: EpisodeSummary
  expanded: boolean
  onToggle: () => void
}) {
  const duration = episode.duration ?? 0
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onToggle}
        className="group flex min-w-0 items-center gap-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-expanded={expanded}
      >
        <span className="flex size-7 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 font-mono text-[10px] font-medium text-amber-600">
          {String(episode.order).padStart(2, '0')}
        </span>
        {expanded ? (
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-3.5 text-muted-foreground" />
        )}
        <span className="truncate text-sm font-semibold">{episode.title}</span>
      </button>
      <span className="text-[11px] text-muted-foreground">
        {episode.scenes.length} 场 ·{' '}
        {episode.scenes.reduce((sum, scene) => sum + scene.shotCount, 0)} 镜头 ·{' '}
        {formatDuration(duration)}
      </span>
      {episode.warningCount > 0 && (
        <Badge
          variant="outline"
          className="ml-auto gap-1 border-amber-500/30 text-[10px] text-amber-600"
        >
          <AlertTriangleIcon className="size-3" />
          {episode.warningCount} 个提醒
        </Badge>
      )}
    </div>
  )
}

export function ScreenplayCanvas({
  episodes,
  unorganized,
  selectedSceneId,
  onOrganize,
  organizeDisabled = false,
  onSelectScene,
  onEditScene,
  onOpenDocument,
  onReorderScene,
  onReorderShot,
}: ScreenplayCanvasProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())
  const [expandedSceneId, setExpandedSceneId] = React.useState<string | null>(null)

  const toggleEpisode = (id: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectScene = (scene: SceneSummary) => {
    onSelectScene(scene)
    setExpandedSceneId((current) => (current === scene.id ? null : scene.id))
  }

  if (episodes.length === 0 && unorganized.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-600">
          <ClapperboardIcon className="size-6" />
        </div>
        <div>
          <h2 className="text-base font-semibold">还没有分集内容</h2>
          <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
            从总纲开始规划第一集，Canvas 会随着 Markdown 文件更新自动展开。
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <SparklesIcon className="size-3.5 text-amber-600" />
          {t('screenplay.canvas.emptyHint')}
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full" viewportClassName="px-5 py-5" contentClassName="min-h-full">
      <div
        className="mx-auto flex w-full max-w-[1500px] flex-col gap-6"
        data-testid="screenplay-canvas"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.18em] text-amber-600 uppercase">
              <FilmIcon className="size-3.5" />
              Storyboard overview
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">剧本节奏总览</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              从集到场，再到镜头，快速看见故事如何向前推进。
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{episodes.length} 集</span>
            <span>{episodes.reduce((sum, episode) => sum + episode.scenes.length, 0)} 场</span>
            <span>
              {episodes.reduce(
                (sum, episode) =>
                  sum + episode.scenes.reduce((sceneSum, scene) => sceneSum + scene.shotCount, 0),
                0,
              )}{' '}
              镜头
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {episodes.map((episode) => {
            const isCollapsed = collapsed.has(episode.id)
            return (
              <section key={episode.id} className="relative" data-testid={`episode-${episode.id}`}>
                <EpisodeHeader
                  episode={episode}
                  expanded={!isCollapsed}
                  onToggle={() => toggleEpisode(episode.id)}
                />
                {!isCollapsed && (
                  <div className="relative mt-3 pl-4">
                    <div
                      className="absolute top-0 bottom-0 left-[13px] w-px bg-border"
                      aria-hidden="true"
                    />
                    <ScrollArea
                      orientation="horizontal"
                      className="min-w-0 pb-2"
                      viewportClassName="snap-x"
                      contentClassName="flex gap-3 pl-4"
                    >
                      {episode.scenes.map((scene, index) => (
                        <React.Fragment key={scene.id}>
                          <SceneCard
                            scene={scene}
                            episode={episode}
                            index={index}
                            selected={selectedSceneId === scene.id}
                            expanded={expandedSceneId === scene.id}
                            onSelect={() => selectScene(scene)}
                            onEdit={() => onEditScene(scene)}
                            onMove={(to) => onReorderScene(episode, index, to)}
                            onReorderShot={(from, to) => onReorderShot(scene, from, to)}
                          />
                          {index < episode.scenes.length - 1 && (
                            <div className="flex w-5 shrink-0 items-center" aria-hidden="true">
                              <div className="h-px w-full bg-border" />
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </ScrollArea>
                  </div>
                )}
                {(episode.hook || episode.cliffhanger) && !isCollapsed && (
                  <div className="mt-3 grid gap-2 pl-12 md:grid-cols-2">
                    {episode.hook && (
                      <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-[11px]">
                        <span className="font-medium text-amber-600">开头钩子</span>
                        <p className="mt-1 text-muted-foreground">{episode.hook}</p>
                      </div>
                    )}
                    {episode.cliffhanger && (
                      <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-[11px]">
                        <span className="font-medium text-amber-600">结尾卡点</span>
                        <p className="mt-1 text-muted-foreground">{episode.cliffhanger}</p>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>

        {unorganized.length > 0 && (
          <section
            className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4"
            data-testid="unorganized-documents"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <AlertTriangleIcon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold">未整理文件</h2>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={onOrganize}
                    disabled={organizeDisabled}
                    title={
                      organizeDisabled ? '需要可用的写作教练，且当前没有正在运行的任务' : undefined
                    }
                  >
                    <WandSparklesIcon />
                    一键整理
                  </Button>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  这些 Markdown 仍被保留，但尚未识别出分集、场景或镜头结构。打开文件即可继续整理。
                </p>
                <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {unorganized.map((document) => (
                    <button
                      key={document.path}
                      type="button"
                      className="flex min-w-0 items-center gap-2 rounded-md border border-border/70 bg-background/70 px-2.5 py-2 text-left transition-colors hover:border-amber-500/50 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      onClick={() => onOpenDocument(document)}
                    >
                      <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                        {document.title}
                      </span>
                      <span className="max-w-[45%] truncate font-mono text-[9px] text-muted-foreground">
                        {document.path}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </ScrollArea>
  )
}
