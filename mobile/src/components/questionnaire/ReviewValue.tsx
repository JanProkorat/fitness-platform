import { StyleSheet, View } from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { Stars } from '@/components/questionnaire/StarField';
import { RATING_MAX, answerState, parseDecimal } from '@/components/questionnaire/fillModel';
import type { Draft, FillQuestion } from '@/components/questionnaire/fillModel';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type ReviewValueProps = {
  question: FillQuestion;
  draft: Draft;
};

/** An answer as plain text, stars for a star rating, or "Not answered". */
export function ReviewValue({ question, draft }: ReviewValueProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  if (answerState(question, draft) !== 'answered') {
    return (
      <Text variant="bodyLarge" color="muted">
        {t('questionnaireFill.notAnswered')}
      </Text>
    );
  }

  if (question.kind === 'star_rating') {
    return (
      <View
        accessible
        accessibilityLabel={t('questionnaireFill.rating.ofMax', { value: draft.number, max: RATING_MAX })}
        style={styles.stars}
      >
        <Stars value={draft.number} size={theme.sizes.mealStatusGlyph} color={theme.colors.trainingInk} />
      </View>
    );
  }

  return (
    <Text variant="subtitle">{formatAnswer(question, draft, t)}</Text>
  );
}

function formatAnswer(question: FillQuestion, draft: Draft, t: TFunction): string {
  switch (question.kind) {
    case 'single_choice':
      return draft.otherOn ? draft.other.trim() : draft.text;
    case 'multi_select':
      return [...draft.selected, ...(draft.otherOn && draft.other.trim() ? [draft.other.trim()] : [])].join(', ');
    case 'short_text':
      return draft.text.trim();
    case 'number': {
      const value = parseDecimal(draft.text);
      return question.unit ? `${value} ${question.unit}` : String(value);
    }
    case 'smiley_rating':
    case 'star_rating':
      return t('questionnaireFill.rating.ofMax', { value: draft.number, max: RATING_MAX });
    case 'scale':
      return t('questionnaireFill.rating.ofMax', { value: draft.number, max: question.max });
  }
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    stars: {
      flexDirection: 'row',
      gap: theme.spacing.hair,
    },
  });
