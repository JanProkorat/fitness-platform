import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { TOTAL_STEPS } from '@/api/onboarding';
import type { ChipListKey } from '@/api/onboarding';
import { Button } from '@/components/Button';
import { BasicsStep } from '@/components/onboarding/BasicsStep';
import { ChipSheet } from '@/components/onboarding/ChipSheet';
import { EatingStep } from '@/components/onboarding/EatingStep';
import { GoalStep } from '@/components/onboarding/GoalStep';
import { LifestyleStep } from '@/components/onboarding/LifestyleStep';
import { MotivationStep } from '@/components/onboarding/MotivationStep';
import { StepHeader } from '@/components/onboarding/StepHeader';
import { TrainingStep } from '@/components/onboarding/TrainingStep';
import { Text } from '@/components/Text';
import { useOnboardingForm } from '@/hooks/useOnboardingForm';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const STEPS = [GoalStep, BasicsStep, LifestyleStep, TrainingStep, EatingStep, MotivationStep];

const STEP_KEYS = ['goal', 'basics', 'lifestyle', 'training', 'eating', 'motivation'] as const;

const ALLERGY_SUGGESTIONS = ['Lactose', 'Eggs', 'Shellfish', 'TreeNuts', 'Soy', 'Sesame'] as const;

/** The client's six-step questionnaire; the step is screen state, not a route. */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets);
  const form = useOnboardingForm();
  const [sheetKey, setSheetKey] = useState<ChipListKey>('allergies');
  const [sheetOpen, setSheetOpen] = useState(false);
  const { step, goBack } = form;

  // Hardware back goes to the previous step; on the first step it keeps its default.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step <= 1) return false;
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [step, goBack]);

  const StepComponent = STEPS[step - 1];
  const stepKey = STEP_KEYS[step - 1];

  const openSheet = (key: ChipListKey) => {
    setSheetKey(key);
    setSheetOpen(true);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <StepHeader
          step={step}
          total={TOTAL_STEPS}
          onBack={step > 1 ? () => goBack() : undefined}
        />
      </View>
      <ScrollView
        key={step}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
      >
        <View style={styles.heading}>
          <Text variant="title" accessibilityRole="header">
            {t(`onboarding.${stepKey}.title`)}
          </Text>
          <Text variant="bodyLarge" color="muted">
            {t(`onboarding.${stepKey}.subtitle`)}
          </Text>
        </View>
        <StepComponent form={form} openSheet={openSheet} />
      </ScrollView>
      <View style={styles.footer}>
        <Button
          label={form.isLastStep ? t('onboarding.finish') : t('onboarding.continue')}
          onPress={form.advance}
          disabled={!form.valid || form.isPending}
        />
        <Text variant="label" color="error" accessibilityRole="alert" style={styles.error}>
          {form.failure ? t(`onboarding.errors.${form.failure}`) : ' '}
        </Text>
      </View>
      <ChipSheet
        visible={sheetOpen}
        title={t(`onboarding.chips.${sheetKey}.label`)}
        items={form.answers.lists[sheetKey]}
        suggestions={
          sheetKey === 'allergies'
            ? ALLERGY_SUGGESTIONS.map((suggestion) => t(`onboarding.sheet.suggestions.${suggestion}`))
            : undefined
        }
        onChange={(items) => form.setList(sheetKey, items)}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

const makeStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.ground,
    },
    header: {
      paddingTop: insets.top + theme.spacing.huge,
      paddingBottom: theme.spacing.md,
      paddingLeft: insets.left + theme.spacing.xxl,
      paddingRight: insets.right + theme.spacing.xxl,
    },
    scroll: {
      flex: 1,
    },
    content: {
      gap: theme.spacing.xxl,
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.xxl,
      paddingLeft: insets.left + theme.spacing.xxl,
      paddingRight: insets.right + theme.spacing.xxl,
    },
    heading: {
      gap: theme.spacing.xxs,
    },
    footer: {
      gap: theme.spacing.xs,
      paddingTop: theme.spacing.md,
      paddingBottom: Math.max(insets.bottom, theme.spacing.xl),
      paddingLeft: insets.left + theme.spacing.xxl,
      paddingRight: insets.right + theme.spacing.xxl,
    },
    error: {
      textAlign: 'center',
    },
  });
