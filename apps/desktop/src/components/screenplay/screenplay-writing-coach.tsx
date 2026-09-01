import {
  AlignLeftIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  GaugeIcon,
  LightbulbIcon,
  MessageSquareTextIcon,
  RefreshCwIcon,
  SparklesIcon,
  WandSparklesIcon,
  FolderTreeIcon,
} from 'lucide-react'
import * as React from 'react'

import { AgentPanel } from '@/components/agent/agent-panel'
import type { UiMessage } from '@/lib/agent/use-agent-chat'
import type { AgentProposal, ProviderMetadata } from '@/lib/ai/server-client'
import type { AiSettings, ModelRef } from '@/lib/ai/settings-bridge'

import { ScreenplayChangePreview } from './screenplay-change-preview'
import type { SceneSummary, ScreenplayAction } from './types'

interface ScreenplayWritingCoachProps {
  sessionId: string
  skillId: string
  modelRef: ModelRef | null
  skills: { id: string; name: string; description: string }[]
  providers: ProviderMetadata[]
  settings: AiSettings | null
  serverPort: number | null
  initialMessages?: UiMessage[]
  selectedScene: SceneSummary | null
  proposals: AgentProposal[]
  proposalBusy: boolean
  organizeRequest: { id: string; text: string } | null
  onConfigChange: (update: { skillId?: string; providerId?: string; modelId?: string }) => void
  onFileActivity: () => void
  onSessionActivity: () => void
  onRunningChange: (running: boolean) => void
  onAgentEnd: () => void
  onApplyProposal: (proposal: AgentProposal) => void
  onDiscardProposal: (proposal: AgentProposal) => void
}

const ACTIONS: Array<{
  id: ScreenplayAction
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: 'outline', label: '规划总纲', hint: '建立全剧推进线', icon: AlignLeftIcon },
  { id: 'episode-outline', label: '规划分集', hint: '补齐钩子与卡点', icon: CircleDotIcon },
  {
    id: 'scene-breakdown',
    label: '拆分镜头',
    hint: '把场景变成可生成镜头',
    icon: WandSparklesIcon,
  },
  { id: 'scene-draft', label: '生成下一场', hint: '承接当前节奏继续写', icon: SparklesIcon },
  { id: 'revision', label: '强化节奏', hint: '检查钩子、冲突与信息密度', icon: GaugeIcon },
  {
    id: 'continuity-audit',
    label: '维护一致性',
    hint: '找出人物与镜头衔接问题',
    icon: CheckCircle2Icon,
  },
  { id: 'organize', label: '整理结构', hint: '归档未识别的剧本文件', icon: FolderTreeIcon },
]

function actionPrompt(action: ScreenplayAction, scene: SceneSummary | null): string {
  const context = scene
    ? `当前场景：${scene.path}（${scene.title}）。请优先围绕这场戏工作。`
    : '当前未选中具体场景，请先读取项目结构并选择最相关的文件。'
  const instructions: Record<ScreenplayAction, string> = {
    outline: '请检查并完善 outline.md 与 story-bible.md，给出分集推进、视觉规则和伏笔回收建议。',
    'episode-outline': '请围绕当前项目规划或完善一集，强化开头钩子、场内冲突、信息密度和结尾卡点。',
    'scene-breakdown':
      '请把当前场景拆成连续的 AI 视频镜头卡片，每个镜头写清画面、动作、镜头、光色、声音和连续性。',
    'scene-draft': '请基于相邻场景和现有设定生成下一场可直接用于 AI 视频生成的镜头提示脚本。',
    revision: '请提出并准备一轮节奏改稿，重点改善前三秒钩子、冲突升级、可视化动作和结尾牵引。',
    'continuity-audit':
      '请只读检查人物外观、服装、道具、空间、时间、镜头衔接和集尾卡点，并给出可定位的问题。',
    organize:
      '请整理当前项目中的剧本 Markdown 结构。扫描并识别总纲、故事设定、人物、连续性、分集大纲和场景文件；优先只移动或改名文件，保留正文内容和未知字段，必要时只补齐最小 frontmatter 或索引。不要重写正文、拆分或合并文档，不要删除文件，不要覆盖已存在的目标路径。所有移动和修改都必须使用提案工具，移动使用 operation=move 和 from_path。',
  }
  return `${instructions[action]}\n${context}\n所有文件修改必须使用提案工具，先展示改动再等待确认。`
}

export function ScreenplayWritingCoach(props: ScreenplayWritingCoachProps) {
  const [quickPrompt, setQuickPrompt] = React.useState<{ id: string; text: string } | null>(null)

  React.useEffect(() => {
    if (props.organizeRequest) setQuickPrompt(props.organizeRequest)
  }, [props.organizeRequest])

  const triggerAction = (action: ScreenplayAction) => {
    setQuickPrompt({ id: crypto.randomUUID(), text: actionPrompt(action, props.selectedScene) })
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-border bg-background">
      <div className="shrink-0 border-b border-border px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
            <LightbulbIcon className="size-3.5" />
          </div>
          <div>
            <p className="text-xs font-semibold">写作教练</p>
            <p className="text-[10px] text-muted-foreground">把镜头写得更清楚，也更好生成</p>
          </div>
          <MessageSquareTextIcon className="ml-auto size-3.5 text-muted-foreground" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                type="button"
                className="group rounded-md border border-border/70 bg-muted/20 px-2 py-2 text-left transition-colors hover:border-amber-500/50 hover:bg-amber-500/[0.06] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() => triggerAction(action.id)}
                title={action.hint}
              >
                <Icon className="size-3.5 text-amber-600 transition-transform duration-200 group-hover:scale-110" />
                <span className="mt-1 block text-[11px] font-medium">{action.label}</span>
              </button>
            )
          })}
        </div>
        {props.selectedScene && (
          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1.5 text-[10px] text-muted-foreground">
            <RefreshCwIcon className="size-3 text-amber-600" />
            当前聚焦：
            <span className="truncate font-medium text-foreground">
              {props.selectedScene.title}
            </span>
          </div>
        )}
      </div>

      <ScreenplayChangePreview
        proposals={props.proposals}
        busy={props.proposalBusy}
        onApply={props.onApplyProposal}
        onDiscard={props.onDiscardProposal}
      />

      <div className="min-h-0 flex-1">
        <AgentPanel
          sessionId={props.sessionId}
          skillId={props.skillId}
          modelRef={props.modelRef}
          skills={props.skills}
          providers={props.providers}
          settings={props.settings}
          onConfigChange={props.onConfigChange}
          serverPort={props.serverPort}
          initialMessages={props.initialMessages}
          onFileActivity={props.onFileActivity}
          onSessionActivity={props.onSessionActivity}
          onRunningChange={props.onRunningChange}
          onAgentEnd={props.onAgentEnd}
          quickPrompt={quickPrompt}
        />
      </div>
    </div>
  )
}
