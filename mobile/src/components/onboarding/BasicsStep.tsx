import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BODY_TYPES, LIMITS, SEXES } from '@/api/onboarding';
import { ChoiceCard } from '@/components/onboarding/ChoiceCard';
import { FormCard } from '@/components/onboarding/FormCard';
import { Segmented } from '@/components/onboarding/Segmented';
import { StepBody, StepGroup } from '@/components/onboarding/StepBody';
import type { StepProps } from '@/components/onboarding/stepProps';
import { Stepper } from '@/components/onboarding/Stepper';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const WEIGHT_STEP = 0.5;

/** Keeps a stepped weight free of floating-point noise. */
const roundWeight = (value: number): number => Math.round(value * 10) / 10;

export function BasicsStep({ form }: StepProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { answers, set } = form;
  const { age, heightCm, weightKg, targetWeightKg } = answers;

  const stepWeight = (direction: 1 | -1) => {
    // The first tap only shows the current weight as the starting point.
    const base = targetWeightKg ?? weightKg;
    const next = targetWeightKg === null ? base : roundWeight(base + direction * WEIGHT_STEP);
    set('targetWeightKg', Math.min(LIMITS.weightKg.max, Math.max(LIMITS.weightKg.min, next)));
  };

  return (
    <StepBody>
      <FormCard>
        <Segmented
          accessibilityLabel={t('onboarding.basics.sexLabel')}
          value={answers.sex}
          onChange={(value) => set('sex', value)}
          options={SEXES.map((value) => ({ value, label: t(`onboarding.basics.sex.${value}`) }))}
        />
        <Stepper
          label={t('onboarding.basics.age')}
          display={String(age)}
          unit={t('onboarding.basics.ageUnit')}
          canDecrease={age > LIMITS.age.min}
          canIncrease={age < LIMITS.age.max}
          onDecrease={() => set('age', age - 1)}
          onIncrease={() => set('age', age + 1)}
        />
        <Stepper
          label={t('onboarding.basics.height')}
          display={String(heightCm)}
          unit={t('onboarding.basics.heightUnit')}
          canDecrease={heightCm > LIMITS.heightCm.min}
          canIncrease={heightCm < LIMITS.heightCm.max}
          onDecrease={() => set('heightCm', heightCm - 1)}
          onIncrease={() => set('heightCm', heightCm + 1)}
        />
        <Stepper
          label={t('onboarding.basics.weight')}
          display={weightKg.toFixed(1)}
          unit={t('onboarding.basics.weightUnit')}
          canDecrease={weightKg > LIMITS.weightKg.min}
          canIncrease={weightKg < LIMITS.weightKg.max}
          onDecrease={() => set('weightKg', roundWeight(weightKg - WEIGHT_STEP))}
          onIncrease={() => set('weightKg', roundWeight(weightKg + WEIGHT_STEP))}
        />
        <Stepper
          label={t('onboarding.basics.targetWeight')}
          display={targetWeightKg === null ? null : targetWeightKg.toFixed(1)}
          unit={t('onboarding.basics.weightUnit')}
          optional
          canDecrease={targetWeightKg === null || targetWeightKg > LIMITS.weightKg.min}
          canIncrease={targetWeightKg === null || targetWeightKg < LIMITS.weightKg.max}
          onDecrease={() => stepWeight(-1)}
          onIncrease={() => stepWeight(1)}
        />
      </FormCard>
      <StepGroup>
        <Text variant="body" color="muted">
          {t('onboarding.basics.bodyTypeLabel')}
        </Text>
        <View accessibilityRole="radiogroup" style={styles.bodyTypes}>
          {BODY_TYPES.map((value) => (
            <ChoiceCard
              key={value}
              title={t(`onboarding.basics.bodyType.${value}.title`)}
              hint={t(`onboarding.basics.bodyType.${value}.hint`)}
              selected={answers.bodyType === value}
              onPress={() => set('bodyType', value)}
            />
          ))}
        </View>
      </StepGroup>
    </StepBody>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    bodyTypes: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
  });
