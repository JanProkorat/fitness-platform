import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { ChoiceField } from '@/components/questionnaire/ChoiceField';
import { NumberField } from '@/components/questionnaire/NumberField';
import { ScaleField } from '@/components/questionnaire/ScaleField';
import { SmileyField } from '@/components/questionnaire/SmileyField';
import { StarField } from '@/components/questionnaire/StarField';
import { TextAnswerField } from '@/components/questionnaire/TextAnswerField';
import type { FieldProps } from '@/components/questionnaire/fieldProps';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type QuestionFieldProps = FieldProps & {
  /** Hide the label row when the screen title already is the question. */
  showLabel?: boolean;
};

/** One question: its label with a Required / Pick any / Optional note, then the matching answer control. */
export function QuestionField({ question, draft, onChange, showLabel = true }: QuestionFieldProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const hint = question.required
    ? t('questionnaireFill.required')
    : question.kind === 'multi_select'
      ? t('questionnaireFill.pickAny')
      : t('questionnaireFill.optional');

  return (
    <View style={styles.root}>
      {showLabel ? (
        <View style={styles.labelRow}>
          <Text variant="bodyStrong" style={styles.label}>
            {question.label}
          </Text>
          <Text variant="label" color="muted">
            {hint}
          </Text>
        </View>
      ) : (
        <Text variant="label" color="muted">
          {hint}
        </Text>
      )}
      {showLabel && question.helper ? (
        <Text variant="bodySmall" color="muted">
          {question.helper}
        </Text>
      ) : null}
      <Control question={question} draft={draft} onChange={onChange} />
    </View>
  );
}

function Control(props: FieldProps) {
  switch (props.question.kind) {
    case 'single_choice':
    case 'multi_select':
      return <ChoiceField {...props} />;
    case 'short_text':
      return <TextAnswerField {...props} />;
    case 'number':
      return <NumberField {...props} />;
    case 'smiley_rating':
      return <SmileyField {...props} />;
    case 'star_rating':
      return <StarField {...props} />;
    case 'scale':
      return <ScaleField {...props} />;
  }
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      gap: theme.spacing.sm,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    label: {
      flex: 1,
      minWidth: 0,
    },
  });
