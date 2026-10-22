import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type SummaryTileProps = { label: string; value: string; detail: string };

/** One headline figure of a plan: label, big value and a muted line under it. */
export function SummaryTile({ label, value, detail }: SummaryTileProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View accessible accessibilityLabel={`${label}, ${value}, ${detail}`} style={styles.tile}>
      <Text variant="bodySmall" color="muted" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="numeral" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text variant="bodySmall" color="muted">
        {detail}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    tile: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs,
      padding: theme.spacing.lg,
      borderRadius: theme.radii.xl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
  });
