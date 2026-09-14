import { create } from 'zustand'
import { createMMKV } from 'react-native-mmkv'
import { storage as legacyAuthStorage } from './auth'

// Dedicated MMKV instance — must NOT share the 'mmkv.default' id used by
// stores/auth.ts, whose logout() calls storage.clearAll(). Theme preference
// is a device/UI setting, not session state, and should survive logout.
const storage = createMMKV({ id: 'mmkv.theme' })

export type ThemePreference = 'system' | 'light' | 'dark'

interface ThemeState {
  preference: ThemePreference
  setPreference: (pref: ThemePreference) => void
}

// SSR guard — Metro pre-renders on Node for expo-web where MMKV throws.
function readStoredPreference(): ThemePreference | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const current = storage.getString('themePreference') as ThemePreference | undefined
    if (current) return current

    // One-time migration: preference used to live on the shared
    // 'mmkv.default' instance (see auth.ts). Carry it over once so
    // existing installs don't silently revert to 'system'.
    const legacy = legacyAuthStorage.getString('themePreference') as ThemePreference | undefined
    if (legacy) {
      storage.set('themePreference', legacy)
      return legacy
    }
    return undefined
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
