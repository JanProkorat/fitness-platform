import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DIET_STYLES, LIMITS, MEALS_PER_DAY } from '@/api/onboarding';
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

export function EatingStep({ form, openSheet }: StepProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { answers, set, setList } = form;

  const removeFrom = (key: 'allergies' | 'dislikes', index: number) =>
    setList(
      key,
      answers.lists[key].filter((_, at) => at !== index),
    );

  return (
    <StepBody>
      <FormCard>
        <StepGroup>
          <FieldLabel label={t('onboarding.eating.mealsLabel')} />
          <Segmented
            accessibilityLabel={t('onboarding.eating.mealsLabel')}
            value={answers.mealsPerDay}
            onChange={(value) => set('mealsPerDay', value)}
            options={MEALS_PER_DAY.map((value) => ({
              value,
              label: t(`onboarding.eating.meals.${value}`),
            }))}
          />
        </StepGroup>
        <StepGroup>
          <FieldLabel label={t('onboarding.eating.styleLabel')} />
          <Segmented
            accessibilityLabel={t('onboarding.eating.styleLabel')}
            value={answers.dietStyle}
            onChange={(value) => set('dietStyle', value)}
            options={DIET_STYLES.map((value) => ({
              value,
              label: t(`onboarding.eating.style.${value}`),
            }))}
          />
        </StepGroup>
        <View>
          <FieldLabel label={t('onboarding.eating.ratingLabel')} optional />
          <View style={styles.scale}>
            <RatingScale
              min={LIMITS.dietRating.min}
              max={LIMITS.dietRating.max}
              value={answers.dietRating}
              onChange={(value) => set('dietRating', value)}
              accessibilityLabel={t('onboarding.eating.ratingLabel')}
            />
          </View>
          <RatingEnds low={t('onboarding.eating.ratingLow')} high={t('onboarding.eating.ratingHigh')} />
        </View>
      </FormCard>
      <ChipInput
        label={t('onboarding.chips.allergies.label')}
        addLabel={t('onboarding.chips.allergies.add')}
        items={answers.lists.allergies}
        onRemove={(index) => removeFrom('allergies', index)}
        onAdd={() => openSheet('allergies')}
      />
      <ChipInput
        label={t('onboarding.chips.dislikes.label')}
        addLabel={t('onboarding.chips.dislikes.add')}
        items={answers.lists.dislikes}
        onRemove={(index) => removeFrom('dislikes', index)}
        onAdd={() => openSheet('dislikes')}
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
