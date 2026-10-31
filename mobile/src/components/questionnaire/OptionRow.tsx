import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type OptionRowProps = {
  label: string;
  /** `multi` shows a square box, `single` a round one. */
  mode: 'single' | 'multi';
  selected: boolean;
  /** Dims the label, for the "something else" row. */
  quiet?: boolean;
  onPress: () => void;
};

/** One selectable answer row with a check box on the right. */
export function OptionRow({ label, mode, selected, quiet = false, onPress }: OptionRowProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Pressable
      accessibilityRole={mode === 'multi' ? 'checkbox' : 'radio'}
      accessibilityLabel={label}
      accessibilityState={mode === 'multi' ? { checked: selected } : { selected }}
      onPress={onPress}
      style={[styles.row, selected && styles.selected]}
    >
      <Text variant="bodyLarge" color={quiet && !selected ? 'muted' : 'ink'} style={styles.label}>
        {label}
      </Text>
      <View
        style={[
          styles.box,
          mode === 'single' && styles.round,
          selected ? styles.boxOn : styles.boxOff,
        ]}
      >
        {selected ? (
          <SymbolView
            name="checkmark"
            weight="bold"
            tintColor={theme.colors.onPrimary}
            size={theme.sizes.checkboxGlyph}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      minHeight: theme.sizes.field,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.xl,
      borderWidth: theme.sizes.borderStrong,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    selected: {
      borderColor: theme.colors.primary,
    },
    label: {
      flex: 1,
      minWidth: 0,
    },
    box: {
      width: theme.sizes.roleBadge,
      height: theme.sizes.roleBadge,
      borderRadius: theme.radii.checkbox,
      alignItems: 'center',
      justifyContent: 'center',
    },
    round: {
      borderRadius: theme.radii.pill,
    },
    boxOn: {
      backgroundColor: theme.colors.primary,
    },
    boxOff: {
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.fieldBorder,
      backgroundColor: theme.colors.field,
    },
  });
