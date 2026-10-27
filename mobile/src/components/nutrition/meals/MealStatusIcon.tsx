import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** eaten: confirmed; pending: not eaten yet (today or later); missed: not logged on a past day. */
export type MealStatus = 'eaten' | 'pending' | 'missed';

type MealStatusIconProps = {
  status: MealStatus;
  label: string;
  /** When set the icon is a button (the Nutrition tab logs and unlogs through it); otherwise it is read-only. */
  onPress?: () => void;
};

/** Status of a meal at the right of its row: filled green check, empty ring or red X. */
export function MealStatusIcon({ status, label, onPress }: MealStatusIconProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const glyph =
    status === 'eaten' ? (
      <View style={[styles.circle, styles.eaten]}>
        <SymbolView name="checkmark" weight="bold" tintColor={theme.colors.onNutrition} size={theme.sizes.mealStatusGlyph} />
      </View>
    ) : status === 'missed' ? (
      <View style={[styles.circle, styles.missed]}>
        <SymbolView name="xmark" weight="heavy" tintColor={theme.colors.error} size={theme.sizes.mealMissedGlyph} />
      </View>
    ) : (
      <View style={[styles.circle, styles.pending]} />
    );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={styles.slot}
        hitSlop={theme.spacing.xxs}
      >
        {glyph}
      </Pressable>
    );
  }
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.slot}>
      {glyph}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    slot: {
      width: theme.sizes.mealStatusSlot,
      height: theme.sizes.mealTouch,
      flexShrink: 0,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    circle: {
      width: theme.sizes.mealStatus,
      height: theme.sizes.mealStatus,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eaten: {
      backgroundColor: theme.colors.nutrition,
    },
    missed: {
      backgroundColor: theme.colors.errorSoft,
    },
    pending: {
      borderWidth: theme.sizes.borderStrong,
      borderColor: theme.colors.muted,
    },
  });
