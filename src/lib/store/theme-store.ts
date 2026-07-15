import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Lume theme presets.
 * Currently only "terminal" is available, but the shape is intentionally
 * extensible for future presets (e.g. ocean, midnight, paper).
 */
export type ThemePreset = 'terminal'

interface ThemeState {
  themePreset: ThemePreset
  setThemePreset: (themePreset: ThemePreset) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themePreset: 'terminal',
      setThemePreset: (themePreset) => set({ themePreset }),
    }),
    { name: 'lume-theme' },
  ),
)
