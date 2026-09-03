export interface DirectoryEntryName {
  name: string
}

/** A new template may only be seeded into a directory without visible content. */
export function canCreateTemplateInDirectory(entries: readonly DirectoryEntryName[]): boolean {
  return !entries.some((entry) => !entry.name.startsWith('.'))
}
