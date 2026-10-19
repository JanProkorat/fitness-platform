import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type SegmentOption<T extends string | number> = { value: T; label: string };

type SegmentedProps<T extends string | number> = {
  options: readonly SegmentOption<T>[];
  /** `null` while nothing is picked. */
  value: T | null;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

/** Pill track with one selected segment. Long labels shrink to fit instead of wrapping or clipping. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedProps<T>) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text
              variant={selected ? 'link' : 'bodySmall'}
              color={selected ? 'ink' : 'muted'}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={styles.label}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      height: theme.sizes.segment,
      padding: theme.spacing.xxs / 2,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.field,
    },
    segment: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xxs,
      borderRadius: theme.radii.pill,
    },
    selected: {
      backgroundColor: theme.colors.segmentSelected,
      boxShadow: theme.shadows.card,
    },
    label: {
      textAlign: 'center',
    },
  });
