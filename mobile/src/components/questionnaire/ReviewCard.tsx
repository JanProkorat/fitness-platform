import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { ReviewValue } from '@/components/questionnaire/ReviewValue';
import { EMPTY_DRAFT, answerState } from '@/components/questionnaire/fillModel';
import type { Drafts, FillQuestion, FillStep } from '@/components/questionnaire/fillModel';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type ReviewCardProps = {
  step: FillStep;
  drafts: Drafts;
  onEdit: () => void;
};

/** One section of the review: its answers and an Edit button that jumps back to that section. */
export function ReviewCard({ step, drafts, onEdit }: ReviewCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const single = step.type === 'single';
  const title = single ? (step.questions[0]?.label ?? '') : (step.title ?? t('questionnaireFill.unnamedSection'));

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="subtitle" style={styles.title}>
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('questionnaireFill.editSection', { section: title })}
          onPress={onEdit}
          style={styles.edit}
        >
          <Text variant="link">{t('questionnaireFill.edit')}</Text>
        </Pressable>
      </View>
      {step.questions.map((question) => (
        <View key={question.id} style={styles.row}>
          {single ? null : (
            <Text variant="bodySmall" color="muted">
              {question.label}
            </Text>
          )}
          <Answer question={question} drafts={drafts} />
        </View>
      ))}
    </Card>
  );
}

function Answer({ question, drafts }: { question: FillQuestion; drafts: Drafts }) {
  const { t } = useTranslation();
  const draft = drafts[question.id] ?? EMPTY_DRAFT;
  const state = answerState(question, draft);

  if (state === 'invalid' || (state === 'empty' && question.required)) {
    return (
      <Text variant="bodyStrong" color="error" accessibilityRole="alert">
        {t('questionnaireFill.missing')}
      </Text>
    );
  }
  return <ReviewValue question={question} draft={draft} />;
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      padding: 0,
      paddingHorizontal: theme.spacing.cardInset,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    title: {
      flex: 1,
      minWidth: 0,
    },
    edit: {
      minHeight: theme.sizes.buttonSmall,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
    },
    row: {
      gap: theme.spacing.hair,
      paddingVertical: theme.spacing.md,
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.line,
    },
  });
