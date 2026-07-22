import { api } from '@/lib/electron/api'

export type Platform = 'macos' | 'windows' | 'linux' | 'unknown'

export function usePlatform(): Platform {
  return api.platform ?? 'unknown'
}

export function useIsMacOS() {
  return usePlatform() === 'macos'
}
