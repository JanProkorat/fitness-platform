import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { MealFood } from '@/api/generated';
import type { NutritionMeal } from '@/api/nutrition';
import { AddPhotoButton } from '@/components/nutrition/meals/AddPhotoButton';
import { MealStatusIcon } from '@/components/nutrition/meals/MealStatusIcon';
import type { MealStatus } from '@/components/nutrition/meals/MealStatusIcon';
import { mealKcal } from '@/components/nutrition/meals/model';
import { NoteBox, trimmedNote } from '@/components/nutrition/meals/NoteBox';
import { foodName, formatAmount, formatWhole } from '@/components/nutrition/meal/format';
import { PendingMark } from '@/components/offline/PendingMark';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import { mealExpandMotion } from '@/theme/motion';
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
  /** The meal's log write waits in the outbox; the row says so in place of the item preview. */
  pending?: boolean;
  onOpenRecipe: (recipeId: string, servings: number) => void;
  /** Foods are links only when this is given; without it they have no chevron. */
  onOpenFood?: (food: MealFood) => void;
  /** Makes the status icon a button (logging); read-only without it. */
  onToggleEaten?: () => void;
  /** Shows the add-photo button. */
  onAddPhoto?: () => void;
  addPhotoBusy?: boolean;
  onOpenPhoto?: (index: number) => void;
  /** Future day: the meal cannot be eaten yet, so no tick (an empty slot stays), no status label, no add-photo. */
  hideEatenState?: boolean;
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
  pending = false,
  onOpenRecipe,
  onOpenFood,
  onToggleEaten,
  onAddPhoto,
  addPhotoBusy = false,
  onOpenPhoto,
  hideEatenState = false,
}: MealRowProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const language = i18n.language;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(defaultExpanded ? 1 : 0);
  // Natural height of the body; -1 until measured, so an expanded row is never clipped before its first layout.
  const bodyHeight = useSharedValue(-1);
  const bodyStyle = useAnimatedStyle(() => {
    if (bodyHeight.value < 0) return progress.value >= 1 ? {} : { height: 0, opacity: 0 };
    return { height: bodyHeight.value * progress.value, opacity: progress.value };
  });
  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    const target = next ? 1 : 0;
    progress.set(
      reduceMotion
        ? target
        : withTiming(target, { duration: mealExpandMotion.duration, easing: Easing.out(Easing.cubic) }),
    );
  };
  const measureBody = (event: LayoutChangeEvent) => {
    bodyHeight.set(event.nativeEvent.layout.height);
  };

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
  const note = trimmedNote(meal.note);
  const expandable = items.length > 0 || photos.length > 0 || note !== undefined;
  const baseStatusLabel = t(`nutritionPlan.status.${status}`, { meal: kindLabel });
  const statusLabel = pending ? `${baseStatusLabel}, ${t('offlineSync.pendingA11y')}` : baseStatusLabel;

  return (
    <View style={[styles.row, !first && styles.divider]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded, disabled: !expandable }}
          accessibilityLabel={t('nutritionPlan.meal.toggle', { meal: kindLabel })}
          disabled={!expandable}
          onPress={toggle}
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
              {note && !expanded ? (
                <SymbolView
                  name="text.bubble"
                  weight="medium"
                  tintColor={theme.colors.muted}
                  size={theme.sizes.noteGlyph}
                  accessibilityLabel={t('nutritionPlan.note.mealIcon')}
                />
              ) : null}
            </View>
            {pending ? (
              <PendingMark />
            ) : !expanded && firstItem ? (
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
        {onAddPhoto && !hideEatenState ? (
          <AddPhotoButton label={t('nutritionPlan.photo.add', { meal: kindLabel })} onPress={onAddPhoto} busy={addPhotoBusy} />
        ) : null}
        <MealStatusIcon
          status={status}
          label={statusLabel}
          onPress={hideEatenState ? undefined : onToggleEaten}
          hidden={hideEatenState}
        />
      </View>

      {expandable ? (
        <Reanimated.View
          style={[styles.clip, bodyStyle]}
          pointerEvents={expanded ? 'auto' : 'none'}
          accessibilityElementsHidden={!expanded}
          importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
        >
          <View style={styles.body} onLayout={measureBody}>
            <NoteBox label={t('nutritionPlan.note.meal')} note={note} />
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
        </Reanimated.View>
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
    clip: {
      overflow: 'hidden',
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
