import { create } from 'zustand'

interface MessagesState {
  /** Conversation IDs that were auto-unarchived this session */
  autoUnarchivedIds: string[]
  /** Names keyed by conversation ID for banner display */
  autoUnarchivedNames: Record<string, string>

  markAutoUnarchived: (id: string, name: string) => void
  dismissAutoUnarchive: (id: string) => void
}

export const useMessagesStore = create<MessagesState>((set) => ({
  autoUnarchivedIds: [],
  autoUnarchivedNames: {},

  markAutoUnarchived: (id, name) =>
    set((s) => ({
      autoUnarchivedIds: s.autoUnarchivedIds.includes(id)
        ? s.autoUnarchivedIds
        : [...s.autoUnarchivedIds, id],
      autoUnarchivedNames: { ...s.autoUnarchivedNames, [id]: name },
    })),

  dismissAutoUnarchive: (id) =>
    set((s) => ({
      autoUnarchivedIds: s.autoUnarchivedIds.filter((i) => i !== id),
    })),
}))
