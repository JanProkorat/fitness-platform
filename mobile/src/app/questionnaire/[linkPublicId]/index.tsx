import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InviteAvatar } from '@/components/invites/InviteAvatar';
import { RoleChip } from '@/components/invites/RoleChip';
import { Text } from '@/components/Text';
import { useFill } from '@/components/questionnaire/FillContext';
import { FlowFrame } from '@/components/questionnaire/FlowFrame';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Intro: who is asking, what the sections are, and Start. */
export default function QuestionnaireIntroScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const fill = useFill();
  const name = fill.coachFirstName || t('questionnaireFill.coachFallback');
  const sectioned = fill.steps.some((step) => step.type === 'section');
  const total = fill.steps.reduce((count, step) => count + step.questions.length, 0);

  const start = () => {
    if (fill.steps.length === 0) {
      router.push({ pathname: '/questionnaire/[linkPublicId]/review', params: { linkPublicId: fill.linkPublicId } });
      return;
    }
    router.push({
      pathname: '/questionnaire/[linkPublicId]/step/[step]',
      params: { linkPublicId: fill.linkPublicId, step: '1' },
    });
  };

  return (
    <FlowFrame
      header={{ onClose: fill.requestClose }}
      footer={<Button label={t('questionnaireFill.start')} onPress={start} />}
    >
      <View style={styles.coach}>
        <InviteAvatar name={fill.coachName} />
        <View style={styles.coachCopy}>
          <Text variant="subtitle" numberOfLines={1}>
            {fill.coachName || name}
          </Text>
          <View style={styles.chip}>
            <RoleChip coachRole={fill.coachRole} />
          </View>
        </View>
      </View>
      <View style={styles.heading}>
        <Text variant="title" accessibilityRole="header">
          {t('questionnaireFill.intro.title', { name })}
        </Text>
        <Text variant="bodyLarge" color="muted">
          {fill.description ?? t('questionnaireFill.intro.subtitle', { name })}
        </Text>
      </View>
      {total > 0 ? (
        <Card style={styles.card}>
          {sectioned ? (
            fill.steps.map((step, index) => (
              <IntroRow
                key={step.key}
                index={index + 1}
                title={step.title ?? t('questionnaireFill.unnamedSection')}
                count={step.questions.length}
                first={index === 0}
              />
            ))
          ) : (
            <IntroRow index={1} title={t('questionnaireFill.intro.allQuestions')} count={total} first />
          )}
        </Card>
      ) : null}
    </FlowFrame>
  );
}

type IntroRowProps = { index: number; title: string; count: number; first: boolean };

function IntroRow({ index, title, count, first }: IntroRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={[styles.row, !first && styles.rowDivider]}>
      <View style={styles.badge}>
        <Text variant="labelStrong">{index}</Text>
      </View>
      <Text variant="subtitle" style={styles.rowTitle} numberOfLines={2}>
        {title}
      </Text>
      <Text variant="bodySmall" color="muted">
        {t('questionnaireFill.intro.questionCount', { count })}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    coach: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.lg,
    },
    coachCopy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs,
    },
    chip: {
      flexDirection: 'row',
    },
    heading: {
      gap: theme.spacing.xxs,
    },
    card: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.cardInset,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.lg,
      paddingVertical: theme.spacing.lg,
    },
    rowDivider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.line,
    },
    badge: {
      width: theme.sizes.stepNumber,
      height: theme.sizes.stepNumber,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.stepIdle,
    },
    rowTitle: {
      flex: 1,
      minWidth: 0,
    },
  });
