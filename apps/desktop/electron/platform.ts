/**
 * Cross-environment platform helpers.
 *
 * This file must stay free of renderer-only or main-only dependencies so it
 * can be imported by the Electron main process, preload, and window modules.
 */

export type DesktopPlatform = 'macos' | 'windows' | 'linux' | 'unknown'

const platformMap: Record<NodeJS.Platform, DesktopPlatform> = {
  aix: 'linux',
  android: 'unknown',
  cygwin: 'windows',
  darwin: 'macos',
  freebsd: 'linux',
  haiku: 'unknown',
  linux: 'linux',
  netbsd: 'linux',
  openbsd: 'linux',
  sunos: 'linux',
  win32: 'windows',
}

export function normalizePlatform(raw: NodeJS.Platform): DesktopPlatform {
  return platformMap[raw] ?? 'unknown'
}

export function isMacOS(): boolean {
  return normalizePlatform(process.platform) === 'macos'
}
