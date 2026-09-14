/**
 * Persists per-request wizard state so the selected mode survives
 * navigation away and back before the client confirms.
 *
 * The server transition (`POST /accept`) only fires on Pokračovat.
 * Until that point, the selection lives here only.
 */
import { create } from 'zustand'
import { createMMKV } from 'react-native-mmkv'

const mmkv = createMMKV({ id: 'mmkv.diary' })
const STORAGE_KEY = 'diaryWizardSelections'

// ─── Types ───────────────────────────────────────────────────────────

export type DiaryMode = 'Bulk' | 'Workflow'

/** Map of requestId → chosen mode (persisted via MMKV). */
type SelectionMap = Record<string, DiaryMode>

// ─── Helpers ─────────────────────────────────────────────────────────

function readMap(): SelectionMap {
  // SSR guard — Metro pre-renders on Node for expo-web where MMKV throws.
  if (typeof window === 'undefined') return {}
  try {
    const raw = mmkv.getString(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as SelectionMap
  } catch {
    return {}
  }
}

function writeMap(map: SelectionMap): void {
  if (typeof window === 'undefined') return
  mmkv.set(STORAGE_KEY, JSON.stringify(map))
}

// ─── Store ───────────────────────────────────────────────────────────

interface DiaryStore {
  /** Current in-memory selections (keyed by requestId). */
  selections: SelectionMap
  /** Set (or replace) the mode for a specific request. */
  setSelection: (requestId: string, mode: DiaryMode) => void
  /** Get the persisted mode for a specific request (undefined = not chosen). */
  getSelection: (requestId: string) => DiaryMode | undefined
  /** Clear the stored selection for a request (after accept succeeds). */
  clearSelection: (requestId: string) => void
}

export const useDiaryStore = create<DiaryStore>((set, get) => ({
  selections: readMap(),

  setSelection: (requestId, mode) => {
    const next = { ...get().selections, [requestId]: mode }
    writeMap(next)
    set({ selections: next })
  },

  getSelection: (requestId) => get().selections[requestId],

  clearSelection: (requestId) => {
    const next = { ...get().selections }
    delete next[requestId]
    writeMap(next)
    set({ selections: next })
  },
}))
