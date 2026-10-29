import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useFill } from '@/components/questionnaire/FillContext';
import { FlowFrame } from '@/components/questionnaire/FlowFrame';
import { QuestionField } from '@/components/questionnaire/QuestionField';
import { EMPTY_DRAFT, stepBlocked } from '@/components/questionnaire/fillModel';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** One step of the form: a section's questions, or a single question when the form has no sections. */
export default function QuestionnaireStepScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const fill = useFill();
  const params = useLocalSearchParams<{ step?: string; edit?: string }>();
  const number = Number.parseInt(params.step ?? '', 10);
  const step = fill.steps[number - 1];
  const editing = params.edit === '1';

  if (!step) {
    return <Redirect href={{ pathname: '/questionnaire/[linkPublicId]', params: { linkPublicId: fill.linkPublicId } }} />;
  }

  const total = fill.steps.length;
  const last = number === total;
  const single = step.type === 'single';
  const name = fill.coachFirstName || t('questionnaireFill.coachFallback');
  const firstQuestion = step.questions[0];
  const title = single ? (firstQuestion?.label ?? '') : (step.title ?? t('questionnaireFill.unnamedSection'));
  const subtitle = single && firstQuestion?.helper ? firstQuestion.helper : t('questionnaireFill.fromCoach', { name });

  const next = () => {
    if (editing) {
      router.back();
    } else if (last) {
      router.push({ pathname: '/questionnaire/[linkPublicId]/review', params: { linkPublicId: fill.linkPublicId } });
    } else {
      router.push({
        pathname: '/questionnaire/[linkPublicId]/step/[step]',
        params: { linkPublicId: fill.linkPublicId, step: String(number + 1) },
      });
    }
  };

  return (
    <FlowFrame
      header={{
        onBack: () => router.back(),
        onClose: fill.requestClose,
        progress: {
          label: t('questionnaireFill.stepOf', { step: number, total }),
          fraction: number / total,
        },
      }}
      footer={
        <Button
          label={
            editing
              ? t('questionnaireFill.backToReview')
              : last
                ? t('questionnaireFill.reviewAnswers')
                : t('questionnaireFill.continue')
          }
          onPress={next}
          disabled={stepBlocked(step, fill.drafts)}
        />
      }
    >
      <View style={styles.heading}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="bodyLarge" color="muted">
          {subtitle}
        </Text>
      </View>
      <View style={styles.questions}>
        {step.questions.map((question) => (
          <QuestionField
            key={question.id}
            question={question}
            draft={fill.drafts[question.id] ?? EMPTY_DRAFT}
            onChange={(patch) => fill.setDraft(question.id, patch)}
            showLabel={!single}
          />
        ))}
      </View>
    </FlowFrame>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    heading: {
      gap: theme.spacing.xxs,
    },
    questions: {
      gap: theme.spacing.xxxl,
    },
  });
