import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type CoachCardTone = 'training' | 'nutrition';

type CoachCardProps = {
  title: string;
  hint: string;
  symbol: SFSymbol;
  tone: CoachCardTone;
  onPress: () => void;
};

/** One "find a coach" entry point; opens the search for its role. */
export function CoachCard({ title, hint, symbol, tone, onPress }: CoachCardProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const look =
    tone === 'training'
      ? { background: theme.colors.trainingSoft, foreground: theme.colors.trainingInk }
      : { background: theme.colors.nutritionSoft, foreground: theme.colors.nutritionInk };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: look.background }]}>
          <SymbolView name={symbol} tintColor={look.foreground} size={theme.sizes.coachGlyph} />
        </View>
        <SymbolView
          name="chevron.right"
          tintColor={theme.colors.muted}
          size={theme.sizes.coachChevron}
        />
      </View>
      <View>
        <Text variant="subtitle">{title}</Text>
        <Text variant="bodySmall" color="muted">
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: theme.radii.xxl,
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
      width: theme.sizes.coachIcon,
      height: theme.sizes.coachIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
