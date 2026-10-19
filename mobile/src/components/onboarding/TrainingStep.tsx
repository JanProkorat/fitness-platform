import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CURRENT_FREQUENCIES, DESIRED_DAYS, GYM_ACCESS, LIMITS } from '@/api/onboarding';
import { ChipInput } from '@/components/onboarding/ChipInput';
import { FieldLabel } from '@/components/onboarding/FieldLabel';
import { FormCard } from '@/components/onboarding/FormCard';
import { RatingEnds } from '@/components/onboarding/RatingEnds';
import { RatingScale } from '@/components/onboarding/RatingScale';
import { Segmented } from '@/components/onboarding/Segmented';
import { StepBody, StepGroup } from '@/components/onboarding/StepBody';
import type { StepProps } from '@/components/onboarding/stepProps';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const NO_READOUT = '–';

export function TrainingStep({ form, openSheet }: StepProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { answers, set, setList } = form;
  const { fitness } = answers;

  const removeFrom = (key: 'activities' | 'injuries', index: number) =>
    setList(
      key,
      answers.lists[key].filter((_, at) => at !== index),
    );

  return (
    <StepBody>
      <FormCard>
        <StepGroup>
          <FieldLabel label={t('onboarding.training.currentLabel')} />
          <Segmented
            accessibilityLabel={t('onboarding.training.currentLabel')}
            value={answers.currentFrequency}
            onChange={(value) => set('currentFrequency', value)}
            options={CURRENT_FREQUENCIES.map((value) => ({
              value,
              label: t(`onboarding.training.current.${value}`),
            }))}
          />
        </StepGroup>
        <StepGroup>
          <FieldLabel label={t('onboarding.training.daysLabel')} />
          <Segmented
            accessibilityLabel={t('onboarding.training.daysLabel')}
            value={answers.desiredDays}
            onChange={(value) => set('desiredDays', value)}
            options={DESIRED_DAYS.map((value) => ({ value, label: String(value) }))}
          />
        </StepGroup>
        <View>
          <FieldLabel
            label={t('onboarding.training.fitnessLabel')}
            readout={`${fitness ?? NO_READOUT} / ${LIMITS.fitness.max}`}
          />
          <View style={styles.scale}>
            <RatingScale
              min={LIMITS.fitness.min}
              max={LIMITS.fitness.max}
              value={fitness}
              onChange={(value) => set('fitness', value)}
              accessibilityLabel={t('onboarding.training.fitnessLabel')}
            />
          </View>
          <RatingEnds low={t('onboarding.training.fitnessLow')} high={t('onboarding.training.fitnessHigh')} />
        </View>
        <StepGroup>
          <FieldLabel label={t('onboarding.training.gymLabel')} optional />
          <Segmented
            accessibilityLabel={t('onboarding.training.gymLabel')}
            value={answers.gymAccess}
            onChange={(value) => set('gymAccess', value)}
            options={GYM_ACCESS.map((value) => ({
              value,
              label: t(`onboarding.training.gym.${value}`),
            }))}
          />
        </StepGroup>
      </FormCard>
      <ChipInput
        label={t('onboarding.chips.activities.label')}
        addLabel={t('onboarding.chips.activities.add')}
        items={answers.lists.activities}
        onRemove={(index) => removeFrom('activities', index)}
        onAdd={() => openSheet('activities')}
      />
      <ChipInput
        label={t('onboarding.chips.injuries.label')}
        addLabel={t('onboarding.chips.injuries.add')}
        items={answers.lists.injuries}
        onRemove={(index) => removeFrom('injuries', index)}
        onAdd={() => openSheet('injuries')}
      />
    </StepBody>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scale: {
      paddingTop: theme.spacing.xs,
    },
  });
