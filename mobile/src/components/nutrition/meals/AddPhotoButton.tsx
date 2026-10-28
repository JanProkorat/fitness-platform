import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type AddPhotoButtonProps = {
  label: string;
  onPress: () => void;
  busy?: boolean;
};

/** Dark primary circle with a picture-plus glyph, sitting left of the status icon of a meal row. */
export function AddPhotoButton({ label, onPress, busy = false }: AddPhotoButtonProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={styles.slot}
    >
      <View style={styles.circle}>
        {busy ? (
          <ActivityIndicator size="small" color={theme.colors.onPrimary} />
        ) : (
          <SymbolView
            name="photo.badge.plus"
            weight="medium"
            tintColor={theme.colors.onPrimary}
            size={theme.sizes.mealAddGlyph}
          />
        )}
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    slot: {
      width: theme.sizes.mealAddSlot,
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
      backgroundColor: theme.colors.primary,
    },
  });
