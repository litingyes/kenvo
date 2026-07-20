import { api } from '@/lib/electron/api'

export interface AppPaths {
  log_dir: string
  data_dir: string
}

export async function getAppPaths(): Promise<AppPaths> {
  return api.path.getAppPaths()
}

export async function openAppFolder(kind: 'log' | 'data'): Promise<void> {
  return api.path.openAppFolder(kind)
}
