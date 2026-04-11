import type { MealKind } from '@/api/nutrition'

export interface MealKindConfig {
  icon: string
  tintLight: string
  tintDark: string
}

export const MEAL_KIND_CONFIG: Record<MealKind, MealKindConfig> = {
  Breakfast: {
    icon: '🌅',
    tintLight: 'rgba(255,149,0,0.10)',
    tintDark: 'rgba(255,159,10,0.15)',
  },
  MorningSnack: {
    icon: '🍎',
    tintLight: 'rgba(52,199,89,0.10)',
    tintDark: 'rgba(48,209,88,0.15)',
  },
  Lunch: {
    icon: '🍽️',
    tintLight: 'rgba(0,122,255,0.10)',
    tintDark: 'rgba(10,132,255,0.15)',
  },
  AfternoonSnack: {
    icon: '🥜',
    tintLight: 'rgba(175,82,222,0.10)',
    tintDark: 'rgba(191,90,242,0.15)',
  },
  Dinner: {
    icon: '🌙',
    tintLight: 'rgba(255,59,48,0.10)',
    tintDark: 'rgba(255,69,58,0.15)',
  },
  PreWorkout: {
    icon: '⚡',
    tintLight: 'rgba(255,214,10,0.10)',
    tintDark: 'rgba(255,214,10,0.15)',
  },
  PostWorkout: {
    icon: '💪',
    tintLight: 'rgba(48,209,88,0.10)',
    tintDark: 'rgba(48,209,88,0.15)',
  },
} as const

export function getMealKindConfig(kind?: MealKind | null): MealKindConfig {
  if (kind && kind in MEAL_KIND_CONFIG) {
    return MEAL_KIND_CONFIG[kind]
  }
  // Fallback for unknown/missing kind
  return {
    icon: '🍽️',
    tintLight: 'rgba(120,120,128,0.10)',
    tintDark: 'rgba(120,120,128,0.15)',
  }
}
