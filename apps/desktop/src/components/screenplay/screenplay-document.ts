import type { ContinuityIssue, SceneDocument, ShotCard } from './types'
import { SHOT_FIELD_LABELS } from './types'

interface FrontmatterResult {
  raw: string
  values: Record<string, string | number | string[]>
  body: string
}

const FRONTMATTER_OPEN = /^(?:\uFEFF)?---(?:\r\n|\n|\r)/
const FRONTMATTER_CLOSE = /^(?:---|\.\.\.)(?:\r\n|\n|\r|$)/gm

function parseScalar(value: string): string | number | string[] {
  const normalized = value.trim()
  if (!normalized) return ''
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    return normalized
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
  }
  const unquoted = normalized.replace(/^['"]|['"]$/g, '')
  const numeric = Number(unquoted)
  return unquoted !== '' && Number.isFinite(numeric) ? numeric : unquoted
}

function parseFrontmatter(source: string): FrontmatterResult {
  const opening = FRONTMATTER_OPEN.exec(source)
  if (!opening) return { raw: '', values: {}, body: source }

  FRONTMATTER_CLOSE.lastIndex = opening[0].length
  const closing = FRONTMATTER_CLOSE.exec(source)
  FRONTMATTER_CLOSE.lastIndex = 0
  if (!closing) return { raw: '', values: {}, body: source }

  const end = closing.index + closing[0].length
  const raw = source.slice(0, end)
  const values: Record<string, string | number | string[]> = {}
  for (const line of raw.slice(opening[0].length, closing.index).split(/\r?\n/)) {
    const match = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line.trim())
    if (match) values[match[1]] = parseScalar(match[2])
  }
  return { raw, values, body: source.slice(end) }
}

function asString(value: string | number | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value || undefined
  if (typeof value === 'number') return String(value)
  return value?.join(', ')
}

function asStringArray(value: string | number | string[] | undefined): string[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function asNumber(value: string | number | string[] | undefined): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function fieldValue(lines: string[], label: string): string | undefined {
  const expression = new RegExp(`^-\\s*\\*\\*${label}\\*\\*：?\\s*(.*)$`)
  for (const line of lines) {
    const match = expression.exec(line.trim())
    if (match) return match[1].trim() || undefined
  }
  return undefined
}

function headerTitle(body: string, fallback: string): string {
  const heading = /^#\s+(?!镜头\b)(.+)$/m.exec(body)
  return heading?.[1]?.trim() || fallback
}

function parseShotBlock(
  body: string,
  match: RegExpExecArray,
  nextStart: number,
  order: number,
): ShotCard {
  const heading = match[2]?.trim() || `镜头 ${String(order).padStart(2, '0')}`
  const block = body.slice(match.index, nextStart)
  const lines = block.split(/\r?\n/)
  const durationMatch = /(?:·|\b)(\d+(?:\.\d+)?)\s*秒/.exec(heading)
  const fields: Record<string, string> = {}
  for (const label of SHOT_FIELD_LABELS) {
    const value = fieldValue(lines, label)
    if (value) fields[label] = value
  }
  return {
    id: `shot-${order}`,
    order,
    duration: durationMatch ? Number(durationMatch[1]) : undefined,
    heading,
    fields,
    startLine: body.slice(0, match.index).split(/\r?\n/).length,
    endLine: body.slice(0, nextStart).split(/\r?\n/).length,
  }
}

export function parseSceneDocument(source: string, path = 'scene.md'): SceneDocument {
  const parsed = parseFrontmatter(source)
  const fallback = path.split('/').pop()?.replace(/\.md$/i, '') || '未命名场景'
  const shotPattern = /^##\s+镜头\s+(\d+)(?:\s+·\s*(.*))?\s*$/gm
  const matches: RegExpExecArray[] = []
  let match: RegExpExecArray | null
  while ((match = shotPattern.exec(parsed.body))) matches.push(match)
  const shots = matches.map((item, index) => {
    const nextStart = matches[index + 1]?.index ?? parsed.body.length
    return parseShotBlock(parsed.body, item, nextStart, Number(item[1]) || index + 1)
  })

  const overviewLines = parsed.body
    .split(/\r?\n/)
    .slice(0, matches[0] ? parsed.body.slice(0, matches[0].index).split(/\r?\n/).length : 40)
  const getValue = (label: string) =>
    asString(parsed.values[label]) ?? fieldValue(overviewLines, label)
  const title = asString(parsed.values.title) ?? headerTitle(parsed.body, fallback)

  return {
    path,
    frontmatter: parsed.values,
    title,
    summary: getValue('摘要') ?? asString(parsed.values.summary),
    conflict: getValue('冲突') ?? asString(parsed.values.conflict),
    turn: getValue('戏剧变化') ?? asString(parsed.values.turn),
    location: asString(parsed.values.location) ?? getValue('地点'),
    time: asString(parsed.values.time) ?? getValue('时间'),
    duration:
      asNumber(parsed.values.duration) ??
      (shots.reduce((sum, shot) => sum + (shot.duration ?? 0), 0) || undefined),
    characters: asStringArray(parsed.values.characters),
    shots,
    source,
  }
}

export function analyzeSceneDocument(scene: SceneDocument): ContinuityIssue[] {
  const issues: ContinuityIssue[] = []
  if (scene.shots.length === 0) {
    issues.push({
      id: `${scene.path}:shots`,
      severity: 'warning',
      message: '还没有镜头卡片',
      detail: '将场景拆成可生成的视频镜头后，Canvas 才能准确显示节奏。',
      path: scene.path,
    })
    return issues
  }

  for (const shot of scene.shots) {
    const missing = SHOT_FIELD_LABELS.filter((label) => !shot.fields[label])
    if (missing.length > 0) {
      issues.push({
        id: `${scene.path}:${shot.id}:fields`,
        severity: 'info',
        message: `${shot.heading} 缺少 ${missing.join('、')}`,
        detail: '字段不完整不会阻止写作，但可能降低视频生成的一致性。',
        path: scene.path,
        line: shot.startLine,
      })
    }
  }

  if (!scene.summary) {
    issues.push({
      id: `${scene.path}:summary`,
      severity: 'info',
      message: '场景缺少摘要',
      detail: '补充场景目的和冲突后，更容易在整体 Canvas 中快速判断节奏。',
      path: scene.path,
    })
  }
  if (!scene.conflict) {
    issues.push({
      id: `${scene.path}:conflict`,
      severity: 'warning',
      message: '场景尚未标记冲突或悬念',
      detail: '短视频场景需要明确的即时冲突或信息拉力。',
      path: scene.path,
    })
  }
  return issues
}

export function updateFrontmatterOrder(source: string, order: number): string {
  const parsed = parseFrontmatter(source)
  if (!parsed.raw) return source
  const next = parsed.raw.replace(/^(order:)\s*.*$/m, `$1 ${order}`)
  return `${next}${parsed.body}`
}

export function updateFrontmatterValue(
  source: string,
  key: string,
  value: string | number,
): string {
  const parsed = parseFrontmatter(source)
  if (!parsed.raw) return source
  const line = `${key}: ${value}`
  const expression = new RegExp(`^${key}:.*$`, 'm')
  const nextFrontmatter = expression.test(parsed.raw)
    ? parsed.raw.replace(expression, line)
    : `${parsed.raw.slice(0, -4)}${line}\n---\n`
  return `${nextFrontmatter}${parsed.body}`
}

export function updateEpisodeOutlineSceneOrder(
  source: string,
  scenes: Array<{ path: string; title: string }>,
): string {
  const heading = /^(##\s+(?:场景顺序|Scene Order)\s*)$/m.exec(source)
  const lines = scenes.map((scene) => `- ${scene.path}: ${scene.title}`).join('\n')
  if (!heading) return `${source.trimEnd()}\n\n## 场景顺序\n\n${lines}\n`

  const start = heading.index + heading[0].length
  const nextHeading = /^##\s+/m.exec(source.slice(start))
  const end = nextHeading ? start + nextHeading.index : source.length
  return `${source.slice(0, start)}\n\n${lines}\n\n${source.slice(end).replace(/^\n+/, '')}`
}

export function updateShotField(
  source: string,
  order: number,
  label: string,
  value: string,
): string {
  const parsed = parseFrontmatter(source)
  const headingPattern = /^##\s+镜头\s+(\d+)(?:\s+·\s*(.*))?\s*$/gm
  const matches: RegExpExecArray[] = []
  let match: RegExpExecArray | null
  while ((match = headingPattern.exec(parsed.body))) matches.push(match)
  const targetIndex = matches.findIndex((item) => Number(item[1]) === order)
  if (targetIndex < 0) return source
  const target = matches[targetIndex]
  const blockEnd = matches[targetIndex + 1]?.index ?? parsed.body.length
  const block = parsed.body.slice(target.index, blockEnd)
  const expression = new RegExp(`^-\\s*\\*\\*${label}\\*\\*：?.*$`, 'm')
  const nextLine = `- **${label}**：${value}`
  const nextBlock = expression.test(block)
    ? block.replace(expression, nextLine)
    : `${block.trimEnd()}\n${nextLine}\n`
  const nextBody = `${parsed.body.slice(0, target.index)}${nextBlock}${parsed.body.slice(blockEnd)}`
  return `${parsed.raw}${nextBody}`
}

export function reorderShotBlocks(source: string, from: number, to: number): string {
  if (from === to) return source
  const parsed = parseFrontmatter(source)
  const headingPattern = /^##\s+镜头\s+(\d+)(?:\s+·\s*(.*))?\s*$/gm
  const matches: RegExpExecArray[] = []
  let match: RegExpExecArray | null
  while ((match = headingPattern.exec(parsed.body))) matches.push(match)
  if (from < 0 || to < 0 || from >= matches.length || to >= matches.length) return source
  const prefix = parsed.body.slice(0, matches[0]?.index ?? 0)
  const blocks = matches.map((item, index) => {
    const end = matches[index + 1]?.index ?? parsed.body.length
    return parsed.body.slice(item.index, end)
  })
  const [moved] = blocks.splice(from, 1)
  blocks.splice(to, 0, moved)
  const normalized = blocks.map((block, index) =>
    block.replace(/^##\s+镜头\s+\d+/, `## 镜头 ${String(index + 1).padStart(2, '0')}`),
  )
  return `${parsed.raw}${prefix}${normalized.join('')}`
}

export function splitFrontmatter(source: string): { frontmatter: string; body: string } {
  const parsed = parseFrontmatter(source)
  return { frontmatter: parsed.raw, body: parsed.body }
}
