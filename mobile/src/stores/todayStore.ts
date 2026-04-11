import { create } from 'zustand'
import { createMMKV } from 'react-native-mmkv'

const mmkv = createMMKV({ id: 'mmkv.today' })

// ─── Types ───────────────────────────────────────────────────────────

export type TodayState =
  | 'loading'
  | 'no-trainer'
  | 'plan-pending'
  | 'has-trainer'

export interface PendingPlan {
  planId: string
  type: 'training' | 'nutrition'
  name: string
  trainerName: string
  chips: string[]         // e.g. ["1 700 kcal/day", "3 weeks"]
  startDate: string       // ISO date string
  accentColor: string     // '#c9a84c' training, '#34c759' nutrition
}

// ─── Store ───────────────────────────────────────────────────────────

interface TodayStore {
  state: TodayState
  pendingPlans: PendingPlan[]
  /** Training pending plans sourced from SignalR events (persisted separately) */
  pendingTrainingPlans: PendingPlan[]
  setState: (s: TodayState) => void
  setPendingPlans: (plans: PendingPlan[]) => void
  addPendingTrainingPlan: (plan: PendingPlan) => void
  removePendingTrainingPlan: (planId: string) => void
  reset: () => void
}

function getPersistedPlans(): PendingPlan[] {
  const raw = mmkv.getString('pendingPlans')
  if (!raw) return []
  try {
    return JSON.parse(raw) as PendingPlan[]
  } catch {
    return []
  }
}

function getPersistedTrainingPlans(): PendingPlan[] {
  const raw = mmkv.getString('pendingTrainingPlans')
  if (!raw) return []
  try {
    return JSON.parse(raw) as PendingPlan[]
  } catch {
    return []
  }
}

export const useTodayStore = create<TodayStore>((set, get) => ({
  state: 'loading',
  pendingPlans: getPersistedPlans(),
  pendingTrainingPlans: getPersistedTrainingPlans(),

  setState: (state) => set({ state }),

  setPendingPlans: (plans) => {
    mmkv.set('pendingPlans', JSON.stringify(plans))
    set({ pendingPlans: plans })
  },

  addPendingTrainingPlan: (plan) => {
    const current = get().pendingTrainingPlans
    // Avoid duplicates by planId
    const filtered = current.filter((p) => p.planId !== plan.planId)
    const next = [...filtered, plan]
    mmkv.set('pendingTrainingPlans', JSON.stringify(next))
    set({ pendingTrainingPlans: next })
  },

  removePendingTrainingPlan: (planId) => {
    const next = get().pendingTrainingPlans.filter((p) => p.planId !== planId)
    mmkv.set('pendingTrainingPlans', JSON.stringify(next))
    set({ pendingTrainingPlans: next })
  },

  reset: () => {
    mmkv.remove('pendingPlans')
    mmkv.remove('pendingTrainingPlans')
    set({ state: 'loading', pendingPlans: [], pendingTrainingPlans: [] })
  },
}))
