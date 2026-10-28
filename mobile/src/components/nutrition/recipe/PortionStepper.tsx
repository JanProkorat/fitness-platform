import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { DetailCard } from '@/components/nutrition/meal/DetailCard';
import { formatAmount } from '@/components/nutrition/meal/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type PortionStepperProps = {
  portions: number;
  /** Servings the plan asks for, when the recipe was opened from a meal. */
  planServings?: number;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
};

/** Portions control; the amounts and macros below it follow the chosen number. */
export function PortionStepper({
  portions,
  planServings,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
}: PortionStepperProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <DetailCard>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text variant="bodyStrong">{t('nutritionRecipe.portions.title')}</Text>
          <Text variant="caption" color="muted">
            {planServings !== undefined
              ? t('nutritionRecipe.portions.planSays', { value: formatAmount(i18n.language, planServings) })
              : t('nutritionRecipe.portions.hint')}
          </Text>
        </View>
        <StepButton
          symbol="minus"
          label={t('nutritionRecipe.portions.fewer')}
          disabled={!canDecrease}
          onPress={onDecrease}
        />
        <Text variant="numeral" accessibilityLiveRegion="polite" style={styles.value}>
          {formatAmount(i18n.language, portions)}
        </Text>
        <StepButton
          symbol="plus"
          label={t('nutritionRecipe.portions.more')}
          disabled={!canIncrease}
          onPress={onIncrease}
        />
      </View>
    </DetailCard>
  );
}

type StepButtonProps = { symbol: SFSymbol; label: string; disabled: boolean; onPress: () => void };

function StepButton({ symbol, label, disabled, onPress }: StepButtonProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.step, disabled && styles.disabled]}
    >
      <SymbolView name={symbol} weight="medium" tintColor={theme.colors.ink} size={theme.sizes.stepGlyph} />
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    copy: {
      flex: 1,
      gap: theme.spacing.hair,
    },
    value: {
      minWidth: theme.sizes.checkbox,
      textAlign: 'center',
    },
    step: {
      width: theme.sizes.stepButton,
      height: theme.sizes.stepButton,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
    },
    disabled: {
      opacity: theme.opacity.disabled,
    },
  });
