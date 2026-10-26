import type { SFSymbol } from 'expo-symbols';

import type { Theme } from '@/theme';

import type { CoachRole } from './collaborationRoles';

export type RoleLook = {
  symbol: SFSymbol;
  /** Tinted fill behind the role glyph. */
  soft: string;
  /** Glyph and label colour on the soft fill. */
  ink: string;
  /** Saturated brand colour, used for borders and current-step rings. */
  strong: string;
};

/** Colours and glyph of a coach role: orange dumbbell for training, green leaf for nutrition. */
export function roleLook(theme: Theme, role: CoachRole): RoleLook {
  const { colors } = theme;
  return role === 'Trainer'
    ? { symbol: 'dumbbell', soft: colors.trainingSoft, ink: colors.trainingInk, strong: colors.training }
    : { symbol: 'leaf', soft: colors.nutritionSoft, ink: colors.nutritionInk, strong: colors.nutrition };
}
