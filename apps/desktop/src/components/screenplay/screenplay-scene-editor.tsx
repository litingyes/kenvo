import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { searchKeymap } from '@codemirror/search'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  Code2Icon,
  FileTextIcon,
  SaveIcon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/electron/api'

import { parseSceneDocument, updateShotField } from './screenplay-document'
import type { SceneSummary } from './types'
import { SHOT_FIELD_LABELS } from './types'

const sourceExtensions = [
  lineNumbers(),
  EditorView.lineWrapping,
  markdown({ base: markdownLanguage }),
  history(),
  keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
]

interface ScreenplaySceneEditorProps {
  rootPath: string
  scene: SceneSummary
  onBack: () => void
  onSaved: () => void
  onNavigate?: (direction: 'previous' | 'next') => void
}

export function ScreenplaySceneEditor({
  rootPath,
  scene: sceneSummary,
  onBack,
  onSaved,
  onNavigate,
}: ScreenplaySceneEditorProps) {
  const { resolvedTheme } = useTheme()
  const { t } = useTranslation()
  const filePath = `${rootPath}/${sceneSummary.path}`
  const [source, setSource] = React.useState<string | null>(null)
  const [dirty, setDirty] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [mode, setMode] = React.useState<'cards' | 'source'>('cards')
  const sourceRef = React.useRef('')
  const dirtyRef = React.useRef(false)
  dirtyRef.current = dirty

  const load = React.useCallback(async () => {
    try {
      const next = await api.fs.readTextFile(filePath)
      sourceRef.current = next
      setSource(next)
      setDirty(false)
    } catch {
      setSource(null)
    }
  }, [filePath])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    void api.fs.watch(filePath).catch(() => {})
    const unlisten = api.fs.onFileChanged((payload) => {
      if (payload.path !== filePath || dirtyRef.current) return
      void load()
    })
    return () => {
      unlisten()
      void api.fs.unwatch(filePath).catch(() => {})
    }
  }, [filePath, load])

  const updateSource = React.useCallback((next: string) => {
    sourceRef.current = next
    setSource(next)
    setDirty(true)
  }, [])

  const save = React.useCallback(async () => {
    if (!dirtyRef.current || saving) return
    setSaving(true)
    try {
      await api.fs.writeTextFile(filePath, sourceRef.current)
      setDirty(false)
      onSaved()
    } finally {
      setSaving(false)
    }
  }, [filePath, onSaved, saving])

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save])

  if (source === null) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        加载场景中…
      </div>
    )
  }

  const parsed = parseSceneDocument(source, sceneSummary.path)

  return (
    <div className="flex h-full min-h-0 flex-col bg-background" data-testid="scene-editor">
      <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          aria-label="返回总览"
          title="返回总览"
          className="shrink-0 px-2 xl:px-3"
        >
          <ArrowLeftIcon />
          <span className="hidden xl:inline">返回总览</span>
        </Button>
        <div className="h-4 w-px bg-border" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{parsed.title}</p>
          <p className="truncate text-[10px] text-muted-foreground">{sceneSummary.path}</p>
        </div>
        {dirty ? (
          <Badge
            variant="outline"
            className="shrink-0 text-[10px] text-amber-600"
            aria-label="未保存"
            title="未保存"
          >
            未保存
          </Badge>
        ) : (
          <span
            className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground"
            title="已保存"
          >
            <CheckIcon className="size-3 text-emerald-600" />
            <span className="hidden xl:inline">已保存</span>
          </span>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant={mode === 'cards' ? 'secondary' : 'ghost'}
            size="xs"
            onClick={() => setMode('cards')}
            aria-label="镜头卡片"
            title="镜头卡片"
            className="px-2 xl:px-2.5"
          >
            <FileTextIcon />
            <span className="hidden xl:inline">镜头卡片</span>
          </Button>
          <Button
            variant={mode === 'source' ? 'secondary' : 'ghost'}
            size="xs"
            onClick={() => setMode('source')}
            aria-label="源码"
            title="源码"
            className="px-2 xl:px-2.5"
          >
            <Code2Icon />
            <span className="hidden xl:inline">源码</span>
          </Button>
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={!dirty || saving}
            aria-label={saving ? '保存中' : t('common.save')}
            title={saving ? '保存中' : t('common.save')}
            className="px-2 xl:px-3"
          >
            <SaveIcon />
            <span className="hidden xl:inline">{saving ? '保存中…' : t('common.save')}</span>
          </Button>
        </div>
      </div>

      {mode === 'source' ? (
        <CodeMirror
          value={source}
          onChange={updateSource}
          extensions={sourceExtensions}
          theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          height="100%"
          style={{ height: '100%', fontSize: '13px' }}
          basicSetup={false}
        />
      ) : (
        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="px-5 py-5"
          contentClassName="mx-auto w-full max-w-4xl pb-12"
        >
          <div className="flex flex-col gap-4">
            <div className="grid gap-2 min-[1100px]:grid-cols-3">
              <MetaItem label="地点" value={parsed.location || '待补充'} />
              <MetaItem label="时间" value={parsed.time || '待补充'} />
              <MetaItem label="时长" value={parsed.duration ? `${parsed.duration} 秒` : '待计时'} />
            </div>
            <Card className="border-l-2 border-l-amber-500/70">
              <CardHeader className="px-4 py-3">
                <CardTitle className="text-sm">场景意图</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 px-4 pb-4 min-[1100px]:grid-cols-3">
                <MetaItem label="摘要" value={parsed.summary || '待补充'} stacked />
                <MetaItem label="冲突" value={parsed.conflict || '待补充'} stacked />
                <MetaItem label="戏剧变化" value={parsed.turn || '待补充'} stacked />
              </CardContent>
            </Card>
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-sm font-semibold">镜头序列</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  每张卡片都应能被看见、听见并直接用于视频生成。
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onNavigate?.('previous')}
                  aria-label="上一场"
                >
                  <ArrowLeftIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onNavigate?.('next')}
                  aria-label="下一场"
                >
                  <ArrowRightIcon />
                </Button>
              </div>
            </div>
            {parsed.shots.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-xs text-muted-foreground">
                  <ClapperboardPlaceholder />
                  还没有镜头卡片，请切换到源码模式或让写作教练拆分镜头。
                </CardContent>
              </Card>
            ) : (
              parsed.shots.map((shot) => (
                <Card key={shot.id} className="overflow-visible border-l-2 border-l-amber-500/40">
                  <CardHeader className="flex flex-row items-center gap-2 px-4 py-3">
                    <span className="flex size-7 items-center justify-center rounded-md bg-amber-500/10 font-mono text-xs text-amber-600">
                      {String(shot.order).padStart(2, '0')}
                    </span>
                    <CardTitle className="text-sm">{shot.heading}</CardTitle>
                    <span className="ml-auto text-[10px] text-muted-foreground">镜头提示</span>
                  </CardHeader>
                  <CardContent className="grid gap-3 px-4 pb-4 md:grid-cols-2">
                    {SHOT_FIELD_LABELS.map((label) => (
                      <label key={label} className="grid gap-1.5">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {label}
                        </span>
                        <Textarea
                          value={shot.fields[label] ?? ''}
                          onChange={(event) =>
                            updateSource(
                              updateShotField(
                                sourceRef.current,
                                shot.order,
                                label,
                                event.target.value,
                              ),
                            )
                          }
                          rows={3}
                          placeholder={`补充${label}…`}
                          className="min-h-16 resize-y text-xs leading-5"
                        />
                      </label>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

function MetaItem({
  label,
  value,
  stacked = false,
}: {
  label: string
  value: string
  stacked?: boolean
}) {
  return (
    <div className={cnMeta(stacked)}>
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <p className="line-clamp-3 text-xs leading-5 text-foreground/85">{value}</p>
    </div>
  )
}

function cnMeta(stacked: boolean): string {
  return stacked
    ? 'grid gap-1 rounded-md border border-border/70 bg-muted/20 p-2.5'
    : 'grid gap-1 rounded-md border border-border/70 bg-muted/20 px-3 py-2'
}

function ClapperboardPlaceholder() {
  return (
    <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
      ∎
    </span>
  )
}
