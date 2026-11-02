import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** eaten: confirmed; partial: some items eaten; pending: not eaten yet (today or later); missed: not logged on a past day. */
export type MealStatus = 'eaten' | 'partial' | 'pending' | 'missed';

type MealStatusIconProps = {
  status: MealStatus;
  label: string;
  /** When set the icon is a button (the Nutrition tab logs and unlogs through it); otherwise it is read-only. */
  onPress?: () => void;
  /** Renders an empty slot of the same width: nothing to show or tap, hidden from screen readers. */
  hidden?: boolean;
  /** `item` is the smaller tick of one food or recipe inside a meal; it only ever shows eaten or pending. */
  size?: 'meal' | 'item';
};

/** Status of a meal or one of its items at the right of its row: green check, dash, empty ring or red X. */
export function MealStatusIcon({ status, label, onPress, hidden = false, size = 'meal' }: MealStatusIconProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const small = size === 'item';

  if (hidden) {
    return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.slot} />;
  }

  const glyphSize = small ? theme.sizes.mealItemStatusGlyph : theme.sizes.mealStatusGlyph;
  const circle = small ? styles.circleItem : styles.circle;
  const glyph =
    status === 'eaten' ? (
      <View style={[circle, styles.eaten]}>
        <SymbolView name="checkmark" weight="bold" tintColor={theme.colors.onNutrition} size={glyphSize} />
      </View>
    ) : status === 'partial' ? (
      <View style={[circle, styles.partial]}>
        <SymbolView name="minus" weight="heavy" tintColor={theme.colors.nutritionInk} size={glyphSize} />
      </View>
    ) : status === 'missed' ? (
      <View style={[circle, styles.missed]}>
        <SymbolView name="xmark" weight="heavy" tintColor={theme.colors.error} size={theme.sizes.mealMissedGlyph} />
      </View>
    ) : (
      <View style={[circle, styles.pending]} />
    );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ checked: status === 'eaten' ? true : status === 'partial' ? 'mixed' : false }}
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
    circleItem: {
      width: theme.sizes.mealItemStatus,
      height: theme.sizes.mealItemStatus,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eaten: {
      backgroundColor: theme.colors.nutrition,
    },
    partial: {
      borderWidth: theme.sizes.borderStrong,
      borderColor: theme.colors.nutrition,
      backgroundColor: theme.colors.nutritionSoft,
    },
    missed: {
      backgroundColor: theme.colors.errorSoft,
    },
    pending: {
      borderWidth: theme.sizes.borderStrong,
      borderColor: theme.colors.muted,
    },
  });
