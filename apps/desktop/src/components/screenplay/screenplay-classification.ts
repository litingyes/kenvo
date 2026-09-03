function pathParts(filePath: string): string[] {
  return filePath.split('/').filter(Boolean)
}

function episodeNumber(filePath: string, content: string): number | undefined {
  const parts = pathParts(filePath)
  const episodeIndex = parts.findIndex((part) => part === 'episodes')
  const folder = episodeIndex >= 0 ? parts[episodeIndex + 1] : undefined
  const folderNumber = folder ? /^(\d+)/.exec(folder)?.[1] : undefined
  if (folderNumber) return Number(folderNumber)
  const frontmatter = /^episode:\s*["']?(\d+)/m.exec(content)
  return frontmatter ? Number(frontmatter[1]) : undefined
}

/** Returns true when a Markdown file can be placed on the screenplay map. */
export function isRecognizedScreenplayDocument(filePath: string, content: string): boolean {
  const parts = pathParts(filePath)
  const lower = filePath.toLowerCase()
  if (lower === 'outline.md' || lower === 'story-bible.md') return true
  if (parts[0] === 'characters' || parts[0] === 'continuity') return true

  const isScene = parts.includes('scenes') || /^type:\s*scene\s*$/im.test(content)
  if (isScene && episodeNumber(filePath, content) !== undefined) return true

  return (
    parts[0] === 'episodes' &&
    parts[parts.length - 1] === 'outline.md' &&
    episodeNumber(filePath, content) !== undefined
  )
}

export function isUnorganizedScreenplayDocument(filePath: string, content: string): boolean {
  if (filePath === 'README.md' || filePath === 'project.md') return false
  return !isRecognizedScreenplayDocument(filePath, content)
}
