import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Kenvo theme presets.
 */
export const THEME_PRESETS = ['kenvo', 'ayu', 'catppuccin'] as const
export type ThemePreset = (typeof THEME_PRESETS)[number]

export function isThemePreset(value: string): value is ThemePreset {
  return (THEME_PRESETS as readonly string[]).includes(value)
}

interface ThemeState {
  themePreset: ThemePreset
  setThemePreset: (themePreset: ThemePreset) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themePreset: 'kenvo',
      setThemePreset: (themePreset) => set({ themePreset }),
    }),
    { name: 'kenvo-theme' },
  ),
)
