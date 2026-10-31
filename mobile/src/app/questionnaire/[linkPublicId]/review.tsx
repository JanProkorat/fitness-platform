import { useEffect } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useFill } from '@/components/questionnaire/FillContext';
import { FlowFrame } from '@/components/questionnaire/FlowFrame';
import { ReviewCard } from '@/components/questionnaire/ReviewCard';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Review: every answer by section, an Edit button per section, and Send. */
export default function QuestionnaireReviewScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const fill = useFill();
  const { failure, leave } = fill;
  const name = fill.coachFirstName || t('questionnaireFill.coachFallback');

  // The form is gone or already sent: say so, then leave. Answers cannot be kept in either case.
  useEffect(() => {
    if (failure !== 'unavailable' && failure !== 'alreadySent') return;
    Alert.alert(
      t(`questionnaireFill.errors.${failure}.title`),
      t(`questionnaireFill.errors.${failure}.body`),
      [{ text: t('questionnaireFill.errors.ok'), onPress: leave }],
      { cancelable: false },
    );
  }, [failure, leave, t]);

  const send = () => {
    fill.send(() =>
      router.replace({ pathname: '/questionnaire/[linkPublicId]/sent', params: { linkPublicId: fill.linkPublicId } }),
    );
  };

  const inlineError =
    failure && failure !== 'unavailable' && failure !== 'alreadySent'
      ? t(`questionnaireFill.errors.${failure}`)
      : fill.blocked
        ? t('questionnaireFill.errors.requiredMissing')
        : null;

  return (
    <FlowFrame
      header={{
        onBack: () => router.back(),
        onClose: fill.requestClose,
        progress: { label: t('questionnaireFill.review.progress'), fraction: 1 },
      }}
      footer={
        <>
          {inlineError ? (
            <Text variant="label" color="error" accessibilityRole="alert" style={styles.note}>
              {inlineError}
            </Text>
          ) : (
            <Text variant="label" color="muted" style={styles.note}>
              {t('questionnaireFill.review.note', { name })}
            </Text>
          )}
          <Button
            label={fill.sending ? t('questionnaireFill.sending') : t('questionnaireFill.send', { name })}
            onPress={send}
            disabled={fill.blocked || fill.sending}
            icon={
              fill.sending ? undefined : (
                <SymbolView
                  name="arrow.up"
                  weight="semibold"
                  tintColor={theme.colors.onPrimary}
                  size={theme.sizes.stepGlyph}
                />
              )
            }
          />
        </>
      }
    >
      <View style={styles.heading}>
        <Text variant="title" accessibilityRole="header">
          {t('questionnaireFill.review.title')}
        </Text>
        <Text variant="bodyLarge" color="muted">
          {t('questionnaireFill.review.subtitle')}
        </Text>
      </View>
      <View style={styles.cards}>
        {fill.steps.map((step, index) => (
          <ReviewCard
            key={step.key}
            step={step}
            drafts={fill.drafts}
            onEdit={() =>
              router.push({
                pathname: '/questionnaire/[linkPublicId]/step/[step]',
                params: { linkPublicId: fill.linkPublicId, step: String(index + 1), edit: '1' },
              })
            }
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
    cards: {
      gap: theme.spacing.lg,
    },
    note: {
      textAlign: 'center',
    },
  });
