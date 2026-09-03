import { api } from '@/lib/electron/api'

import {
  parseProjectConfig,
  PROJECT_CONFIG_PATH,
  type ProjectConfigReadResult,
} from './project-config-schema'

/** Read the legacy project marker without using it to decide how a project opens. */
export async function readProjectConfig(rootPath: string): Promise<ProjectConfigReadResult> {
  const absolutePath = `${rootPath}/${PROJECT_CONFIG_PATH}`
  if (!(await api.fs.exists(absolutePath))) return { status: 'missing', config: null }
  try {
    const raw = await api.fs.readTextFile(absolutePath)
    const config = parseProjectConfig(JSON.parse(raw) as unknown)
    return config ? { status: 'valid', config } : { status: 'invalid', config: null }
  } catch {
    return { status: 'invalid', config: null }
  }
}
