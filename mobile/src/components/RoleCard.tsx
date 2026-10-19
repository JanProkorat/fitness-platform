import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { Text } from './Text';

export type RoleTone = 'client' | 'training' | 'nutrition';

type RoleCardProps = {
  label: string;
  hint: string;
  symbol: SFSymbol;
  tone: RoleTone;
  selected: boolean;
  onPress: () => void;
};

const resolveTone = (theme: Theme, tone: RoleTone) => {
  const { colors } = theme;
  switch (tone) {
    case 'training':
      return { background: colors.trainingSoft, foreground: colors.trainingInk };
    case 'nutrition':
      return { background: colors.nutritionSoft, foreground: colors.nutritionInk };
    case 'client':
      return { background: colors.accentSoft, foreground: colors.accent };
  }
};

/** One selectable account type in the registration picker. */
export function RoleCard({ label, hint, symbol, tone, selected, onPress }: RoleCardProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const look = resolveTone(theme, tone);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={[styles.icon, { backgroundColor: look.background }]}>
        <SymbolView name={symbol} tintColor={look.foreground} size={theme.sizes.roleGlyph} />
      </View>
      <View style={styles.copy}>
        <Text variant="link">{label}</Text>
        <Text variant="caption" color="muted">
          {hint}
        </Text>
      </View>
      {selected ? (
        <View style={styles.badge}>
          <SymbolView
            name="checkmark"
            weight="bold"
            tintColor={theme.colors.onPrimary}
            size={theme.sizes.roleBadgeGlyph}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-start',
      gap: theme.spacing.snug,
      padding: theme.spacing.sm,
      borderRadius: theme.radii.lg,
      borderWidth: theme.sizes.borderStrong,
      borderColor: theme.colors.lineStrong,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    cardSelected: {
      borderColor: theme.colors.primary,
    },
    icon: {
      width: theme.sizes.roleIcon,
      height: theme.sizes.roleIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      alignSelf: 'stretch',
    },
    badge: {
      position: 'absolute',
      top: theme.spacing.xs,
      right: theme.spacing.xs,
      width: theme.sizes.roleBadge,
      height: theme.sizes.roleBadge,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
  });
