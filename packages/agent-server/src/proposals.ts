import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export type ProposalOperation = 'create' | 'update' | 'delete'

export interface ProposedFileChange {
  path: string
  operation: ProposalOperation
  beforeHash: string | null
  beforeText?: string
  afterText?: string
  summary: string
}

export interface ChangeSet {
  id: string
  title: string
  changes: ProposedFileChange[]
}

export class ProposalConflictError extends Error {
  constructor(readonly conflicts: string[]) {
    super(`Proposal is stale for: ${conflicts.join(', ')}`)
  }
}

const proposals = new Map<string, ChangeSet[]>()

function resolveInProject(projectRoot: string, relativePath: string): string {
  const resolved = path.resolve(projectRoot, relativePath)
  const normalizedRoot = path.resolve(projectRoot)
  if (resolved !== normalizedRoot && !resolved.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error(`Path escapes project root: ${relativePath}`)
  }
  return resolved
}

function hashText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

async function readCurrent(projectRoot: string, relativePath: string): Promise<string | null> {
  const absolute = resolveInProject(projectRoot, relativePath)
  try {
    return await fs.readFile(absolute, 'utf8')
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
    if (code === 'ENOENT') return null
    throw error
  }
}

export async function proposeFileChange(
  sessionId: string,
  projectRoot: string,
  input: {
    path: string
    operation: ProposalOperation
    content?: string
    summary?: string
  },
): Promise<{ proposal: ChangeSet; change: ProposedFileChange }> {
  const relativePath = input.path.replaceAll('\\', '/')
  if (!relativePath || relativePath.startsWith('/') || relativePath.includes('..')) {
    throw new Error(`Invalid project-relative path: ${input.path}`)
  }

  const current = await readCurrent(projectRoot, relativePath)
  if (input.operation === 'create' && current !== null) {
    throw new Error(`Cannot propose create; file already exists: ${relativePath}`)
  }
  if ((input.operation === 'update' || input.operation === 'delete') && current === null) {
    throw new Error(`Cannot propose ${input.operation}; file does not exist: ${relativePath}`)
  }
  if (input.operation !== 'delete' && input.content === undefined) {
    throw new Error(`Content is required for ${input.operation}: ${relativePath}`)
  }

  const change: ProposedFileChange = {
    path: relativePath,
    operation: input.operation,
    beforeHash: current === null ? null : hashText(current),
    beforeText: current ?? undefined,
    afterText: input.operation === 'delete' ? undefined : input.content,
    summary: input.summary?.trim() || `${input.operation} ${relativePath}`,
  }
  const existing = proposals.get(sessionId) ?? []
  let proposal = existing[existing.length - 1]
  if (!proposal) {
    proposal = { id: crypto.randomUUID(), title: '剧本改动提案', changes: [] }
    existing.push(proposal)
    proposals.set(sessionId, existing)
  }
  const index = proposal.changes.findIndex((item) => item.path === relativePath)
  if (index >= 0) proposal.changes[index] = change
  else proposal.changes.push(change)
  return { proposal, change }
}

export function listProposals(sessionId: string): ChangeSet[] {
  return proposals.get(sessionId) ?? []
}

export function discardProposal(sessionId: string, proposalId: string): boolean {
  const current = proposals.get(sessionId) ?? []
  const next = current.filter((proposal) => proposal.id !== proposalId)
  if (next.length === current.length) return false
  if (next.length === 0) proposals.delete(sessionId)
  else proposals.set(sessionId, next)
  return true
}

export async function applyProposal(
  sessionId: string,
  projectRoot: string,
  proposalId: string,
): Promise<ChangeSet> {
  const proposal = (proposals.get(sessionId) ?? []).find((item) => item.id === proposalId)
  if (!proposal) throw new Error(`Unknown proposal: ${proposalId}`)

  const conflicts: string[] = []
  for (const change of proposal.changes) {
    const current = await readCurrent(projectRoot, change.path)
    const currentHash = current === null ? null : hashText(current)
    if (currentHash !== change.beforeHash) conflicts.push(change.path)
  }
  if (conflicts.length > 0) throw new ProposalConflictError(conflicts)

  for (const change of proposal.changes) {
    const absolute = resolveInProject(projectRoot, change.path)
    if (change.operation === 'delete') {
      await fs.rm(absolute)
      continue
    }
    await fs.mkdir(path.dirname(absolute), { recursive: true })
    await fs.writeFile(absolute, change.afterText ?? '', 'utf8')
  }
  discardProposal(sessionId, proposalId)
  return proposal
}

export function clearProposals(sessionId: string): void {
  proposals.delete(sessionId)
}
