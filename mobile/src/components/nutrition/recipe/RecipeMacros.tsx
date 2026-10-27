import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DetailCard } from '@/components/nutrition/meal/DetailCard';
import { formatAmount } from '@/components/nutrition/meal/format';
import type { Macros } from '@/components/nutrition/meal/format';
import { MacroStrip } from '@/components/nutrition/meal/MacroStrip';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type MacroBasis = 'portion' | 'all';

type RecipeMacrosProps = {
  basis: MacroBasis;
  portions: number;
  perPortion: Macros;
  onChangeBasis: (basis: MacroBasis) => void;
};

/** Macros of the recipe per portion or for all chosen portions, switched by a two-option control. */
export function RecipeMacros({ basis, portions, perPortion, onChangeBasis }: RecipeMacrosProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const shown: Macros =
    basis === 'portion'
      ? perPortion
      : {
          kcal: perPortion.kcal * portions,
          protein: perPortion.protein * portions,
          carbs: perPortion.carbs * portions,
          fat: perPortion.fat * portions,
          fiber: perPortion.fiber * portions,
        };
  const options: { key: MacroBasis; label: string }[] = [
    { key: 'portion', label: t('nutritionRecipe.macros.perPortion') },
    { key: 'all', label: t('nutritionRecipe.macros.allPortions', { value: formatAmount(i18n.language, portions) }) },
  ];

  return (
    <DetailCard>
      <View style={styles.content}>
        <View accessibilityRole="tablist" style={styles.segments}>
          {options.map((option) => {
            const selected = option.key === basis;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => onChangeBasis(option.key)}
                style={[styles.segment, selected && styles.selected]}
              >
                <Text variant={selected ? 'labelStrong' : 'label'} color={selected ? 'ink' : 'muted'}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <MacroStrip macros={shown} />
      </View>
    </DetailCard>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.xs,
    },
    segments: {
      flexDirection: 'row',
      padding: theme.spacing.hair,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.tabSelected,
    },
    segment: {
      flex: 1,
      height: theme.sizes.chip,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.pill,
    },
    selected: {
      backgroundColor: theme.colors.segmentSelected,
      boxShadow: theme.shadows.card,
    },
  });
