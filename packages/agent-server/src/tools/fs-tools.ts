import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { AgentTool } from '@earendil-works/pi-agent-core'
import { Type, type TSchema } from '@earendil-works/pi-ai'

import { getActiveProposalRunId, proposeFileChange, type ProposalOperation } from '../proposals.js'

/** Identity helper that preserves TypeBox parameter inference for AgentTool objects. */
function defineTool<P extends TSchema, D>(def: AgentTool<P, D>): AgentTool<P, D> {
  return def
}

const IGNORED_DIRS = new Set(['node_modules', '.git', '.kenvo', '.DS_Store'])
const MAX_LIST_ENTRIES = 500
const MAX_READ_LINES = 2000
const MAX_SEARCH_RESULTS = 100

/**
 * Resolve a user/agent supplied path against the project root and refuse
 * anything that escapes it.
 */
function resolveInProject(projectRoot: string, relPath: string): string {
  const normalizedPath = relPath.replaceAll('\\', '/')
  const includesHiddenSegment = normalizedPath
    .split('/')
    .some((segment) => segment.startsWith('.') && segment !== '.' && segment !== '..')
  if (includesHiddenSegment) {
    throw new Error(`Hidden paths are not available to the agent: ${relPath}`)
  }
  const resolved = path.resolve(projectRoot, relPath)
  const rootWithSep = projectRoot.endsWith(path.sep) ? projectRoot : projectRoot + path.sep
  if (resolved !== projectRoot && !resolved.startsWith(rootWithSep)) {
    throw new Error(`Path escapes project root: ${relPath}`)
  }
  return resolved
}

function toRel(projectRoot: string, absPath: string): string {
  return path.relative(projectRoot, absPath).split(path.sep).join('/')
}

async function listDirRecursive(
  root: string,
  dir: string,
  depth: number,
  maxDepth: number,
  out: string[],
): Promise<void> {
  if (out.length >= MAX_LIST_ENTRIES || depth > maxDepth) return
  const entries = await fs.readdir(dir, { withFileTypes: true })
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const entry of entries) {
    if (out.length >= MAX_LIST_ENTRIES) return
    if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
    const abs = path.join(dir, entry.name)
    const rel = toRel(root, abs)
    if (entry.isDirectory()) {
      out.push(`${rel}/`)
      await listDirRecursive(root, abs, depth + 1, maxDepth, out)
    } else {
      out.push(rel)
    }
  }
}

export function createFsTools(
  projectRoot: string,
  options: { sessionId?: string } = {},
): AgentTool<any>[] {
  const listFiles = defineTool({
    name: 'list_files',
    label: 'List Files',
    description:
      'List files and directories in the project. Returns relative paths; directories end with "/".',
    parameters: Type.Object({
      path: Type.Optional(
        Type.String({
          description: 'Subdirectory to list, relative to project root. Default: root.',
        }),
      ),
      depth: Type.Optional(
        Type.Number({ description: 'Recursion depth (1 = direct children only). Default: 3.' }),
      ),
    }),
    execute: async (_id, params) => {
      const dir = resolveInProject(projectRoot, params.path ?? '.')
      const maxDepth = Math.max(1, Math.min(params.depth ?? 3, 6))
      const out: string[] = []
      await listDirRecursive(projectRoot, dir, 1, maxDepth, out)
      return {
        content: [{ type: 'text', text: out.length > 0 ? out.join('\n') : '(empty directory)' }],
        details: { count: out.length },
      }
    },
  })

  const readFile = defineTool({
    name: 'read_file',
    label: 'Read File',
    description: 'Read a text file from the project. Large files can be read in line ranges.',
    parameters: Type.Object({
      path: Type.String({ description: 'File path relative to the project root.' }),
      offset: Type.Optional(Type.Number({ description: '1-based line number to start from.' })),
      limit: Type.Optional(Type.Number({ description: 'Maximum number of lines to read.' })),
    }),
    execute: async (_id, params) => {
      const abs = resolveInProject(projectRoot, params.path)
      const raw = await fs.readFile(abs, 'utf8')
      const lines = raw.split('\n')
      const offset = Math.max(1, params.offset ?? 1)
      const limit = Math.min(params.limit ?? MAX_READ_LINES, MAX_READ_LINES)
      const slice = lines.slice(offset - 1, offset - 1 + limit)
      const truncated = offset - 1 + limit < lines.length
      const numbered = slice.map((line, i) => `${offset + i}: ${line}`).join('\n')
      return {
        content: [
          {
            type: 'text',
            text: numbered + (truncated ? `\n… (${lines.length} total lines, truncated)` : ''),
          },
        ],
        details: { path: params.path, totalLines: lines.length },
      }
    },
  })

  const writeFile = defineTool({
    name: 'write_file',
    label: 'Write File',
    description:
      'Write a text file in the project, creating parent directories as needed. Overwrites existing content entirely.',
    parameters: Type.Object({
      path: Type.String({ description: 'File path relative to the project root.' }),
      content: Type.String({ description: 'Full file content to write.' }),
    }),
    execute: async (_id, params, _signal, onUpdate) => {
      const abs = resolveInProject(projectRoot, params.path)
      onUpdate?.({
        content: [
          { type: 'text', text: `Writing ${params.path} (${params.content.length} chars)…` },
        ],
        details: { path: params.path },
      })
      await fs.mkdir(path.dirname(abs), { recursive: true })
      await fs.writeFile(abs, params.content, 'utf8')
      return {
        content: [{ type: 'text', text: `Wrote ${params.path} (${params.content.length} chars).` }],
        details: { path: params.path, bytes: Buffer.byteLength(params.content, 'utf8') },
      }
    },
  })

  const editFile = defineTool({
    name: 'edit_file',
    label: 'Edit File',
    description:
      'Replace a unique text span in a file. The old_text must match exactly once. Prefer this over write_file for small changes to large files.',
    parameters: Type.Object({
      path: Type.String({ description: 'File path relative to the project root.' }),
      old_text: Type.String({ description: 'Exact text to replace (must occur exactly once).' }),
      new_text: Type.String({ description: 'Replacement text.' }),
    }),
    execute: async (_id, params) => {
      const abs = resolveInProject(projectRoot, params.path)
      const raw = await fs.readFile(abs, 'utf8')
      const first = raw.indexOf(params.old_text)
      if (first === -1) {
        throw new Error(`old_text not found in ${params.path}`)
      }
      if (raw.indexOf(params.old_text, first + 1) !== -1) {
        throw new Error(`old_text occurs more than once in ${params.path}; provide more context`)
      }
      const next = raw.slice(0, first) + params.new_text + raw.slice(first + params.old_text.length)
      await fs.writeFile(abs, next, 'utf8')
      return {
        content: [
          {
            type: 'text',
            text: `Edited ${params.path}: replaced ${params.old_text.length} chars with ${params.new_text.length} chars.`,
          },
        ],
        details: { path: params.path },
      }
    },
  })

  const deleteFile = defineTool({
    name: 'delete_file',
    label: 'Delete File',
    description: 'Delete a file from the project. Use with care; deletion is permanent.',
    parameters: Type.Object({
      path: Type.String({ description: 'File path relative to the project root.' }),
    }),
    execute: async (_id, params) => {
      const abs = resolveInProject(projectRoot, params.path)
      await fs.rm(abs)
      return {
        content: [{ type: 'text', text: `Deleted ${params.path}.` }],
        details: { path: params.path },
      }
    },
  })

  const searchFiles = defineTool({
    name: 'search_files',
    label: 'Search Files',
    description:
      'Search file contents in the project with a regular expression. Returns matching lines with file paths and line numbers.',
    parameters: Type.Object({
      pattern: Type.String({ description: 'Regular expression to search for.' }),
      path: Type.Optional(
        Type.String({
          description: 'Subdirectory to search, relative to project root. Default: root.',
        }),
      ),
      max_results: Type.Optional(
        Type.Number({ description: 'Max matches to return. Default: 50.' }),
      ),
    }),
    execute: async (_id, params) => {
      const dir = resolveInProject(projectRoot, params.path ?? '.')
      const regex = new RegExp(params.pattern, 'i')
      const maxResults = Math.min(params.max_results ?? 50, MAX_SEARCH_RESULTS)
      const files: string[] = []
      await listDirRecursive(projectRoot, dir, 1, 8, files)

      const matches: string[] = []
      for (const rel of files) {
        if (matches.length >= maxResults) break
        if (rel.endsWith('/')) continue
        let content: string
        try {
          content = await fs.readFile(path.join(projectRoot, rel), 'utf8')
        } catch {
          continue
        }
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            matches.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 200)}`)
            if (matches.length >= maxResults) break
          }
        }
      }
      return {
        content: [{ type: 'text', text: matches.length > 0 ? matches.join('\n') : '(no matches)' }],
        details: { count: matches.length },
      }
    },
  })

  if (!options.sessionId) {
    return [listFiles, readFile, writeFile, editFile, deleteFile, searchFiles]
  }

  const proposeChange = defineTool({
    name: 'propose_file_change',
    label: 'Propose File Change',
    description:
      'Prepare a create, update, delete, or move for user review. Never writes to disk. For updates, provide the complete replacement content; for moves, provide from_path.',
    parameters: Type.Object({
      path: Type.String({ description: 'File path relative to the project root.' }),
      operation: Type.Union([
        Type.Literal('create'),
        Type.Literal('update'),
        Type.Literal('delete'),
        Type.Literal('move'),
      ]),
      from_path: Type.Optional(
        Type.String({
          description: 'Existing source path for move operations, relative to the project root.',
        }),
      ),
      content: Type.Optional(Type.String({ description: 'Complete new file content.' })),
      summary: Type.Optional(Type.String({ description: 'Short human-readable change summary.' })),
    }),
    execute: async (_id, params) => {
      const result = await proposeFileChange(
        options.sessionId as string,
        projectRoot,
        {
          path: params.path,
          operation: params.operation as ProposalOperation,
          fromPath: params.from_path,
          content: params.content,
          summary: params.summary,
        },
        getActiveProposalRunId(options.sessionId as string),
      )
      return {
        content: [
          {
            type: 'text',
            text: `Prepared ${result.change.operation} ${result.change.path} for review.`,
          },
        ],
        details: { proposalId: result.proposal.id, change: result.change },
      }
    },
  })

  return [listFiles, readFile, searchFiles, proposeChange]
}
