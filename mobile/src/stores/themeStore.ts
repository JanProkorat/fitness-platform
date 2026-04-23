import { create } from 'zustand'
import { storage } from './auth'

export type ThemePreference = 'system' | 'light' | 'dark'

interface ThemeState {
  preference: ThemePreference
  setPreference: (pref: ThemePreference) => void
}

// SSR guard — Metro pre-renders on Node for expo-web where MMKV throws.
function readStoredPreference(): ThemePreference | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return storage.getString('themePreference') as ThemePreference | undefined
  } catch {
    return undefined
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: readStoredPreference() ?? 'system',
  setPreference: (pref) => {
    storage.set('themePreference', pref)
    set({ preference: pref })
  },
}))
