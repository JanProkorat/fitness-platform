import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Colors, Theme } from '@/theme';

type StatTileProps = {
  symbol: SFSymbol;
  label: string;
  value: string;
  unit?: string;
  caption: string;
  captionColor?: keyof Colors;
  action: { symbol: SFSymbol; label: string; onPress: () => void };
};

/** One of the three stat tiles: glyph and action on top, then the label, the value and a caption. */
export function StatTile({ symbol, label, value, unit, caption, captionColor = 'muted', action }: StatTileProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.tile}>
      <View style={styles.top}>
        <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <SymbolView name={symbol} tintColor={theme.colors.accent} size={theme.sizes.tileGlyph} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={theme.spacing.sm}
          onPress={action.onPress}
          style={styles.action}
        >
          <SymbolView name={action.symbol} tintColor={theme.colors.ink} size={theme.sizes.tileGlyph} />
        </Pressable>
      </View>
      <Text variant="caption" color="muted" style={styles.label}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text variant="barTitle" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.value}>
          {value}
        </Text>
        {unit ? (
          <Text variant="caption" color="muted">
            {unit}
          </Text>
        ) : null}
      </View>
      <Text variant="caption" color={captionColor} numberOfLines={1}>
        {caption}
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
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.tile,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    icon: {
      width: theme.sizes.tileIcon,
      height: theme.sizes.tileIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accentSoft,
    },
    action: {
      width: theme.sizes.tileIcon,
      height: theme.sizes.tileIcon,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      paddingTop: theme.spacing.xxs / 2,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: theme.spacing.hair,
    },
    value: {
      flexShrink: 1,
    },
  });
