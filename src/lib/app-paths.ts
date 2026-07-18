import { invoke } from '@tauri-apps/api/core'

export interface AppPaths {
  log_dir: string
  data_dir: string
}

export async function getAppPaths(): Promise<AppPaths> {
  return invoke<AppPaths>('get_app_paths')
}

export async function openAppFolder(kind: 'log' | 'data'): Promise<void> {
  return invoke('open_app_folder', { kind })
}
