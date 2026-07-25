import {
  DEFAULT_FILE_ICON,
  DEFAULT_FOLDER_ICON,
  FILE_EXTENSION_ICONS,
  FILE_NAME_ICONS,
  FOLDER_ICONS,
  ROOT_FOLDER_ICON,
} from './generated/file-icon-map'

function basename(name: string): string {
  return name.split('/').pop() ?? name
}

function normalize(name: string): string {
  return basename(name).toLowerCase()
}

/**
 * Resolve a file icon class matching VSCode icon theme semantics.
 * 1. exact file name match (case-insensitive)
 * 2. longest extension suffix from leftmost dot to rightmost dot
 * 3. fallback file icon
 */
export function getFileIconClass(name: string): string {
  const lower = normalize(name)
  const byName = FILE_NAME_ICONS[lower]
  if (byName) return byName

  for (
    let i = lower.indexOf('.');
    i !== -1 && i < lower.length - 1;
    i = lower.indexOf('.', i + 1)
  ) {
    const ext = lower.slice(i + 1)
    const byExt = FILE_EXTENSION_ICONS[ext]
    if (byExt) return byExt
  }

  return DEFAULT_FILE_ICON
}

export function getFolderIconClass(name: string, expanded: boolean): string {
  const lower = normalize(name)
  const mapped = FOLDER_ICONS[lower]
  if (mapped) {
    return expanded ? mapped.expanded : mapped.collapsed
  }
  return expanded ? DEFAULT_FOLDER_ICON.expanded : DEFAULT_FOLDER_ICON.collapsed
}

export function getRootIconClass(expanded: boolean): string {
  return expanded ? ROOT_FOLDER_ICON.expanded : ROOT_FOLDER_ICON.collapsed
}
