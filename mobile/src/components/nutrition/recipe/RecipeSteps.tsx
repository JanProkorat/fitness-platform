import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DetailCard } from '@/components/nutrition/meal/DetailCard';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type RecipeStepsProps = {
  steps: string[];
  onLayout?: (event: LayoutChangeEvent) => void;
};

/** Numbered preparation steps. */
export function RecipeSteps({ steps, onLayout }: RecipeStepsProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View onLayout={onLayout}>
      <DetailCard>
        <Text variant="subtitle" accessibilityRole="header" style={styles.title}>
          {t('nutritionRecipe.steps.title')}
        </Text>
        {steps.map((step, index) => (
          <View key={index} style={styles.row}>
            <View style={styles.badge}>
              <Text variant="captionStrong" color="nutritionInk">
                {index + 1}
              </Text>
            </View>
            <Text variant="body" style={styles.text}>
              {step}
            </Text>
          </View>
        ))}
      </DetailCard>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    title: {
      paddingBottom: theme.spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    badge: {
      width: theme.sizes.listIcon,
      height: theme.sizes.listIcon,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.nutritionSoft,
    },
    text: {
      flex: 1,
    },
  });
