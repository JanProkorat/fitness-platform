import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { MealFood } from '@/api/generated';
import type { NutritionMeal } from '@/api/nutrition';
import { AddPhotoButton } from '@/components/nutrition/meals/AddPhotoButton';
import { MealStatusIcon } from '@/components/nutrition/meals/MealStatusIcon';
import type { MealStatus } from '@/components/nutrition/meals/MealStatusIcon';
import { mealKcal } from '@/components/nutrition/meals/model';
import { foodName, formatAmount, formatWhole } from '@/components/nutrition/meal/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** A meal photo as the row shows it: a signed read URL. */
export type MealRowPhoto = { key: string; uri: string };

type MealRowProps = {
  meal: NutritionMeal;
  status: MealStatus;
  /** Photos shown as thumbnails while the row is expanded. */
  photos?: MealRowPhoto[];
  /** First row of a list has no divider above it. */
  first?: boolean;
  defaultExpanded?: boolean;
  onOpenRecipe: (recipeId: string, servings: number) => void;
  /** Foods are links only when this is given; without it they have no chevron. */
  onOpenFood?: (food: MealFood) => void;
  /** Makes the status icon a button (logging); read-only without it. */
  onToggleEaten?: () => void;
  /** Shows the add-photo button. */
  onAddPhoto?: () => void;
  addPhotoBusy?: boolean;
  onOpenPhoto?: (index: number) => void;
};

type MealItem = { key: string; name: string; amount: string; onPress?: () => void };

/**
 * A collapsible meal: collapsed it is one line plus a preview of the first item, expanded it lists every
 * recipe and food and the photo thumbnails. Shared by the plan week view and the Nutrition tab.
 */
export function MealRow({
  meal,
  status,
  photos = [],
  first = false,
  defaultExpanded = false,
  onOpenRecipe,
  onOpenFood,
  onToggleEaten,
  onAddPhoto,
  addPhotoBusy = false,
  onOpenPhoto,
}: MealRowProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const language = i18n.language;
  const [expanded, setExpanded] = useState(defaultExpanded);

  const items: MealItem[] = [
    ...(meal.recipes ?? []).map((recipe, index): MealItem => {
      const recipeId = recipe.recipeId;
      const servings = recipe.servings ?? 1;
      return {
        key: `recipe-${recipeId ?? ''}-${index}`,
        name: recipe.recipeName ?? '',
        amount: t('nutritionPlan.amount.portions', { count: servings, value: formatAmount(language, servings) }),
        onPress: recipeId ? () => onOpenRecipe(recipeId, servings) : undefined,
      };
    }),
    ...(meal.foods ?? []).map(
      (food, index): MealItem => ({
        key: `food-${food.foodExternalId ?? ''}-${index}`,
        name: foodName(food, language),
        amount: t('nutritionPlan.amount.grams', { value: formatWhole(language, food.amountGrams ?? 0) }),
        onPress: onOpenFood ? () => onOpenFood(food) : undefined,
      }),
    ),
  ];

  const kindLabel = meal.kind ? t(`nutritionMeal.kind.${meal.kind}`) : t('nutritionMeal.title');
  const kcal = formatWhole(language, mealKcal(meal));
  const [firstItem] = items;
  const more = items.length - 1;
  const expandable = items.length > 0 || photos.length > 0;
  const statusLabel = t(`nutritionPlan.status.${status}`, { meal: kindLabel });

  return (
    <View style={[styles.row, !first && styles.divider]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded, disabled: !expandable }}
          accessibilityLabel={t('nutritionPlan.meal.toggle', { meal: kindLabel })}
          disabled={!expandable}
          onPress={() => setExpanded((value) => !value)}
          style={styles.toggle}
        >
          <SymbolView
            name={expanded ? 'chevron.up' : 'chevron.down'}
            weight="semibold"
            tintColor={theme.colors.muted}
            size={theme.sizes.mealChevron}
          />
          <View style={styles.titles}>
            <View style={styles.titleLine}>
              <Text variant="bodyStrong">{kindLabel}</Text>
              <Text variant="label" color="muted">
                {t('nutritionPlan.meal.kcal', { value: kcal })}
              </Text>
            </View>
            {!expanded && firstItem ? (
              <View style={styles.preview}>
                <Text variant="label" color="muted" numberOfLines={1} style={styles.previewName}>
                  {firstItem.name}
                </Text>
                {more > 0 ? (
                  <Text
                    variant="labelStrong"
                    color="muted"
                    accessibilityLabel={t('nutritionPlan.meal.more', { count: more })}
                  >
                    {`+${more}`}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </Pressable>
        {onAddPhoto ? (
          <AddPhotoButton label={t('nutritionPlan.photo.add', { meal: kindLabel })} onPress={onAddPhoto} busy={addPhotoBusy} />
        ) : null}
        <MealStatusIcon status={status} label={statusLabel} onPress={onToggleEaten} />
      </View>

      {expanded ? (
        <View style={styles.body}>
          {items.map((item) => {
            const content = (
              <>
                <Text variant="body" numberOfLines={2} style={styles.itemName}>
                  {item.name}
                </Text>
                <Text variant="label" color="muted" style={styles.itemAmount}>
                  {item.amount}
                </Text>
                {item.onPress ? (
                  <SymbolView
                    name="chevron.right"
                    weight="medium"
                    tintColor={theme.colors.muted}
                    size={theme.sizes.mealItemChevron}
                  />
                ) : null}
              </>
            );
            return item.onPress ? (
              <Pressable
                key={item.key}
                accessibilityRole="link"
                accessibilityLabel={`${item.name}, ${item.amount}`}
                onPress={item.onPress}
                style={styles.item}
              >
                {content}
              </Pressable>
            ) : (
              <View key={item.key} style={styles.item}>
                {content}
              </View>
            );
          })}
          {photos.length > 0 ? (
            <View style={styles.photos}>
              {photos.map((photo, index) => (
                <Pressable
                  key={photo.key}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={t('nutritionPlan.photo.open', {
                    meal: kindLabel,
                    index: index + 1,
                    count: photos.length,
                  })}
                  onPress={() => onOpenPhoto?.(index)}
                >
                  <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      paddingVertical: theme.spacing.snug,
    },
    divider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.lineStrong,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    toggle: {
      flex: 1,
      minWidth: 0,
      minHeight: theme.sizes.mealTouch,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    titles: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.hair,
    },
    titleLine: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: theme.spacing.sm,
    },
    preview: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: theme.spacing.snug,
      minWidth: 0,
    },
    previewName: {
      flexShrink: 1,
      minWidth: 0,
    },
    body: {
      paddingLeft: theme.sizes.mealIndent,
      paddingBottom: theme.spacing.xxs,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.sizes.mealItemMin,
      paddingVertical: theme.spacing.snug,
    },
    itemName: {
      flex: 1,
      minWidth: 0,
    },
    itemAmount: {
      flexShrink: 0,
    },
    photos: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.snug,
      paddingTop: theme.spacing.snug,
      paddingBottom: theme.spacing.xxs,
    },
    thumb: {
      width: theme.sizes.mealThumb,
      height: theme.sizes.mealThumb,
      borderRadius: theme.radii.sm,
      backgroundColor: theme.colors.field,
    },
  });
