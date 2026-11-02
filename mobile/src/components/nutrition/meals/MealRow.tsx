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
import { isItemEaten, planItemId } from '@/api/nutrition';
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
  onOpenRecipe: (recipeId: string, servings: number, itemId?: string) => void;
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
  /** Ids of the items ticked as eaten; every item counts as ticked while `status` is eaten. */
  eatenItemIds?: readonly string[];
  /** Ids of the items whose tick waits in the outbox. */
  pendingItemIds?: ReadonlySet<string>;
  /** Makes each item's tick a button (logging); the ticks are read-only without it. */
  onToggleItem?: (itemId: string, eaten: boolean) => void;
};

type MealItem = { key: string; itemId?: string; name: string; amount: string; onPress?: () => void };

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
  eatenItemIds = [],
  pendingItemIds,
  onToggleItem,
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
        itemId: planItemId(recipe.itemId),
        name: recipe.recipeName ?? '',
        amount: t('nutritionPlan.amount.portions', { count: servings, value: formatAmount(language, servings) }),
        onPress: recipeId ? () => onOpenRecipe(recipeId, servings, planItemId(recipe.itemId)) : undefined,
      };
    }),
    ...(meal.foods ?? []).map(
      (food, index): MealItem => ({
        key: `food-${food.foodExternalId ?? ''}-${index}`,
        itemId: planItemId(food.itemId),
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
  const mealEaten = status === 'eaten';
  const isTicked = (item: MealItem): boolean =>
    item.itemId !== undefined && isItemEaten(mealEaten, eatenItemIds, item.itemId);
  const eatenCount = items.filter(isTicked).length;
  const partialCount = status === 'partial' && items.length > 0 && !hideEatenState;
  const baseStatusLabel = partialCount
    ? t('nutritionPlan.meal.partialA11y', { meal: kindLabel, done: eatenCount, count: items.length })
    : t(`nutritionPlan.status.${status}`, { meal: kindLabel });
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
              {partialCount ? (
                <Text variant="label" color="nutritionInk" numberOfLines={1}>
                  {t('nutritionPlan.meal.partial', { done: eatenCount, count: items.length })}
                </Text>
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
              const ticked = isTicked(item);
              const itemId = item.itemId;
              const itemPending = itemId !== undefined && pendingItemIds?.has(itemId) === true;
              const tickLabel = ticked
                ? t('nutritionPlan.item.unmarkEaten', { item: item.name })
                : t('nutritionPlan.item.markEaten', { item: item.name });
              const tick =
                itemId === undefined || hideEatenState ? (
                  <MealStatusIcon status="pending" label="" hidden size="item" />
                ) : (
                  <MealStatusIcon
                    size="item"
                    status={ticked ? 'eaten' : 'pending'}
                    label={itemPending ? `${tickLabel}, ${t('offlineSync.pendingA11y')}` : tickLabel}
                    onPress={onToggleItem ? () => onToggleItem(itemId, !ticked) : undefined}
                  />
                );
              const label = `${item.name}, ${item.amount}`;
              return (
                <View key={item.key} style={styles.itemRow}>
                  {item.onPress ? (
                    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={item.onPress} style={styles.item}>
                      {content}
                    </Pressable>
                  ) : (
                    <View style={styles.item}>{content}</View>
                  )}
                  {tick}
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
      flexWrap: 'wrap',
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
      // Out of flow so the height-animated clip never constrains it; onLayout then always reports the natural height.
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingLeft: theme.sizes.mealIndent,
      paddingBottom: theme.spacing.xxs,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    item: {
      flex: 1,
      minWidth: 0,
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
