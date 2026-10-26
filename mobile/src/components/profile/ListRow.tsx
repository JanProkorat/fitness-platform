import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type RowTone = 'accent' | 'nutrition' | 'training' | 'neutral';

type ListRowProps = {
  /** Icon disc, avatar or any leading element; see `RowIcon`. */
  leading: ReactNode;
  label: string;
  /** Element under the label, such as a role chip. */
  caption?: ReactNode;
  /** Muted value before the chevron. */
  value?: string;
  /** Element before the chevron, such as a sparkline. */
  trailing?: ReactNode;
  /** A row without a handler is shown but not pressable. */
  onPress?: () => void;
};

/** One row of a `ListCard`: leading element, label, optional value and a chevron. */
export function ListRow({ leading, label, caption, value, trailing, onPress }: ListRowProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const content = (
    <>
      {leading}
      <View style={styles.copy}>
        <Text variant="body" numberOfLines={1}>
          {label}
        </Text>
        {caption}
      </View>
      {value ? (
        <Text variant="bodySmall" color="muted">
          {value}
        </Text>
      ) : null}
      {trailing}
      <SymbolView
        name="chevron.right"
        weight="medium"
        tintColor={theme.colors.muted}
        size={theme.sizes.listChevron}
      />
    </>
  );

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={value ? `${label}, ${value}` : label}
        style={styles.row}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      style={styles.row}
    >
      {content}
    </Pressable>
  );
}

/** Soft-tinted disc with a symbol, the leading element of a progress row. */
export function RowIcon({ symbol, tone }: { symbol: SFSymbol; tone: RowTone }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { colors } = theme;
  const look = {
    accent: { background: colors.accentSoft, foreground: colors.accent },
    nutrition: { background: colors.nutritionSoft, foreground: colors.nutritionInk },
    training: { background: colors.trainingSoft, foreground: colors.trainingInk },
    neutral: { background: colors.tabSelected, foreground: colors.ink2 },
  }[tone];

  return (
    <View style={[styles.icon, { backgroundColor: look.background }]}>
      <SymbolView name={symbol} tintColor={look.foreground} size={theme.sizes.listGlyph} />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs,
      alignItems: 'flex-start',
    },
    icon: {
      width: theme.sizes.listIcon,
      height: theme.sizes.listIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
