import { api } from '@/lib/electron/api'

import { isUnorganizedScreenplayDocument } from './screenplay-classification'
import { analyzeSceneDocument, parseSceneDocument } from './screenplay-document'
import type {
  EpisodeSummary,
  SceneSummary,
  ScreenplayCanvasData,
  ScreenplayDocumentRef,
} from './types'

interface FileRecord {
  path: string
  content: string
}

const IGNORED = new Set(['node_modules', '.git', '.DS_Store'])

async function collectMarkdown(rootPath: string): Promise<FileRecord[]> {
  const records: FileRecord[] = []

  async function visit(absPath: string, relPath: string): Promise<void> {
    let entries
    try {
      entries = await api.fs.readDir(absPath)
    } catch {
      return
    }
    for (const entry of entries) {
      if (IGNORED.has(entry.name) || entry.name.startsWith('.')) continue
      const nextRel = relPath ? `${relPath}/${entry.name}` : entry.name
      const nextAbs = `${absPath}/${entry.name}`
      if (entry.isDirectory) {
        await visit(nextAbs, nextRel)
      } else if (entry.name.toLowerCase().endsWith('.md')) {
        try {
          records.push({ path: nextRel, content: await api.fs.readTextFile(nextAbs) })
        } catch {
          // A file can disappear between readDir and readTextFile.
        }
      }
    }
  }

  await visit(rootPath, '')
  return records
}

function pathParts(path: string): string[] {
  return path.split('/').filter(Boolean)
}

function episodeNumber(path: string, content: string): number | undefined {
  const parts = pathParts(path)
  const episodeIndex = parts.findIndex((part) => part === 'episodes')
  const folder = episodeIndex >= 0 ? parts[episodeIndex + 1] : undefined
  const folderNumber = folder ? /^(\d+)/.exec(folder)?.[1] : undefined
  if (folderNumber) return Number(folderNumber)
  const frontmatter = /^episode:\s*["']?(\d+)/m.exec(content)
  return frontmatter ? Number(frontmatter[1]) : undefined
}

function episodeId(path: string, number: number): string {
  const parts = pathParts(path)
  const episodeIndex = parts.findIndex((part) => part === 'episodes')
  return parts[episodeIndex + 1] ?? `episode-${number}`
}

function episodeTitle(path: string, number: number, content?: string): string {
  const heading = content ? /^#\s+(.+)$/m.exec(content)?.[1]?.trim() : undefined
  if (heading) return heading.replace(/^第\s*\d+\s*[集话]?\s*[:：-]?\s*/u, '')
  const parts = pathParts(path)
  const episodeIndex = parts.findIndex((part) => part === 'episodes')
  const folder = parts[episodeIndex + 1]
  return folder?.replace(/^\d+[-_ ]*/, '') || `第 ${String(number).padStart(2, '0')} 集`
}

function sceneNumber(path: string, content: string): number {
  const filename = pathParts(path).pop() ?? ''
  const fromFilename = /^(\d+)/.exec(filename)?.[1]
  const fromFrontmatter = /^order:\s*["']?(\d+)/m.exec(content)?.[1]
  return Number(fromFrontmatter ?? fromFilename ?? 1)
}

function toSceneSummary(record: FileRecord): SceneSummary {
  const scene = parseSceneDocument(record.content, record.path)
  const issues = analyzeSceneDocument(scene)
  const order = sceneNumber(record.path, record.content)
  const example = /^example:\s*(true|yes|1)\s*$/im.test(record.content)
  return {
    id: String(scene.frontmatter.id ?? `${episodeId(record.path, 1)}-scene-${order}`),
    path: record.path,
    order,
    title: scene.title,
    status: String(scene.frontmatter.status ?? 'draft'),
    duration: scene.duration,
    location: scene.location,
    time: scene.time,
    summary: scene.summary,
    conflict: scene.conflict,
    turn: scene.turn,
    characters: scene.characters,
    shotCount: scene.shots.length,
    warningCount: issues.filter((issue) => issue.severity !== 'info').length,
    warnings: issues.map((issue) => issue.message),
    shots: scene.shots,
    example,
  }
}

function ref(record: FileRecord): ScreenplayDocumentRef {
  const title =
    /^#\s+(.+)$/m.exec(record.content)?.[1]?.trim() ?? record.path.split('/').pop() ?? record.path
  return { path: record.path, title }
}

export async function loadScreenplayIndex(
  rootPath: string,
  projectTitle: string,
): Promise<ScreenplayCanvasData> {
  const records = await collectMarkdown(rootPath)
  const episodes = new Map<string, EpisodeSummary>()
  const characters: ScreenplayDocumentRef[] = []
  const continuity: ScreenplayDocumentRef[] = []
  const unorganized: ScreenplayDocumentRef[] = []
  let outline: ScreenplayDocumentRef | undefined
  let storyBible: ScreenplayDocumentRef | undefined

  for (const record of records) {
    const parts = pathParts(record.path)
    const lower = record.path.toLowerCase()
    if (lower === 'outline.md') {
      outline = ref(record)
      continue
    }
    if (lower === 'story-bible.md') {
      storyBible = ref(record)
      continue
    }
    if (parts[0] === 'characters') {
      characters.push(ref(record))
      continue
    }
    if (parts[0] === 'continuity') {
      continuity.push(ref(record))
      continue
    }

    const isScene = parts.includes('scenes') || /^type:\s*scene\s*$/im.test(record.content)
    const number = episodeNumber(record.path, record.content)
    if (isScene && number !== undefined) {
      const id = episodeId(record.path, number)
      const current = episodes.get(id) ?? {
        id,
        order: number,
        title: episodeTitle(record.path, number),
        status: 'draft',
        scenes: [],
        warningCount: 0,
      }
      const scene = toSceneSummary(record)
      current.scenes.push(scene)
      current.warningCount += scene.warningCount
      current.duration = (current.duration ?? 0) + (scene.duration ?? 0)
      episodes.set(id, current)
      continue
    }

    if (
      parts[0] === 'episodes' &&
      parts[parts.length - 1] === 'outline.md' &&
      number !== undefined
    ) {
      const id = episodeId(record.path, number)
      const current = episodes.get(id) ?? {
        id,
        order: number,
        title: episodeTitle(record.path, number, record.content),
        status: 'outline',
        scenes: [],
        warningCount: 0,
      }
      current.path = record.path
      current.title = episodeTitle(record.path, number, record.content)
      current.hook = /^hook:\s*(.+)$/im.exec(record.content)?.[1]?.trim()
      current.cliffhanger = /^cliffhanger:\s*(.+)$/im.exec(record.content)?.[1]?.trim()
      const status = /^status:\s*([\w-]+)/im.exec(record.content)?.[1]
      if (status) current.status = status
      episodes.set(id, current)
      continue
    }

    if (isUnorganizedScreenplayDocument(record.path, record.content)) unorganized.push(ref(record))
  }

  for (const episode of episodes.values()) {
    episode.scenes.sort((a, b) => a.order - b.order || a.path.localeCompare(b.path))
    episode.warningCount = episode.scenes.reduce((sum, scene) => sum + scene.warningCount, 0)
    if (!episode.title || episode.title.startsWith('第 ')) {
      episode.title = `第 ${String(episode.order).padStart(2, '0')} 集`
    }
  }

  const sortedEpisodes = [...episodes.values()].sort((a, b) => a.order - b.order)
  return {
    rootPath,
    projectTitle,
    episodes: sortedEpisodes,
    outline,
    storyBible,
    characters,
    continuity,
    unorganized,
    totalDuration: sortedEpisodes.reduce((sum, episode) => sum + (episode.duration ?? 0), 0),
    totalScenes: sortedEpisodes.reduce((sum, episode) => sum + episode.scenes.length, 0),
    totalShots: sortedEpisodes.reduce(
      (sum, episode) =>
        sum + episode.scenes.reduce((sceneSum, scene) => sceneSum + scene.shotCount, 0),
      0,
    ),
    warningCount: sortedEpisodes.reduce((sum, episode) => sum + episode.warningCount, 0),
  }
}
