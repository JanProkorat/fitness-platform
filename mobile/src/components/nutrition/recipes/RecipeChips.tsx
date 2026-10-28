import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { RECIPE_CHIPS } from '@/components/nutrition/recipes/model';
import type { RecipeChip } from '@/components/nutrition/recipes/model';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type RecipeChipsProps = {
  value: RecipeChip;
  onChange: (value: RecipeChip) => void;
  /** Gutter of the screen the row bleeds through, so chips scroll edge to edge. */
  gutter: number;
};

/** Meal-type filter pills. */
export function RecipeChips({ value, onChange, gutter }: RecipeChipsProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme, gutter);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={t('nutritionRecipes.chips.label')}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {RECIPE_CHIPS.map((chip) => {
        const selected = chip === value;
        return (
          <Pressable
            key={chip}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(chip)}
            style={[styles.chip, selected && styles.selected]}
          >
            <Text variant="labelStrong" color={selected ? 'onPrimary' : 'ink2'}>
              {t(`nutritionRecipes.chips.${chip}`)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (theme: Theme, gutter: number) =>
  StyleSheet.create({
    scroll: {
      flexGrow: 0,
      marginHorizontal: -gutter,
    },
    content: {
      gap: theme.spacing.xs,
      paddingHorizontal: gutter,
    },
    chip: {
      height: theme.sizes.buttonMedium,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
      backgroundColor: theme.colors.surface,
    },
    selected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
  });
