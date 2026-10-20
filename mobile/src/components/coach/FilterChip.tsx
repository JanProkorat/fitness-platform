import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/** A toggle pill in the filter row; the selected one is filled. */
export function FilterChip({ label, selected, onPress }: FilterChipProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text variant="link" style={{ color: selected ? theme.colors.onPrimary : theme.colors.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    chip: {
      height: theme.sizes.chip,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
      backgroundColor: theme.colors.surface,
    },
    selected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
  });
