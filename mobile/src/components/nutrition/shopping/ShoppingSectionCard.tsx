import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { ShoppingListEntry } from '@/api/nutrition';
import { foodName } from '@/components/nutrition/meal/format';
import { Card } from '@/components/Card';
import { PendingMark } from '@/components/offline/PendingMark';
import { Text } from '@/components/Text';
import { usePendingKeys } from '@/stores/outbox';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type ShoppingSectionCardProps = {
  heading: string;
  items: readonly ShoppingListEntry[];
  language: string;
  quantityLabel: (item: ShoppingListEntry) => string;
  /** Plan week of the list, to match the outbox keys "week:food". */
  weekNumber: number;
  onToggle: (foodExternalId: string, isTicked: boolean) => void;
};

/** One category: an overline heading and a card of items, each with a tick circle and its amount. */
export function ShoppingSectionCard({
  heading,
  items,
  language,
  quantityLabel,
  weekNumber,
  onToggle,
}: ShoppingSectionCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const pendingKeys = usePendingKeys();

  return (
    <View style={styles.section}>
      <Text variant="overline" color="muted" style={styles.heading}>
        {heading.toUpperCase()}
      </Text>
      <Card style={styles.card}>
        {items.map((item, index) => {
          const id = item.foodExternalId;
          const ticked = item.isTicked === true;
          const name = foodName(item, language);
          const pending = id !== undefined && pendingKeys.shoppingTicked.has(`${weekNumber}:${id}`);
          const baseLabel = `${name}, ${quantityLabel(item)}`;
          return (
            <Pressable
              key={id ?? `${name}-${index}`}
              accessibilityRole="checkbox"
              accessibilityLabel={pending ? `${baseLabel}, ${t('offlineSync.pendingA11y')}` : baseLabel}
              accessibilityState={{ checked: ticked }}
              disabled={id === undefined}
              onPress={() => id !== undefined && onToggle(id, !ticked)}
              style={[styles.row, index > 0 && styles.divider]}
            >
              <View style={[styles.circle, ticked ? styles.circleTicked : styles.circleEmpty]}>
                {ticked ? (
                  <SymbolView
                    name="checkmark"
                    weight="bold"
                    tintColor={theme.colors.onNutrition}
                    size={theme.sizes.mealStatusGlyph}
                  />
                ) : null}
              </View>
              <View style={styles.name}>
                <Text
                  variant="bodyLarge"
                  color={ticked ? 'muted' : 'ink'}
                  numberOfLines={2}
                  style={ticked && styles.struck}
                >
                  {name}
                </Text>
                {pending ? <PendingMark /> : null}
              </View>
              <Text variant="body" color="muted">
                {quantityLabel(item)}
              </Text>
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: theme.spacing.xs,
    },
    heading: {
      paddingHorizontal: theme.spacing.xxs,
    },
    card: {
      paddingVertical: 0,
      paddingHorizontal: theme.spacing.cardInset,
    },
    row: {
      minHeight: theme.sizes.mealTouch + theme.spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    divider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.lineStrong,
    },
    circle: {
      width: theme.sizes.mealStatus,
      height: theme.sizes.mealStatus,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleTicked: {
      backgroundColor: theme.colors.nutrition,
    },
    circleEmpty: {
      borderWidth: theme.sizes.borderStrong,
      borderColor: theme.colors.fieldBorder,
    },
    name: {
      flex: 1,
      gap: theme.spacing.hair,
    },
    struck: {
      textDecorationLine: 'line-through',
    },
  });
