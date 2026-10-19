import { StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { JOB_TYPES, LIMITS } from '@/api/onboarding';
import type { JobType } from '@/api/onboarding';
import { ChoiceCard } from '@/components/onboarding/ChoiceCard';
import type { ChoiceTone } from '@/components/onboarding/ChoiceCard';
import { FieldLabel } from '@/components/onboarding/FieldLabel';
import { FormCard } from '@/components/onboarding/FormCard';
import { RatingEnds } from '@/components/onboarding/RatingEnds';
import { RatingScale } from '@/components/onboarding/RatingScale';
import { StepBody, StepGroup } from '@/components/onboarding/StepBody';
import type { StepProps } from '@/components/onboarding/stepProps';
import { Stepper } from '@/components/onboarding/Stepper';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const JOB_LOOKS: Record<JobType, { symbol: SFSymbol; tone: ChoiceTone }> = {
  Sedentary: { symbol: 'desktopcomputer', tone: 'info' },
  Standing: { symbol: 'figure.walk', tone: 'training' },
  Physical: { symbol: 'shippingbox', tone: 'nutrition' },
};

const NO_READOUT = ' ';

export function LifestyleStep({ form }: StepProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { answers, set } = form;
  const { sleepHours, stress } = answers;

  return (
    <StepBody>
      <StepGroup>
        <Text variant="body" color="muted">
          {t('onboarding.lifestyle.workLabel')}
        </Text>
        <View accessibilityRole="radiogroup" style={styles.cards}>
          {JOB_TYPES.map((job) => (
            <View key={job} style={styles.cardRow}>
              <ChoiceCard
                title={t(`onboarding.lifestyle.work.${job}.title`)}
                hint={t(`onboarding.lifestyle.work.${job}.hint`)}
                symbol={JOB_LOOKS[job].symbol}
                tone={JOB_LOOKS[job].tone}
                selected={answers.jobType === job}
                indicator
                onPress={() => set('jobType', job)}
              />
            </View>
          ))}
        </View>
      </StepGroup>
      <FormCard>
        <Stepper
          label={t('onboarding.lifestyle.sleep')}
          display={String(sleepHours)}
          unit={t('onboarding.lifestyle.sleepUnit')}
          canDecrease={sleepHours > LIMITS.sleepHours.min}
          canIncrease={sleepHours < LIMITS.sleepHours.max}
          onDecrease={() => set('sleepHours', sleepHours - 1)}
          onIncrease={() => set('sleepHours', sleepHours + 1)}
        />
        <View>
          <FieldLabel
            label={t('onboarding.lifestyle.stress')}
            readout={stress === null ? NO_READOUT : t(`onboarding.lifestyle.stressWords.${stress}`)}
          />
          <View style={styles.scale}>
            <RatingScale
              min={LIMITS.stress.min}
              max={LIMITS.stress.max}
              value={stress}
              onChange={(value) => set('stress', value)}
              accessibilityLabel={t('onboarding.lifestyle.stress')}
            />
          </View>
          <RatingEnds
            low={t(`onboarding.lifestyle.stressWords.${LIMITS.stress.min}`)}
            high={t(`onboarding.lifestyle.stressWords.${LIMITS.stress.max}`)}
          />
        </View>
      </FormCard>
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
    scale: {
      paddingTop: theme.spacing.xs,
    },
  });
