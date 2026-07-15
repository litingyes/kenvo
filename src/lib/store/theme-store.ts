import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Kenvo theme presets.
 */
export type ThemePreset = 'terminal' | 'ocean' | 'midnight'

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
    { name: 'kenvo-theme' },
  ),
)
