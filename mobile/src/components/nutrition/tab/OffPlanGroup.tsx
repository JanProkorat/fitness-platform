import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { TodayOffPlanFoodDto } from '@/api/generated';
import { formatWhole } from '@/components/nutrition/meal/format';
import { PendingMark } from '@/components/offline/PendingMark';
import { Text } from '@/components/Text';
import { usePendingKeys } from '@/stores/outbox';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type OffPlanGroupProps = {
  /** Today's off-plan foods, oldest first. Empty or omitted hides the group. */
  entries?: TodayOffPlanFoodDto[];
  /** Entry being removed, so its button is inert. */
  removingId?: string;
  onOpenFood: (foodExternalId: string) => void;
  onRemove: (entryId: string) => void;
  /** Shows the add link; only today can take new entries. */
  onAdd?: () => void;
};

/** The "Outside the plan" list and the add link at the bottom of the meals card. */
export function OffPlanGroup({ entries = [], removingId, onOpenFood, onRemove, onAdd }: OffPlanGroupProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const language = i18n.language;
  const pendingKeys = usePendingKeys();
  const total = entries.reduce((sum, entry) => sum + (entry.kcal ?? 0), 0);

  if (entries.length === 0 && !onAdd) return null;

  return (
    <View style={styles.group}>
      {entries.length > 0 ? (
        <View style={styles.list}>
          <View style={styles.head}>
            <Text variant="bodyStrong" accessibilityRole="header">
              {t('nutritionTab.offPlan.title')}
            </Text>
            <Text variant="label" color="muted">
              {t('nutritionTab.offPlan.kcal', { value: formatWhole(language, total) })}
            </Text>
          </View>
          {entries.map((entry) => {
            const name = entry.foodName ?? '';
            const amount = t('nutritionTab.offPlan.amount', {
              grams: formatWhole(language, entry.amountGrams ?? 0),
              kcal: formatWhole(language, entry.kcal ?? 0),
            });
            const entryId = entry.entryId;
            const foodId = entry.foodExternalId;
            const pending = entryId !== undefined && pendingKeys.offPlanAdded.has(entryId);
            return (
              <View key={entryId ?? `${foodId ?? ''}-${entry.loggedAt ?? ''}`} style={styles.item}>
                <Pressable
                  accessibilityRole={foodId ? 'link' : undefined}
                  accessibilityLabel={
                    pending ? `${name}, ${amount}, ${t('offlineSync.pendingA11y')}` : `${name}, ${amount}`
                  }
                  disabled={!foodId}
                  onPress={() => foodId && onOpenFood(foodId)}
                  style={styles.itemMain}
                >
                  <View style={styles.itemName}>
                    <Text variant="body" numberOfLines={2}>
                      {name}
                    </Text>
                    {pending ? <PendingMark /> : null}
                  </View>
                  <Text variant="label" color="muted" style={styles.itemAmount}>
                    {amount}
                  </Text>
                </Pressable>
                {entryId ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('nutritionTab.offPlan.remove', { name })}
                    accessibilityState={{ disabled: removingId === entryId }}
                    disabled={removingId === entryId}
                    hitSlop={theme.spacing.xxs}
                    onPress={() => onRemove(entryId)}
                    style={[styles.remove, removingId === entryId && styles.removing]}
                  >
                    <SymbolView
                      name="xmark"
                      weight="semibold"
                      tintColor={theme.colors.ink2}
                      size={theme.sizes.mealMissedGlyph}
                    />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
      {onAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('nutritionTab.offPlan.add')}
          onPress={onAdd}
          style={[styles.add, entries.length > 0 && styles.addDivider]}
        >
          <SymbolView name="plus" weight="regular" tintColor={theme.colors.muted} size={theme.sizes.fieldIcon} />
          <Text variant="body" color="ink2">
            {t('nutritionTab.offPlan.add')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    group: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.lineStrong,
    },
    list: {
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xxs,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.xxs,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.sizes.mealTouch,
      paddingVertical: theme.spacing.xxs,
    },
    itemMain: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    itemName: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.hair,
    },
    itemAmount: {
      flexShrink: 0,
    },
    remove: {
      width: theme.sizes.mealStatus,
      height: theme.sizes.mealStatus,
      flexShrink: 0,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.subtle,
    },
    removing: {
      opacity: theme.opacity.disabled,
    },
    add: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.sizes.mealTouch,
      paddingVertical: theme.spacing.snug,
    },
    addDivider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.lineStrong,
    },
  });
