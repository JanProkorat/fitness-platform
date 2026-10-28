import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { Collaboration } from '@/api/collaborations';
import { Text } from '@/components/Text';
import { CoachProgressCard } from '@/components/today/CoachProgressCard';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type NutritionWaitingProps = {
  collaboration: Collaboration;
  /** True when the client has exactly one covering collaboration. */
  onlyCollaboration: boolean;
};

const TILES: { key: 'meals' | 'recipes' | 'shopping'; symbol: SFSymbol }[] = [
  { key: 'meals', symbol: 'calendar' },
  { key: 'recipes', symbol: 'book' },
  { key: 'shopping', symbol: 'cart' },
];

/** The nutritionist is linked but has not published a plan: progress, what the plan will include, preferences. */
export function NutritionWaiting({ collaboration, onlyCollaboration }: NutritionWaitingProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const first = collaboration.professionalName?.trim().split(/\s+/)[0] ?? '';

  return (
    <View style={styles.root}>
      <CoachProgressCard
        collaboration={collaboration}
        covered={['Nutritionist']}
        unpublished={['Nutritionist']}
        onlyCollaboration={onlyCollaboration}
      />

      <View style={styles.section}>
        <Text variant="overline" color="muted" style={styles.overline}>
          {t('nutritionTab.waiting.includes').toUpperCase()}
        </Text>
        <View style={styles.tiles}>
          {TILES.map(({ key, symbol }) => (
            <View key={key} style={styles.tile}>
              <View style={styles.tileIcon}>
                <SymbolView name={symbol} tintColor={theme.colors.nutritionInk} size={theme.sizes.coachGlyph} />
              </View>
              <Text variant="bodyStrong" style={styles.centered}>
                {t(`nutritionTab.waiting.tiles.${key}`)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('nutritionTab.waiting.preferences.title')}
        onPress={() => router.push('/profile')}
        style={styles.preferences}
      >
        <View style={styles.prefIcon}>
          <SymbolView name="list.clipboard" tintColor={theme.colors.ink} size={theme.sizes.rowGlyph} />
        </View>
        <View style={styles.prefCopy}>
          <Text variant="subtitle">{t('nutritionTab.waiting.preferences.title')}</Text>
          <Text variant="bodySmall" color="muted">
            {first
              ? t('nutritionTab.waiting.preferences.body', { name: first })
              : t('nutritionTab.waiting.preferences.bodyGeneric')}
          </Text>
        </View>
        <SymbolView name="chevron.right" tintColor={theme.colors.muted} size={theme.sizes.coachChevron} />
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      gap: theme.spacing.xxxl,
    },
    section: {
      gap: theme.spacing.md,
    },
    overline: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    centered: {
      textAlign: 'center',
    },
    tiles: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    tile: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radii.xxl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    tileIcon: {
      width: theme.sizes.coachIcon,
      height: theme.sizes.coachIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.nutritionSoft,
    },
    preferences: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: theme.radii.xxl,
      backgroundColor: theme.colors.subtle,
    },
    prefIcon: {
      width: theme.sizes.coachIcon,
      height: theme.sizes.coachIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    prefCopy: {
      flex: 1,
      minWidth: 0,
    },
  });
