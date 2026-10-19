import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type ChoiceTone = 'accent' | 'training' | 'nutrition' | 'info';

type ChoiceCardProps = {
  title: string;
  hint?: string;
  symbol?: SFSymbol;
  tone?: ChoiceTone;
  selected: boolean;
  /** Shows the check badge, or a thin bar at the right edge while unselected. */
  indicator?: boolean;
  onPress: () => void;
};

const resolveTone = (theme: Theme, tone: ChoiceTone) => {
  const { colors } = theme;
  switch (tone) {
    case 'training':
      return { background: colors.trainingSoft, foreground: colors.trainingInk };
    case 'nutrition':
      return { background: colors.nutritionSoft, foreground: colors.nutritionInk };
    case 'info':
      return { background: colors.infoSoft, foreground: colors.infoInk };
    case 'accent':
      return { background: colors.accentSoft, foreground: colors.accent };
  }
};

/** One selectable answer: optional icon, a title and an optional hint. */
export function ChoiceCard({
  title,
  hint,
  symbol,
  tone = 'accent',
  selected,
  indicator = false,
  onPress,
}: ChoiceCardProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const look = resolveTone(theme, tone);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={hint ? `${title}. ${hint}` : title}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.card, symbol ? styles.cardWithIcon : styles.cardPlain, selected && styles.selected]}
    >
      {symbol ? (
        <View style={[styles.icon, { backgroundColor: look.background }]}>
          <SymbolView name={symbol} tintColor={look.foreground} size={theme.sizes.rowGlyph} />
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        {hint ? (
          <Text variant="label" color="muted" numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
      {indicator ? (
        selected ? (
          <View style={styles.badge}>
            <SymbolView
              name="checkmark"
              weight="bold"
              tintColor={theme.colors.onPrimary}
              size={theme.sizes.roleBadgeGlyph}
            />
          </View>
        ) : (
          <View style={styles.bar} />
        )
      ) : null}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      borderRadius: theme.radii.lg,
      borderWidth: theme.sizes.borderStrong,
      borderColor: theme.colors.lineStrong,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    cardWithIcon: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    cardPlain: {
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg,
    },
    selected: {
      borderColor: theme.colors.primary,
    },
    icon: {
      width: theme.sizes.rowIcon,
      height: theme.sizes.rowIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    badge: {
      width: theme.sizes.roleBadge,
      height: theme.sizes.roleBadge,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    bar: {
      width: theme.sizes.choiceBarWidth,
      height: theme.sizes.choiceBarHeight,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.lineStrong,
    },
  });
