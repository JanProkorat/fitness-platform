import { create } from 'zustand'

interface MessagesState {
  /** Conversation IDs that were auto-unarchived this session */
  autoUnarchivedIds: string[]
  /** Names keyed by conversation ID for banner display */
  autoUnarchivedNames: Record<string, string>
  /** Pending invite banner — trainer name, shown on home/chat */
  pendingInviteBanner: string | null

  markAutoUnarchived: (id: string, name: string) => void
  dismissAutoUnarchive: (id: string) => void
  showInviteBanner: (trainerName: string) => void
  dismissInviteBanner: () => void
}

export const useMessagesStore = create<MessagesState>((set) => ({
  autoUnarchivedIds: [],
  autoUnarchivedNames: {},
  pendingInviteBanner: null,

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

  showInviteBanner: (trainerName) => set({ pendingInviteBanner: trainerName }),
  dismissInviteBanner: () => set({ pendingInviteBanner: null }),
}))
