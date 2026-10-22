import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  CURRENT_FREQUENCIES,
  DESIRED_DAYS,
  DIET_STYLES,
  GOALS,
  GYM_ACCESS,
  JOB_TYPES,
  LIMITS,
  MEALS_PER_DAY,
  SEXES,
} from '@/api/onboarding';
import { DATE_OF_BIRTH_AGE, formatDateOnly, parseDateOnly, roundHeight } from '@/api/onboardingAnswers';
import type { AnswerError, AnswerField, EditableAnswers } from '@/api/onboardingAnswers';
import { ChipSheet } from '@/components/onboarding/ChipSheet';
import { ChoiceSheet } from '@/components/profile/edit/ChoiceSheet';
import { DateOfBirthSheet, openDateOfBirthDialog } from '@/components/profile/edit/DateOfBirthSheet';
import { InfoRow } from '@/components/profile/edit/InfoRow';
import { SegmentedSheet } from '@/components/profile/edit/SegmentedSheet';
import { StepperSheet } from '@/components/profile/edit/StepperSheet';
import { StressSheet } from '@/components/profile/edit/StressSheet';
import { WeightSheet } from '@/components/profile/edit/WeightSheet';
import { ListCard } from '@/components/profile/ListCard';
import { SectionHeader } from '@/components/profile/SectionHeader';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const ALLERGY_SUGGESTIONS = ['Lactose', 'Eggs', 'Shellfish', 'TreeNuts', 'Soy', 'Sesame'] as const;

const LIST_FIELDS = ['activities', 'injuries', 'allergies', 'dislikes', 'habits'] as const;
type ListField = (typeof LIST_FIELDS)[number];

/** Where the steppers start when an answer has no value yet. */
const HEIGHT_START_CM = 170;
const SLEEP_START_HOURS = 7;

/** The bounds each range error names in its message. */
const ERROR_RANGES: Partial<Record<AnswerError, { min: number; max: number }>> = {
  weightRange: LIMITS.weightKg,
  heightRange: LIMITS.heightCm,
  sleepRange: LIMITS.sleepHours,
  stressRange: LIMITS.stress,
  dateOfBirthRange: DATE_OF_BIRTH_AGE,
};

/** Request property names that differ from the answer field names. */
const SERVER_NAMES: Partial<Record<AnswerField, string>> = {
  activities: 'preferredActivities',
};

type InfoSectionProps = {
  answers: EditableAnswers;
  errors: Partial<Record<AnswerField, AnswerError>>;
  /** True when the server named the request property in its last 400 response. */
  serverFlagged?: (field: string) => boolean;
  onChange: <K extends AnswerField>(field: K, value: EditableAnswers[K]) => void;
};

/** The My info block: every answer from sign-up as a tappable row that opens its own editor. */
export function InfoSection({ answers, errors, serverFlagged, onChange }: InfoSectionProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [open, setOpen] = useState<AnswerField | null>(null);
  const close = () => setOpen(null);

  const errorText = (field: AnswerField): string | undefined => {
    const error = errors[field];
    if (error) return t(`editProfile.errors.${error}`, ERROR_RANGES[error]);
    // The server can still refuse what the local checks accepted, such as a birthday edge case.
    return serverFlagged?.(SERVER_NAMES[field] ?? field) ? t('editProfile.errors.rejected') : undefined;
  };
  const listValue = (items: string[]): string | null => (items.length > 0 ? items.join(', ') : null);
  const listField = (field: ListField) => ({
    label: t(`editProfile.info.${field}`),
    value: listValue(answers[field]),
    error: errorText(field),
    onPress: () => setOpen(field),
  });
  const perWeek = (days: number) => t('editProfile.info.perWeekValue', { count: days });
  const number = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value);

  const dateOfBirthDay = answers.dateOfBirth === null ? null : parseDateOnly(answers.dateOfBirth);
  const dateOfBirthValue =
    dateOfBirthDay === null
      ? null
      : new Intl.DateTimeFormat(i18n.language, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(dateOfBirthDay);

  const openDateOfBirth = () => {
    if (Platform.OS === 'android') {
      openDateOfBirthDialog(answers.dateOfBirth, (picked) =>
        onChange('dateOfBirth', formatDateOnly(picked)),
      );
    } else {
      setOpen('dateOfBirth');
    }
  };

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
        <SectionHeader title={t('editProfile.info.aboutSection')} />
        <ListCard>
          <InfoRow
            label={t('editProfile.info.dateOfBirth')}
            value={dateOfBirthValue}
            error={errorText('dateOfBirth')}
            onPress={openDateOfBirth}
          />
          <InfoRow
            label={t('editProfile.info.sex')}
            value={answers.sex ? t(`onboarding.basics.sex.${answers.sex}`) : null}
            onPress={() => setOpen('sex')}
          />
          <InfoRow
            label={t('editProfile.info.height')}
            value={
              answers.heightCm === null
                ? null
                : t('editProfile.info.heightValue', { value: number(answers.heightCm) })
            }
            error={errorText('heightCm')}
            onPress={() => setOpen('heightCm')}
          />
        </ListCard>
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
            label={t('editProfile.info.currentFrequency')}
            value={
              answers.currentFrequency
                ? t(`onboarding.training.current.${answers.currentFrequency}`)
                : null
            }
            onPress={() => setOpen('currentFrequency')}
          />
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
          <InfoRow {...listField('activities')} />
          <InfoRow {...listField('injuries')} />
        </ListCard>
      </View>

      <View style={styles.group}>
        <SectionHeader title={t('editProfile.info.lifestyleSection')} />
        <ListCard>
          <InfoRow
            label={t('editProfile.info.job')}
            value={answers.jobType ? t(`onboarding.lifestyle.work.${answers.jobType}.title`) : null}
            onPress={() => setOpen('jobType')}
          />
          <InfoRow
            label={t('editProfile.info.sleep')}
            value={
              answers.sleepHours === null
                ? null
                : t('editProfile.info.sleepValue', { value: number(answers.sleepHours) })
            }
            error={errorText('sleepHours')}
            onPress={() => setOpen('sleepHours')}
          />
          <InfoRow
            label={t('editProfile.info.stress')}
            value={
              answers.stressLevel === null
                ? null
                : t('editProfile.info.stressValue', {
                    value: answers.stressLevel,
                    max: LIMITS.stress.max,
                  })
            }
            error={errorText('stressLevel')}
            onPress={() => setOpen('stressLevel')}
          />
        </ListCard>
      </View>

      <View style={styles.group}>
        <SectionHeader title={t('editProfile.info.eatingSection')} />
        <ListCard>
          <InfoRow
            label={t('editProfile.info.meals')}
            value={answers.mealsPerDay ? t(`onboarding.eating.meals.${answers.mealsPerDay}`) : null}
            onPress={() => setOpen('mealsPerDay')}
          />
          <InfoRow
            label={t('editProfile.info.diet')}
            value={answers.dietStyle ? t(`onboarding.eating.style.${answers.dietStyle}`) : null}
            onPress={() => setOpen('dietStyle')}
          />
          <InfoRow {...listField('allergies')} />
          <InfoRow {...listField('dislikes')} />
          <InfoRow {...listField('habits')} />
        </ListCard>
      </View>

      <DateOfBirthSheet
        visible={open === 'dateOfBirth'}
        title={t('editProfile.info.dateOfBirth')}
        value={answers.dateOfBirth}
        onSave={(day) => onChange('dateOfBirth', day)}
        onClose={close}
      />
      <SegmentedSheet
        visible={open === 'sex'}
        title={t('editProfile.info.sex')}
        options={SEXES.map((value) => ({ value, label: t(`onboarding.basics.sex.${value}`) }))}
        value={answers.sex}
        onSelect={(sex) => onChange('sex', sex)}
        onClose={close}
      />
      <StepperSheet
        visible={open === 'heightCm'}
        title={t('editProfile.info.height')}
        unit={t('onboarding.basics.heightUnit')}
        value={answers.heightCm}
        start={HEIGHT_START_CM}
        min={LIMITS.heightCm.min}
        max={LIMITS.heightCm.max}
        step={1}
        normalize={roundHeight}
        onSave={(cm) => onChange('heightCm', cm)}
        onClose={close}
      />
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
      <WeightSheet
        visible={open === 'targetWeightKg'}
        value={answers.targetWeightKg}
        onSave={(kg) => onChange('targetWeightKg', kg)}
        onClose={close}
      />
      <SegmentedSheet
        visible={open === 'currentFrequency'}
        title={t('editProfile.info.currentFrequency')}
        options={CURRENT_FREQUENCIES.map((value) => ({
          value,
          label: t(`onboarding.training.current.${value}`),
        }))}
        value={answers.currentFrequency}
        onSelect={(frequency) => onChange('currentFrequency', frequency)}
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
        visible={open === 'jobType'}
        title={t('editProfile.info.job')}
        options={JOB_TYPES.map((job) => ({
          value: job,
          title: t(`onboarding.lifestyle.work.${job}.title`),
          hint: t(`onboarding.lifestyle.work.${job}.hint`),
        }))}
        value={answers.jobType}
        onSelect={(job) => onChange('jobType', job)}
        onClose={close}
      />
      <StepperSheet
        visible={open === 'sleepHours'}
        title={t('editProfile.info.sleep')}
        unit={t('onboarding.lifestyle.sleepUnit')}
        value={answers.sleepHours}
        start={SLEEP_START_HOURS}
        min={LIMITS.sleepHours.min}
        max={LIMITS.sleepHours.max}
        step={1}
        onSave={(hours) => onChange('sleepHours', hours)}
        onClose={close}
      />
      <StressSheet
        visible={open === 'stressLevel'}
        title={t('editProfile.info.stress')}
        value={answers.stressLevel}
        onSave={(level) => onChange('stressLevel', level)}
        onClose={close}
      />
      <SegmentedSheet
        visible={open === 'mealsPerDay'}
        title={t('editProfile.info.meals')}
        options={MEALS_PER_DAY.map((value) => ({
          value,
          label: t(`onboarding.eating.meals.${value}`),
        }))}
        value={answers.mealsPerDay}
        onSelect={(meals) => onChange('mealsPerDay', meals)}
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
      {LIST_FIELDS.map((field) => (
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
