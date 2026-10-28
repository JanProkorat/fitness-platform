import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatWhole } from '@/components/nutrition/meal/format';
import type { Macros } from '@/components/nutrition/meal/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Colors, Theme } from '@/theme';

type MacroKey = keyof Macros;

const MACROS: { key: MacroKey; dot: keyof Colors }[] = [
  { key: 'kcal', dot: 'ink' },
  { key: 'protein', dot: 'macroProtein' },
  { key: 'carbs', dot: 'macroCarbs' },
  { key: 'fat', dot: 'macroFat' },
  { key: 'fiber', dot: 'macroFiber' },
];

/** Energy and macros in one row, each with its colour dot. */
export function MacroStrip({ macros }: { macros: Macros }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.row}>
      {MACROS.map(({ key, dot }) => {
        const value = formatWhole(i18n.language, macros[key]);
        const shown = key === 'kcal' ? value : t('nutritionMeal.macros.grams', { value });
        const label = t(`nutritionMeal.macros.${key}`);
        return (
          <View key={key} accessible accessibilityLabel={`${label}, ${shown}`} style={styles.cell}>
            <Text variant="subtitle">{shown}</Text>
            <View style={styles.caption}>
              <View style={[styles.dot, { backgroundColor: theme.colors[dot] }]} />
              <Text variant="caption" color="muted">
                {label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
    },
    cell: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.hair,
    },
    caption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xxs,
    },
    dot: {
      width: theme.sizes.statusDot,
      height: theme.sizes.statusDot,
      borderRadius: theme.radii.pill,
    },
  });
