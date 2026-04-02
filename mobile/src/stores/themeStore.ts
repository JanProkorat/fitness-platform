import { create } from 'zustand'
import { storage } from './auth'

export type ThemePreference = 'system' | 'light' | 'dark'

interface ThemeState {
  preference: ThemePreference
  setPreference: (pref: ThemePreference) => void
}

const stored = storage.getString('themePreference') as ThemePreference | undefined

export const useThemeStore = create<ThemeState>((set) => ({
  preference: stored ?? 'system',
  setPreference: (pref) => {
    storage.set('themePreference', pref)
    set({ preference: pref })
  },
}))
