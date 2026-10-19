import { Pressable, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type TagChipProps = {
  label: string;
  removeLabel: string;
  onRemove: () => void;
};

/** A removable entry of a chip list. */
export function TagChip({ label, removeLabel, onRemove }: TagChipProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={removeLabel}
      onPress={onRemove}
      style={styles.chip}
    >
      <Text variant="body" numberOfLines={1} style={styles.label}>
        {label}
      </Text>
      <SymbolView
        name="xmark"
        weight="medium"
        tintColor={theme.colors.muted}
        size={theme.sizes.chipRemoveGlyph}
      />
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: theme.spacing.xs,
      maxWidth: '100%',
      height: theme.sizes.chip,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.field,
    },
    label: {
      flexShrink: 1,
    },
  });
