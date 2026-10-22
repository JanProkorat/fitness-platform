import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DESIRED_DAYS, DIET_STYLES, GOALS, GYM_ACCESS } from '@/api/onboarding';
import type { AnswerError, AnswerField, EditableAnswers } from '@/api/onboardingAnswers';
import { ChipSheet } from '@/components/onboarding/ChipSheet';
import { ChoiceSheet } from '@/components/profile/edit/ChoiceSheet';
import { InfoRow } from '@/components/profile/edit/InfoRow';
import { WeightSheet } from '@/components/profile/edit/WeightSheet';
import { ListCard } from '@/components/profile/ListCard';
import { SectionHeader } from '@/components/profile/SectionHeader';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const ALLERGY_SUGGESTIONS = ['Lactose', 'Eggs', 'Shellfish', 'TreeNuts', 'Soy', 'Sesame'] as const;

type ListField = 'injuries' | 'allergies' | 'dislikes';

type InfoSectionProps = {
  answers: EditableAnswers;
  errors: Partial<Record<AnswerField, AnswerError>>;
  onChange: <K extends AnswerField>(field: K, value: EditableAnswers[K]) => void;
};

/** The My info block: every answer from sign-up as a tappable row that opens its own editor. */
export function InfoSection({ answers, errors, onChange }: InfoSectionProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [open, setOpen] = useState<AnswerField | null>(null);
  const close = () => setOpen(null);

  const errorText = (field: AnswerField): string | undefined => {
    const error = errors[field];
    return error ? t(`editProfile.errors.${error}`) : undefined;
  };
  const listValue = (items: string[]): string | null => (items.length > 0 ? items.join(', ') : null);
  const listField = (field: ListField) => ({
    label: t(`editProfile.info.${field}`),
    value: listValue(answers[field]),
    error: errorText(field),
    onPress: () => setOpen(field),
  });
  const perWeek = (days: number) => t('editProfile.info.perWeekValue', { count: days });

  return (
    <View style={styles.root}>
      <View style={styles.intro}>
        <Text variant="subtitle" accessibilityRole="header">
          {t('editProfile.info.title')}
        </Text>
        <Text variant="label" color="muted">
          {t('editProfile.info.subtitle')}
        </Text>
      </View>

      <View style={styles.group}>
        <SectionHeader title={t('editProfile.info.goalSection')} />
        <ListCard>
          <InfoRow
            label={t('editProfile.info.goal')}
            value={answers.goal ? t(`profile.goals.${answers.goal}`) : null}
            onPress={() => setOpen('goal')}
          />
          <InfoRow
            label={t('editProfile.info.targetWeight')}
            value={
              answers.targetWeightKg === null
                ? null
                : t('profile.units.kg', { value: answers.targetWeightKg })
            }
            error={errorText('targetWeightKg')}
            onPress={() => setOpen('targetWeightKg')}
          />
        </ListCard>
      </View>

      <View style={styles.group}>
        <SectionHeader title={t('editProfile.info.trainingSection')} />
        <ListCard>
          <InfoRow
            label={t('editProfile.info.perWeek')}
            value={answers.desiredDays === null ? null : perWeek(answers.desiredDays)}
            onPress={() => setOpen('desiredDays')}
          />
          <InfoRow
            label={t('editProfile.info.gym')}
            value={answers.gymAccess ? t(`onboarding.training.gym.${answers.gymAccess}`) : null}
            onPress={() => setOpen('gymAccess')}
          />
          <InfoRow {...listField('injuries')} />
        </ListCard>
      </View>

      <View style={styles.group}>
        <SectionHeader title={t('editProfile.info.eatingSection')} />
        <ListCard>
          <InfoRow
            label={t('editProfile.info.diet')}
            value={answers.dietStyle ? t(`onboarding.eating.style.${answers.dietStyle}`) : null}
            onPress={() => setOpen('dietStyle')}
          />
          <InfoRow {...listField('allergies')} />
          <InfoRow {...listField('dislikes')} />
        </ListCard>
      </View>

      <ChoiceSheet
        visible={open === 'goal'}
        title={t('editProfile.info.goal')}
        options={GOALS.map((goal) => ({
          value: goal,
          title: t(`onboarding.goal.options.${goal}.title`),
          hint: t(`onboarding.goal.options.${goal}.hint`),
        }))}
        value={answers.goal}
        onSelect={(goal) => onChange('goal', goal)}
        onClose={close}
      />
      <ChoiceSheet
        visible={open === 'desiredDays'}
        title={t('editProfile.info.perWeek')}
        options={DESIRED_DAYS.map((days) => ({ value: days, title: perWeek(days) }))}
        value={answers.desiredDays}
        onSelect={(days) => onChange('desiredDays', days)}
        onClose={close}
      />
      <ChoiceSheet
        visible={open === 'gymAccess'}
        title={t('editProfile.info.gym')}
        options={GYM_ACCESS.map((access) => ({
          value: access,
          title: t(`onboarding.training.gym.${access}`),
        }))}
        value={answers.gymAccess}
        onSelect={(access) => onChange('gymAccess', access)}
        onClose={close}
      />
      <ChoiceSheet
        visible={open === 'dietStyle'}
        title={t('editProfile.info.diet')}
        options={DIET_STYLES.map((style) => ({
          value: style,
          title: t(`onboarding.eating.style.${style}`),
        }))}
        value={answers.dietStyle}
        onSelect={(style) => onChange('dietStyle', style)}
        onClose={close}
      />
      <WeightSheet
        visible={open === 'targetWeightKg'}
        value={answers.targetWeightKg}
        onSave={(kg) => onChange('targetWeightKg', kg)}
        onClose={close}
      />
      {(['injuries', 'allergies', 'dislikes'] as const).map((field) => (
        <ChipSheet
          key={field}
          visible={open === field}
          title={t(`onboarding.chips.${field}.label`)}
          items={answers[field]}
          suggestions={
            field === 'allergies'
              ? ALLERGY_SUGGESTIONS.map((suggestion) => t(`onboarding.sheet.suggestions.${suggestion}`))
              : undefined
          }
          onChange={(items) => onChange(field, items)}
          onClose={close}
        />
      ))}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      gap: theme.spacing.xl,
    },
    intro: {
      gap: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.xxs,
    },
    group: {
      gap: theme.spacing.snug,
    },
  });
