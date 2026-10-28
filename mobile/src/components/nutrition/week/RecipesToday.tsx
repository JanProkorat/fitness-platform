import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { formatWhole } from '@/components/nutrition/meal/format';
import type { DayRecipe } from '@/components/nutrition/week/model';
import { Text } from '@/components/Text';
import { opacity as opacityTokens, useTheme } from '@/theme';
import type { Theme } from '@/theme';

type RecipesTodayProps = {
  recipes: DayRecipe[];
  /** Photo URL by recipe id; a recipe that is missing from it (or still loading) shows the fallback tile. */
  images: ReadonlyMap<string, string>;
  /** Horizontal inset of the screen: the row cancels it to scroll edge to edge, then restores it so the first card lines up with the page. */
  gutter: number;
  onOpenRecipe: (recipe: DayRecipe) => void;
  onOpenAll: () => void;
};

/** "Recipes today": the recipes of the selected day as a row of photo cards, plus a link to all recipes. */
export function RecipesToday({ recipes, images, gutter, onOpenRecipe, onOpenAll }: RecipesTodayProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  if (recipes.length === 0) return null;

  return (
    <View style={[styles.section, { marginHorizontal: -gutter }]}>
      <View style={[styles.head, { paddingHorizontal: gutter }]}>
        <Text variant="barTitle" accessibilityRole="header">
          {t('nutritionPlan.week.recipes.title')}
        </Text>
        <Text variant="link" color="nutritionInk" accessibilityRole="link" onPress={onOpenAll}>
          {t('nutritionPlan.week.recipes.all')}
        </Text>
      </View>
      <FlatList
        horizontal
        data={recipes}
        keyExtractor={(recipe) => recipe.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        renderItem={({ item }) => (
          <RecipeTile recipe={item} imageUrl={images.get(item.recipeId)} onPress={() => onOpenRecipe(item)} />
        )}
      />
    </View>
  );
}

type RecipeTileProps = { recipe: DayRecipe; imageUrl: string | undefined; onPress: () => void };

function RecipeTile({ recipe, imageUrl, onPress }: RecipeTileProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [failed, setFailed] = useState(false);
  const meal = recipe.kind ? t(`nutritionMeal.kind.${recipe.kind}`) : t('nutritionMeal.title');
  const kcal = formatWhole(i18n.language, recipe.kcal);
  const meta = t('nutritionPlan.week.recipes.meta', { meal, value: kcal });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('nutritionPlan.week.recipes.open', { name: recipe.name, meta })}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.image}>
        {imageUrl && !failed ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.photo}
            contentFit="cover"
            onError={() => setFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.fallback}>
            <SymbolView name="fork.knife" tintColor={theme.colors.muted} size={theme.sizes.recipeCardGlyph} />
          </View>
        )}
      </View>
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {recipe.name}
        </Text>
        <Text variant="caption" color="muted" numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: theme.spacing.md,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    list: {
      gap: theme.spacing.md,
      // Room for the card shadow, which the list would otherwise clip.
      paddingBottom: theme.spacing.xs,
    },
    card: {
      width: theme.sizes.recipeTodayWidth,
      overflow: 'hidden',
      borderRadius: theme.radii.card,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
    },
    pressed: {
      opacity: opacityTokens.pressed,
    },
    image: {
      height: theme.sizes.recipeTodayImage,
      backgroundColor: theme.colors.subtle,
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    fallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.subtle,
    },
    text: {
      gap: theme.spacing.hair,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
  });
