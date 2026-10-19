import { StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { GOALS, HORIZONS } from '@/api/onboarding';
import type { Goal } from '@/api/onboarding';
import { ChoiceCard } from '@/components/onboarding/ChoiceCard';
import type { ChoiceTone } from '@/components/onboarding/ChoiceCard';
import { Segmented } from '@/components/onboarding/Segmented';
import { StepBody, StepGroup } from '@/components/onboarding/StepBody';
import type { StepProps } from '@/components/onboarding/stepProps';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const GOAL_LOOKS: Record<Goal, { symbol: SFSymbol; tone: ChoiceTone }> = {
  LoseFat: { symbol: 'flame', tone: 'accent' },
  GainMuscle: { symbol: 'dumbbell', tone: 'training' },
  Recomposition: { symbol: 'arrow.left.arrow.right', tone: 'training' },
  Fitness: { symbol: 'bolt', tone: 'info' },
  Health: { symbol: 'heart', tone: 'accent' },
  Maintain: { symbol: 'scalemass', tone: 'nutrition' },
  Performance: { symbol: 'chart.line.uptrend.xyaxis', tone: 'info' },
};

export function GoalStep({ form }: StepProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { answers, set } = form;

  return (
    <StepBody>
      <View accessibilityRole="radiogroup" style={styles.cards}>
        {GOALS.map((goal) => (
          <View key={goal} style={styles.cardRow}>
            <ChoiceCard
              title={t(`onboarding.goal.options.${goal}.title`)}
              hint={t(`onboarding.goal.options.${goal}.hint`)}
              symbol={GOAL_LOOKS[goal].symbol}
              tone={GOAL_LOOKS[goal].tone}
              selected={answers.goal === goal}
              indicator
              onPress={() => set('goal', goal)}
            />
          </View>
        ))}
      </View>
      <StepGroup>
        <Text variant="body" color="muted">
          {t('onboarding.goal.horizonLabel')}
        </Text>
        <Segmented
          accessibilityLabel={t('onboarding.goal.horizonLabel')}
          value={answers.horizon}
          onChange={(value) => set('horizon', value)}
          options={HORIZONS.map((value) => ({
            value,
            label: t(`onboarding.goal.horizon.${value}`),
          }))}
        />
      </StepGroup>
    </StepBody>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    cards: {
      gap: theme.spacing.xs,
    },
    cardRow: {
      flexDirection: 'row',
    },
  });
