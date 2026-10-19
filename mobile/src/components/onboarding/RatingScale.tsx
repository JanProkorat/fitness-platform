import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type RatingScaleProps = {
  min: number;
  max: number;
  /** `null` while nothing is picked. */
  value: number | null;
  onChange: (value: number) => void;
  accessibilityLabel: string;
};

/** Numbered pill track, `min` to `max`, with one selected number. */
export function RatingScale({ min, max, value, onChange, accessibilityLabel }: RatingScaleProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const numbers = Array.from({ length: max - min + 1 }, (_, index) => min + index);

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.track}>
      {numbers.map((number) => {
        const selected = number === value;
        return (
          <Pressable
            key={number}
            accessibilityRole="radio"
            accessibilityLabel={String(number)}
            accessibilityState={{ selected }}
            onPress={() => onChange(number)}
            style={[styles.cell, selected && styles.selected]}
          >
            <Text variant={selected ? 'link' : 'bodySmall'} color={selected ? 'ink' : 'muted'}>
              {number}
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
      height: theme.sizes.ratingTrack,
      padding: theme.spacing.xxs / 2,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.field,
    },
    cell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.pill,
    },
    selected: {
      backgroundColor: theme.colors.segmentSelected,
      boxShadow: theme.shadows.card,
    },
  });
