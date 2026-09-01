import { useNavigate } from '@tanstack/react-router'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClapperboardIcon,
  FileTextIcon,
  GaugeIcon,
  Layers3Icon,
  ListChecksIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  RefreshCwIcon,
  SparklesIcon,
  UsersIcon,
} from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { MarkdownEditor } from '@/components/editor/markdown-editor'
import { AppHeader } from '@/components/layout/app-header'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { UiMessage } from '@/lib/agent/use-agent-chat'
import { createAgentServerClient, type AgentProposal } from '@/lib/ai/server-client'
import {
  getAiSettings,
  isModelUsable,
  resolveDefaultModel,
  type AiSettings,
  type ModelRef,
} from '@/lib/ai/settings-bridge'
import {
  createChatSession,
  listChatMessages,
  listChatSessions,
  updateChatSessionConfig,
  type ChatSession,
} from '@/lib/db/chat-repo'
import { getProject, listTabs, type Project } from '@/lib/db/project-repo'
import { api } from '@/lib/electron/api'
import {
  defaultProjectConfig,
  readProjectConfig,
  withProjectDefaultMode,
  writeProjectConfig,
  type ProjectDefaultMode,
} from '@/lib/project/project-config'
import { useProjectStore } from '@/lib/store/project-store'

import { ScreenplayCanvas } from './screenplay-canvas'
import { ScreenplayChangePreview } from './screenplay-change-preview'
import {
  reorderShotBlocks,
  updateEpisodeOutlineSceneOrder,
  updateFrontmatterOrder,
} from './screenplay-document'
import { loadScreenplayIndex } from './screenplay-index'
import { ScreenplaySceneEditor } from './screenplay-scene-editor'
import { ScreenplayWritingCoach } from './screenplay-writing-coach'
import type {
  EpisodeSummary,
  SceneSummary,
  ScreenplayCanvasData,
  ScreenplayDocumentRef,
  ScreenplayMode,
} from './types'

interface ScreenplayWorkbenchProps {
  projectId: string
  initialMode?: ScreenplayMode
  initialDocumentPath?: string
}

interface ScriptMapProps {
  data: ScreenplayCanvasData
  selectedSceneId: string | null
  onSelectScene: (scene: SceneSummary) => void
  onOpenDocument: (document: ScreenplayDocumentRef) => void
}

const EMPTY_CANVAS: ScreenplayCanvasData = {
  rootPath: '',
  projectTitle: '',
  episodes: [],
  characters: [],
  continuity: [],
  unorganized: [],
  totalDuration: 0,
  totalScenes: 0,
  totalShots: 0,
  warningCount: 0,
}

function chooseModel(settings: AiSettings, session: ChatSession | null): ModelRef | null {
  if (session?.provider_id && session.model_id) {
    const stored = { providerId: session.provider_id, modelId: session.model_id }
    if (isModelUsable(settings, stored)) return stored
  }
  return resolveDefaultModel(settings) ?? null
}

function formatDuration(seconds: number): string {
  if (!seconds) return '未计时'
  if (seconds < 60) return `${seconds} 秒`
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
}

function findScene(data: ScreenplayCanvasData, id: string | null): SceneSummary | null {
  if (!id) return null
  for (const episode of data.episodes) {
    const scene = episode.scenes.find((item) => item.id === id)
    if (scene) return scene
  }
  return null
}

function allScenes(data: ScreenplayCanvasData): SceneSummary[] {
  return data.episodes.flatMap((episode) => episode.scenes)
}

function makeLocalProposal(
  title: string,
  changes: Array<{ path: string; beforeText: string; afterText: string; summary: string }>,
): AgentProposal {
  return {
    id: `local-${crypto.randomUUID()}`,
    title,
    changes: changes.map((change) => ({
      ...change,
      operation: 'update' as const,
      beforeHash: 'local',
    })),
  }
}

const ORGANIZE_PROMPT = `请整理当前项目中的剧本 Markdown 结构。

先使用 list_files 和 read_file 扫描项目中的 Markdown 文件，并忽略 .kenvo、.git 以及其他隐藏目录。根据剧本约定识别总纲、故事设定、人物、连续性、分集大纲和场景文件。

整理边界：优先只移动或改名文件，保留正文内容和未知字段；只有为了让剧本索引识别文件时，才补齐最小 frontmatter 或索引。不要重写正文，不要拆分或合并文档，不要删除文件。所有移动和修改都必须使用 propose_file_change，移动使用 operation=move 和 from_path。目标路径已存在时不要覆盖，保留为未整理并说明原因。完成后生成一份可审核的结构整理提案。`

async function applyLocalProposal(rootPath: string, proposal: AgentProposal): Promise<void> {
  for (const change of proposal.changes) {
    const current = await api.fs.readTextFile(`${rootPath}/${change.path}`)
    if (current !== change.beforeText) {
      throw new Error(`文件在预览后发生变化：${change.path}`)
    }
  }
  for (const change of proposal.changes) {
    await api.fs.writeTextFile(`${rootPath}/${change.path}`, change.afterText ?? '')
  }
}

function ScriptMap({ data, selectedSceneId, onSelectScene, onOpenDocument }: ScriptMapProps) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())
  const toggle = (id: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <aside
      className="flex min-h-0 flex-col border-r border-border bg-muted/[0.16]"
      aria-label="剧本地图"
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <ClapperboardIcon className="size-4 text-amber-600" />
        <span className="text-xs font-semibold">剧本地图</span>
      </div>
      <ScrollArea className="min-h-0 flex-1" contentClassName="px-2 py-2">
        <div className="flex flex-col gap-1">
          <MapDocumentButton
            icon={<FileTextIcon />}
            label="总纲"
            document={data.outline}
            onOpen={onOpenDocument}
          />
          <MapDocumentButton
            icon={<SparklesIcon />}
            label="视觉设定"
            document={data.storyBible}
            onOpen={onOpenDocument}
          />

          <MapSectionLabel icon={<Layers3Icon />} label="分集" />
          {data.episodes.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">还没有分集</p>
          ) : (
            data.episodes.map((episode) => {
              const isCollapsed = collapsed.has(episode.id)
              return (
                <div key={episode.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={() => toggle(episode.id)}
                    aria-expanded={!isCollapsed}
                  >
                    {isCollapsed ? (
                      <PanelLeftOpenIcon className="size-3 text-muted-foreground" />
                    ) : (
                      <PanelLeftCloseIcon className="size-3 text-muted-foreground" />
                    )}
                    <span className="font-mono text-[10px] text-amber-600">
                      {String(episode.order).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{episode.title}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {episode.scenes.length}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="ml-4 border-l border-border pl-1">
                      {episode.scenes.map((scene) => (
                        <button
                          key={scene.id}
                          type="button"
                          className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${selectedSceneId === scene.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
                          onClick={() => onSelectScene(scene)}
                        >
                          <span className="font-mono text-[10px] text-amber-600">
                            {String(scene.order).padStart(2, '0')}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{scene.title}</span>
                          {scene.warningCount > 0 && (
                            <AlertTriangleIcon className="size-3 shrink-0 text-amber-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}

          <MapSectionLabel icon={<UsersIcon />} label="人物" />
          {data.characters.map((document) => (
            <MapDocumentButton
              key={document.path}
              icon={<UsersIcon />}
              label={document.title}
              document={document}
              onOpen={onOpenDocument}
              compact
            />
          ))}
          {data.characters.length === 0 && (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">人物库为空</p>
          )}

          <MapSectionLabel icon={<ListChecksIcon />} label="连续性" />
          {data.continuity.map((document) => (
            <MapDocumentButton
              key={document.path}
              icon={<ListChecksIcon />}
              label={document.title}
              document={document}
              onOpen={onOpenDocument}
              compact
            />
          ))}

          <MapSectionLabel icon={<AlertTriangleIcon />} label="未整理" />
          {data.unorganized.map((document) => (
            <MapDocumentButton
              key={document.path}
              icon={<AlertTriangleIcon />}
              label={document.title}
              document={document}
              onOpen={onOpenDocument}
              compact
            />
          ))}
          {data.unorganized.length === 0 && (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">没有未整理文件</p>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}

function MapSectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="mt-3 flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
      {icon}
      {label}
    </div>
  )
}

function MapDocumentButton({
  icon,
  label,
  document,
  onOpen,
  compact = false,
}: {
  icon: React.ReactNode
  label: string
  document?: ScreenplayDocumentRef
  onOpen: (document: ScreenplayDocumentRef) => void
  compact?: boolean
}) {
  if (!document) {
    return (
      <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground/60">
        {icon}
        {label}待创建
      </div>
    )
  }
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${compact ? 'text-[11px]' : ''}`}
      onClick={() => onOpen(document)}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}

function AuditPanel({
  data,
  onSelectScene,
  onRefresh,
}: {
  data: ScreenplayCanvasData
  onSelectScene: (scene: SceneSummary) => void
  onRefresh: () => void
}) {
  const issues = data.episodes.flatMap((episode) =>
    episode.scenes.flatMap((scene) =>
      scene.warnings.map((message, index) => ({ scene, message, index })),
    ),
  )
  return (
    <ScrollArea
      className="h-full"
      viewportClassName="px-6 py-6"
      contentClassName="mx-auto w-full max-w-3xl pb-10"
    >
      <div className="flex flex-col gap-5" data-testid="screenplay-audit">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.18em] text-amber-600 uppercase">
              <ListChecksIcon className="size-3.5" />
              Continuity desk
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">剧本维护检查</h1>
            <p className="mt-1 text-xs text-muted-foreground">这些是建议，不会阻止你继续创作。</p>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCwIcon />
            重新检查
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <AuditStat label="场景" value={String(data.totalScenes)} />
          <AuditStat label="镜头" value={String(data.totalShots)} />
          <AuditStat
            label="提醒"
            value={String(data.warningCount)}
            warning={data.warningCount > 0}
          />
        </div>
        {issues.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-5 py-12 text-center">
            <CheckCircle2Icon className="size-7 text-emerald-600" />
            <p className="text-sm font-medium">当前没有结构提醒</p>
            <p className="text-xs text-muted-foreground">
              继续写作，新的文件变化会自动刷新检查结果。
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {issues.map(({ scene, message, index }) => (
              <button
                key={`${scene.id}-${index}`}
                type="button"
                className="flex items-start gap-3 rounded-lg border border-border/70 bg-card px-3 py-3 text-left transition-colors hover:border-amber-500/50 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() => onSelectScene(scene)}
              >
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">{message}</span>
                  <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                    {scene.path}
                  </span>
                </span>
                <ArrowLeftIcon className="mt-0.5 size-3 rotate-180 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

function AuditStat({
  label,
  value,
  warning = false,
}: {
  label: string
  value: string
  warning?: boolean
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${warning ? 'text-amber-600' : ''}`}>{value}</p>
    </div>
  )
}

export function ScreenplayWorkbench({
  projectId,
  initialMode,
  initialDocumentPath,
}: ScreenplayWorkbenchProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [project, setProject] = React.useState<Project | null>(null)
  const [data, setData] = React.useState<ScreenplayCanvasData>(EMPTY_CANVAS)
  const [selectedSceneId, setSelectedSceneId] = React.useState<string | null>(null)
  const [view, setView] = React.useState<ScreenplayMode>(initialMode ?? 'canvas')
  const [documentPath, setDocumentPath] = React.useState<string | null>(initialDocumentPath ?? null)
  const [serverPort, setServerPort] = React.useState<number | null>(null)
  const [session, setSession] = React.useState<ChatSession | null>(null)
  const [historyMessages, setHistoryMessages] = React.useState<UiMessage[]>([])
  const [settings, setSettings] = React.useState<AiSettings | null>(null)
  const [skills, setSkills] = React.useState<{ id: string; name: string; description: string }[]>(
    [],
  )
  const [providers, setProviders] = React.useState<
    {
      id: string
      name: string
      iconKey: string
      description: string
      recommended?: boolean
      defaultBaseUrl: string
      configured: boolean
      enabled: boolean
    }[]
  >([])
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [serverReady, setServerReady] = React.useState(false)
  const [serverProposals, setServerProposals] = React.useState<AgentProposal[]>([])
  const [localProposals, setLocalProposals] = React.useState<AgentProposal[]>([])
  const [proposalBusy, setProposalBusy] = React.useState(false)
  const [agentRunning, setAgentRunning] = React.useState(false)
  const [organizeRequest, setOrganizeRequest] = React.useState<{
    id: string
    text: string
  } | null>(null)

  const selectedScene = findScene(data, selectedSceneId)
  const allProposals = [...serverProposals, ...localProposals]
  const refreshIndex = React.useCallback(async () => {
    if (!project) return
    const next = await loadScreenplayIndex(project.path, project.title)
    setData(next)
    useProjectStore.getState().bumpTree()
    setSelectedSceneId((current) => (current && findScene(next, current) ? current : null))
  }, [project])

  const refreshProposals = React.useCallback(async () => {
    if (!serverPort || !session) return
    try {
      setServerProposals(await createAgentServerClient(serverPort).getProposals(session.id))
    } catch {
      setServerProposals([])
    }
  }, [serverPort, session])

  const persistDefaultMode = React.useCallback(
    async (mode: ProjectDefaultMode) => {
      if (!project) return
      const result = await readProjectConfig(project.path)
      if (result.status === 'invalid') return
      const config = result.status === 'valid' ? result.config : defaultProjectConfig('blank')
      await writeProjectConfig(project.path, withProjectDefaultMode(config, mode))
    },
    [project],
  )

  const changeMode = React.useCallback(
    (next: ScreenplayMode, nextDocumentPath: string | null = null) => {
      setView(next)
      setDocumentPath(next === 'editor' ? nextDocumentPath : null)
      void navigate({
        to: '/screenplay/$projectId',
        params: { projectId },
        search:
          next === 'editor' && nextDocumentPath
            ? { mode: next, file: nextDocumentPath }
            : { mode: next },
      }).catch((error: unknown) => {
        setServerError(error instanceof Error ? error.message : String(error))
      })
      if (next === 'canvas' || next === 'audit') {
        void persistDefaultMode(next).catch((error: unknown) => {
          setServerError(error instanceof Error ? error.message : String(error))
        })
      }
    },
    [navigate, persistDefaultMode, projectId],
  )

  React.useEffect(() => {
    if (!initialMode) return
    setView(initialMode)
    setDocumentPath(initialMode === 'editor' ? (initialDocumentPath ?? null) : null)
  }, [initialDocumentPath, initialMode])

  React.useEffect(() => {
    let cancelled = false
    const resolve = async () => {
      try {
        let status = await api.agentServer.status()
        if (!status.running) {
          await api.agentServer.start().catch(() => {})
          status = await api.agentServer.status()
        }
        if (!cancelled) setServerPort(status.running ? status.port : null)
      } catch {
        if (!cancelled) setServerError(t('agent.serverStopped'))
      }
    }
    void resolve()
    const unlisten = api.agentServer.onStopped(() => setServerPort(null))
    return () => {
      cancelled = true
      unlisten()
    }
  }, [t])

  React.useEffect(() => {
    let cancelled = false
    let createdSessionId: string | null = null
    const setup = async () => {
      try {
        const foundProject = await getProject(projectId)
        if (!foundProject) throw new Error('找不到这个项目。')
        const projectConfig = await readProjectConfig(foundProject.path)
        if (!initialMode && projectConfig.status === 'valid') {
          setView(projectConfig.config.screenplay.defaultMode)
          setDocumentPath(null)
        }
        const nextData = await loadScreenplayIndex(foundProject.path, foundProject.title)
        const aiSettings = await getAiSettings()
        const client = serverPort ? createAgentServerClient(serverPort) : null
        if (client) {
          for (const provider of aiSettings.providers) {
            if (provider.apiKey)
              await client.configureProvider(provider.id, {
                apiKey: provider.apiKey,
                baseUrl: provider.baseUrl,
                enabled: provider.enabled,
              })
          }
        }
        const availableSkills = client ? await client.getSkills().catch(() => []) : []
        const availableProviders = client ? await client.getProviders().catch(() => []) : []
        if (cancelled) return
        setProject(foundProject)
        setData(nextData)
        setSettings(aiSettings)
        setSkills(availableSkills)
        setProviders(availableProviders)
        const tabs = await listTabs(foundProject.id)
        useProjectStore.getState().hydrate(foundProject, tabs)

        const projectSessions = await listChatSessions(foundProject.id)
        const existing = projectSessions.find((item) => item.skill_id === 'screenwriter') ?? null
        const model = chooseModel(aiSettings, existing)
        if (!model) {
          setSession(null)
          setHistoryMessages([])
          setServerReady(Boolean(client))
          setServerError(t('agent.noModel'))
          return
        }
        const nextSession =
          existing ??
          (await createChatSession(
            foundProject.id,
            'screenwriter',
            model.providerId,
            model.modelId,
          ))
        if (
          existing &&
          (existing.provider_id !== model.providerId || existing.model_id !== model.modelId)
        ) {
          await updateChatSessionConfig(existing.id, {
            providerId: model.providerId,
            modelId: model.modelId,
          })
        }
        const rows = await listChatMessages(nextSession.id)
        const history = rows.map((row) => JSON.parse(row.message))
        if (client) {
          await client.destroySession(nextSession.id).catch(() => {})
          await client.createSession({
            sessionId: nextSession.id,
            skillId: 'screenwriter',
            projectRoot: foundProject.path,
            providerId: model.providerId,
            modelId: model.modelId,
            history,
            writePolicy: 'proposal',
          })
          createdSessionId = nextSession.id
        }
        if (cancelled) return
        setSession({ ...nextSession, provider_id: model.providerId, model_id: model.modelId })
        setHistoryMessages(history as UiMessage[])
        setServerReady(Boolean(client))
        setServerError(null)
      } catch (error) {
        if (!cancelled) setServerError(error instanceof Error ? error.message : String(error))
      }
    }
    if (serverPort) void setup()
    return () => {
      cancelled = true
      if (createdSessionId && serverPort) {
        void createAgentServerClient(serverPort)
          .destroySession(createdSessionId)
          .catch(() => {})
      }
    }
  }, [initialMode, projectId, serverPort, t])

  React.useEffect(() => {
    if (!project) return
    const unlisten = api.fs.onFileChanged((payload) => {
      if (payload.path.startsWith(`${project.path}/`)) void refreshIndex()
    })
    return unlisten
  }, [project, refreshIndex])

  const handleSelectScene = (scene: SceneSummary) => {
    setSelectedSceneId(scene.id)
    setDocumentPath(null)
  }

  const handleEditScene = (scene: SceneSummary) => {
    setSelectedSceneId(scene.id)
    changeMode('editor', scene.path)
  }

  const handleOpenDocument = (document: ScreenplayDocumentRef) => {
    changeMode('editor', document.path)
  }

  const handleOrganize = () => {
    if (!session || !serverPort || agentRunning || proposalBusy) return
    setServerError(null)
    setOrganizeRequest({ id: crypto.randomUUID(), text: ORGANIZE_PROMPT })
  }

  const handleReorderScene = async (episode: EpisodeSummary, from: number, to: number) => {
    if (!project || to < 0 || to >= episode.scenes.length || from === to) return
    const ordered = [...episode.scenes]
    const [moved] = ordered.splice(from, 1)
    ordered.splice(to, 0, moved)
    const changes: Array<{ path: string; beforeText: string; afterText: string; summary: string }> =
      []
    for (let index = 0; index < ordered.length; index += 1) {
      const item = ordered[index]
      const beforeText = await api.fs.readTextFile(`${project.path}/${item.path}`)
      const afterText = updateFrontmatterOrder(beforeText, index + 1)
      if (afterText !== beforeText)
        changes.push({
          path: item.path,
          beforeText,
          afterText,
          summary: `将「${item.title}」调整为第 ${index + 1} 场`,
        })
    }
    if (episode.path) {
      const outlinePath = episode.path
      const beforeText = await api.fs.readTextFile(`${project.path}/${outlinePath}`)
      const afterText = updateEpisodeOutlineSceneOrder(
        beforeText,
        ordered.map((item) => ({ path: item.path, title: item.title })),
      )
      if (afterText !== beforeText) {
        changes.push({
          path: outlinePath,
          beforeText,
          afterText,
          summary: `同步「${episode.title}」的场景顺序`,
        })
      }
    }
    if (changes.length > 0)
      setLocalProposals((previous) => [
        ...previous.filter((item) => !item.id.startsWith('local-')),
        makeLocalProposal('调整场景顺序', changes),
      ])
  }

  const handleReorderShot = async (scene: SceneSummary, from: number, to: number) => {
    if (!project || from === to) return
    const beforeText = await api.fs.readTextFile(`${project.path}/${scene.path}`)
    const afterText = reorderShotBlocks(beforeText, from, to)
    if (afterText === beforeText) return
    const proposal = makeLocalProposal('调整镜头顺序', [
      { path: scene.path, beforeText, afterText, summary: `调整「${scene.title}」中的镜头顺序` },
    ])
    setLocalProposals((previous) => [
      ...previous.filter((item) => !item.id.startsWith('local-')),
      proposal,
    ])
  }

  const handleApplyProposal = async (proposal: AgentProposal) => {
    if (!project || !serverPort) return
    setProposalBusy(true)
    try {
      if (proposal.id.startsWith('local-')) {
        await applyLocalProposal(project.path, proposal)
        setLocalProposals((previous) => previous.filter((item) => item.id !== proposal.id))
      } else {
        if (!session) return
        const applied = await createAgentServerClient(serverPort).applyProposal(
          session.id,
          proposal.id,
        )
        for (const change of applied.changes) {
          if (change.operation === 'move' && change.fromPath) {
            await useProjectStore.getState().remapFilePath(change.fromPath, change.path)
          }
        }
        await refreshProposals()
      }
      await refreshIndex()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : String(error))
    } finally {
      setProposalBusy(false)
    }
  }

  const handleDiscardProposal = async (proposal: AgentProposal) => {
    if (proposal.id.startsWith('local-')) {
      setLocalProposals((previous) => previous.filter((item) => item.id !== proposal.id))
      return
    }
    if (!serverPort || !session) return
    await createAgentServerClient(serverPort)
      .discardProposal(session.id, proposal.id)
      .catch(() => {})
    await refreshProposals()
  }

  const handleConfigChange = async (update: {
    skillId?: string
    providerId?: string
    modelId?: string
  }) => {
    if (!session || !project || !serverPort || !settings || !update.providerId || !update.modelId)
      return
    const nextSkill = update.skillId ?? 'screenwriter'
    const client = createAgentServerClient(serverPort)
    const rows = await listChatMessages(session.id)
    await updateChatSessionConfig(session.id, {
      skillId: nextSkill,
      providerId: update.providerId,
      modelId: update.modelId,
    })
    await client.destroySession(session.id).catch(() => {})
    await client.createSession({
      sessionId: session.id,
      skillId: nextSkill,
      projectRoot: project.path,
      providerId: update.providerId,
      modelId: update.modelId,
      history: rows.map((row) => JSON.parse(row.message)),
      writePolicy: nextSkill === 'screenwriter' ? 'proposal' : 'direct',
    })
    setSession((previous) =>
      previous
        ? {
            ...previous,
            skill_id: nextSkill,
            provider_id: update.providerId ?? previous.provider_id,
            model_id: update.modelId ?? previous.model_id,
          }
        : previous,
    )
  }

  const onAgentEnd = () => {
    void refreshProposals()
    void refreshIndex()
  }

  if (!project || !settings) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background px-6 text-center">
        <div className="max-w-sm">
          <p className="text-sm font-medium">{serverError || '正在准备剧本工作台…'}</p>
          {!serverReady && serverError && (
            <p className="mt-2 text-xs text-muted-foreground">{t('agent.serverStopped')}</p>
          )}
          <Button
            className="mt-4"
            variant="outline"
            size="sm"
            onClick={() => void navigate({ to: '/' })}
          >
            <ArrowLeftIcon />
            返回工作台
          </Button>
        </div>
      </div>
    )
  }

  const modelRef =
    session?.provider_id && session?.model_id
      ? { providerId: session.provider_id, modelId: session.model_id }
      : null
  const sceneForEditor = selectedScene
  const documentForEditor = documentPath ? `${project.path}/${documentPath}` : null

  return (
    <div
      className="flex h-screen w-screen min-w-0 flex-col overflow-hidden bg-background"
      data-testid="screenplay-workbench"
    >
      <AppHeader
        leftContent={
          <Button variant="ghost" size="sm" onClick={() => void navigate({ to: '/' })}>
            <ArrowLeftIcon />
            返回工作台
          </Button>
        }
        centerContent={
          <div className="flex min-w-0 items-center gap-2">
            <ClapperboardIcon className="size-3.5 shrink-0 text-amber-600" />
            <span className="truncate text-xs font-medium">{project.title}</span>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t('projectViews.switchView')}
              >
                <span>/ {t('projectViews.screenplay.title')}</span>
                <ChevronDownIcon className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuRadioGroup value="screenplay">
                  <DropdownMenuRadioItem value="screenplay" className="text-xs">
                    {t('projectViews.screenplay.title')}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
        rightContent={
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{data.totalScenes} 场</span>
            <span>{data.totalShots} 镜头</span>
            <span>{formatDuration(data.totalDuration)}</span>
          </div>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(180px,220px)_minmax(0,1fr)_minmax(300px,360px)]">
        <ScriptMap
          data={data}
          selectedSceneId={selectedSceneId}
          onSelectScene={handleSelectScene}
          onOpenDocument={handleOpenDocument}
        />
        <main className="flex min-h-0 min-w-0 flex-col">
          <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-3">
            <ViewButton
              active={view === 'canvas'}
              onClick={() => changeMode('canvas')}
              icon={<GaugeIcon />}
              label="总览 Canvas"
            />
            <ViewButton
              active={view === 'editor'}
              onClick={() => changeMode('editor', documentPath)}
              icon={<FileTextIcon />}
              label="场景编辑"
              disabled={!selectedScene && !documentPath}
            />
            <ViewButton
              active={view === 'audit'}
              onClick={() => changeMode('audit')}
              icon={<ListChecksIcon />}
              label="维护检查"
            />
            <span className="ml-auto text-[10px] text-muted-foreground">
              {data.warningCount > 0 ? `${data.warningCount} 个提醒` : '结构清晰'}
            </span>
          </div>
          {serverError && (
            <div
              role="alert"
              className="mx-3 mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 flex-1">{serverError}</span>
            </div>
          )}
          <div className="min-h-0 flex-1">
            {view === 'canvas' && (
              <ScreenplayCanvas
                episodes={data.episodes}
                unorganized={data.unorganized}
                selectedSceneId={selectedSceneId}
                onOrganize={handleOrganize}
                organizeDisabled={!session || !serverPort || agentRunning || proposalBusy}
                onSelectScene={handleSelectScene}
                onEditScene={handleEditScene}
                onOpenDocument={handleOpenDocument}
                onReorderScene={handleReorderScene}
                onReorderShot={handleReorderShot}
              />
            )}
            {view === 'audit' && (
              <AuditPanel
                data={data}
                onSelectScene={handleEditScene}
                onRefresh={() => void refreshIndex()}
              />
            )}
            {view === 'editor' && sceneForEditor && !documentForEditor && (
              <ScreenplaySceneEditor
                rootPath={project.path}
                scene={sceneForEditor}
                onBack={() => changeMode('canvas')}
                onSaved={() => void refreshIndex()}
                onNavigate={(direction) => {
                  const scenes = allScenes(data)
                  const index = scenes.findIndex((item) => item.id === sceneForEditor.id)
                  const next = scenes[direction === 'previous' ? index - 1 : index + 1]
                  if (next) setSelectedSceneId(next.id)
                }}
              />
            )}
            {view === 'editor' && documentForEditor && (
              <MarkdownDocumentView filePath={documentForEditor} />
            )}
            {view === 'editor' && !sceneForEditor && !documentForEditor && (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                请先从左侧选择一个场景。
              </div>
            )}
          </div>
        </main>
        {session ? (
          <ScreenplayWritingCoach
            sessionId={session.id}
            skillId={session.skill_id}
            modelRef={modelRef}
            skills={skills}
            providers={providers}
            settings={settings}
            serverPort={serverPort}
            initialMessages={historyMessages}
            selectedScene={selectedScene}
            organizeRequest={organizeRequest}
            proposals={allProposals}
            proposalBusy={proposalBusy}
            onConfigChange={(update) => void handleConfigChange(update)}
            onFileActivity={() => void refreshIndex()}
            onSessionActivity={() => {}}
            onRunningChange={setAgentRunning}
            onAgentEnd={onAgentEnd}
            onApplyProposal={(proposal) => void handleApplyProposal(proposal)}
            onDiscardProposal={(proposal) => void handleDiscardProposal(proposal)}
          />
        ) : (
          <CoachUnavailable
            message={serverError ?? t('agent.noModel')}
            proposals={allProposals}
            proposalBusy={proposalBusy}
            onApplyProposal={(proposal) => void handleApplyProposal(proposal)}
            onDiscardProposal={(proposal) => void handleDiscardProposal(proposal)}
          />
        )}
      </div>
    </div>
  )
}

function ViewButton({
  active,
  onClick,
  icon,
  label,
  disabled = false,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  disabled?: boolean
}) {
  return (
    <Button
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      {label}
    </Button>
  )
}

function MarkdownDocumentView({ filePath }: { filePath: string }) {
  return <MarkdownEditor filePath={filePath} />
}

function CoachUnavailable({
  message,
  proposals,
  proposalBusy,
  onApplyProposal,
  onDiscardProposal,
}: {
  message: string
  proposals: AgentProposal[]
  proposalBusy: boolean
  onApplyProposal: (proposal: AgentProposal) => void
  onDiscardProposal: (proposal: AgentProposal) => void
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-border bg-background">
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-amber-600" />
          <span className="text-xs font-semibold">写作教练</span>
        </div>
      </div>
      <ScreenplayChangePreview
        proposals={proposals}
        busy={proposalBusy}
        onApply={onApplyProposal}
        onDiscard={onDiscardProposal}
      />
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div className="max-w-xs">
          <p className="text-sm font-medium">AI 写作暂不可用</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{message}</p>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            Canvas、场景编辑和维护检查仍可继续使用。配置模型后即可启用提案式改稿。
          </p>
        </div>
      </div>
    </aside>
  )
}
