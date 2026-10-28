import { Image, Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { ClientRecipeListItem } from '@/api/generated';
import { primaryKind } from '@/components/nutrition/recipes/model';
import { Text } from '@/components/Text';
import { opacity as opacityTokens, useTheme } from '@/theme';
import type { Theme } from '@/theme';

type RecipeCardProps = {
  recipe: ClientRecipeListItem;
  /** Show the "This week" badge (This plan view). */
  showThisWeek: boolean;
  onPress: () => void;
};

/** One recipe: image (or a token placeholder), name and a kind, kcal, protein, time line. */
export function RecipeCard({ recipe, showThisWeek, onPress }: RecipeCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const name = recipe.name ?? '';
  const kind = primaryKind(recipe);
  const meta = [
    kind ? t(`nutritionRecipes.kind.${kind}`) : undefined,
    recipe.kcal ? t('nutritionRecipes.kcal', { value: Math.round(recipe.kcal) }) : undefined,
    recipe.protein ? t('nutritionRecipes.protein', { value: Math.round(recipe.protein) }) : undefined,
    recipe.prepTimeMinutes ? t('nutritionRecipes.minutes', { value: recipe.prepTimeMinutes }) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('nutritionRecipes.openRecipe', { name })}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageBox}>
        {recipe.imageUrl ? (
          <Image source={{ uri: recipe.imageUrl }} style={styles.image} accessibilityIgnoresInvertColors />
        ) : (
          <View style={styles.placeholder}>
            <SymbolView name="fork.knife" tintColor={theme.colors.muted} size={theme.sizes.recipeCardGlyph} />
          </View>
        )}
        {showThisWeek && recipe.isThisWeek ? (
          <View style={styles.badge}>
            <Text variant="chipSmall" color="ink">
              {t('nutritionRecipes.thisWeek')}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="bodyStrong" numberOfLines={2}>
        {name}
      </Text>
      {meta ? (
        <Text variant="caption" color="muted" numberOfLines={2}>
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    pressed: {
      opacity: opacityTokens.pressed,
    },
    imageBox: {
      aspectRatio: theme.sizes.recipeCardRatio,
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
      backgroundColor: theme.colors.subtle,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.subtle,
    },
    badge: {
      position: 'absolute',
      top: theme.spacing.xs,
      left: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.surface,
    },
  });
