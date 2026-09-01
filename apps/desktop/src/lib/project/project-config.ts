import { api } from '@/lib/electron/api'

import {
  defaultProjectConfig,
  parseProjectConfig,
  PROJECT_CONFIG_PATH,
  type ProjectConfig,
  type ProjectConfigReadResult,
} from './project-config-schema'

export {
  defaultProjectConfig,
  parseProjectConfig,
  PROJECT_CONFIG_PATH,
  PROJECT_VIEW_IDS,
  withProjectDefaultMode,
  type ProjectConfig,
  type ProjectConfigReadResult,
  type ProjectDefaultMode,
  type ProjectViewId,
} from './project-config-schema'

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

export async function writeProjectConfig(rootPath: string, config: ProjectConfig): Promise<void> {
  const absolutePath = `${rootPath}/${PROJECT_CONFIG_PATH}`
  await api.fs.mkdir(`${rootPath}/.kenvo`, true)
  await api.fs.writeTextFile(absolutePath, `${JSON.stringify(config, null, 2)}\n`)
}

export async function ensureProjectConfig(
  rootPath: string,
  template: ProjectConfig['template'],
): Promise<ProjectConfig> {
  const result = await readProjectConfig(rootPath)
  if (result.status === 'valid') return result.config
  const config = defaultProjectConfig(template)
  await writeProjectConfig(rootPath, config)
  return config
}
