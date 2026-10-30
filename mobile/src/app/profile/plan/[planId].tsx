import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { getErrorStatus } from '@/api/errors';
import { isPlanId, planKind } from '@/api/plans';
import { Button } from '@/components/Button';
import { CoachAvatar } from '@/components/coach/CoachAvatar';
import { BeforeAfter } from '@/components/journey/BeforeAfter';
import { SummaryTile } from '@/components/journey/SummaryTile';
import {
  EMPTY_VALUE,
  changeLabel,
  dayRangeLabel,
  fromToLabel,
  parseTime,
  percentLabel,
  weeksBetween,
} from '@/components/journey/format';
import { PlanState } from '@/components/nutrition/plan/PlanState';
import { ListCard } from '@/components/profile/ListCard';
import { ListRow, RowIcon } from '@/components/profile/ListRow';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useClientPlans } from '@/hooks/useClientPlans';
import { usePlanSummary } from '@/hooks/usePlanSummary';
import { isOfflineEmpty } from '@/lib/queryState';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Results of one plan: sessions or meals, weight and waist change, and its before and after photos. */
export default function PlanSummaryScreen() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const params = useLocalSearchParams<{ planId?: string }>();
  const planId = typeof params.planId === 'string' ? params.planId : '';
  const valid = isPlanId(planId);

  const query = usePlanSummary(planId, valid);
  const plansQuery = useClientPlans();

  useEffect(() => {
    if (!valid) router.replace('/profile/journey');
  }, [valid, router]);

  const backLabel = t('onboarding.back');
  const goBack = () => router.back();

  if (valid && isOfflineEmpty(query)) {
    return <PlanState kind="offline" onBack={goBack} />;
  }

  if (!valid || query.isPending || query.data === undefined) {
    const notFound = valid && query.isError && getErrorStatus(query.error) === 404;
    return (
      <Screen gutter={theme.spacing.xl} topGap={theme.spacing.safeAreaGap}>
        <ScreenHeader title="" backLabel={backLabel} onBack={goBack} />
        <View style={styles.state}>
          {!valid || query.isPending ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (
            <>
              <Text variant="heading" accessibilityRole="header" style={styles.centered}>
                {notFound ? t('journey.summary.notFound.title') : t('journey.summary.error.title')}
              </Text>
              <Text variant="body" color="muted" style={styles.centered}>
                {notFound ? t('journey.summary.notFound.body') : t('journey.summary.error.body')}
              </Text>
              {notFound ? (
                <Button label={t('journey.summary.notFound.back')} onPress={() => router.back()} />
              ) : (
                <Button label={t('journey.error.retry')} onPress={() => void query.refetch()} />
              )}
            </>
          )}
        </View>
      </Screen>
    );
  }

  const summary = query.data;
  const kind = planKind(summary);
  const training = kind === 'training';
  const inkColor = training ? 'trainingInk' : 'nutritionInk';
  const start = parseTime(summary.startDate);
  const end = parseTime(summary.endDate);
  const [firstName = '', ...rest] = (summary.coachName ?? '').trim().split(/\s+/);
  const meta = [
    summary.coachName,
    start !== null && end !== null ? dayRangeLabel(language, start, end) : null,
    start !== null && end !== null ? t('journey.summary.weeks', { count: weeksBetween(start, end) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const done = summary.sessionsDone;
  const total = summary.sessionsTotal;
  const hasSessions = done !== undefined && total !== undefined;
  const mealsPercent = plansQuery.data?.find((plan) => plan.planId === summary.planId)?.mealsLoggedPercent;
  const shareDone = hasSessions && total > 0 ? percentLabel(t, language, (done / total) * 100) : null;
  const countFormat = new Intl.NumberFormat(language);

  const firstTile = training
    ? {
        label: t('journey.summary.sessions'),
        value: hasSessions
          ? t('journey.summary.sessionsValue', { done: countFormat.format(done), total: countFormat.format(total) })
          : EMPTY_VALUE,
        detail: shareDone ? t('journey.summary.completedShare', { value: shareDone }) : '',
      }
    : {
        label: t('journey.summary.mealsLogged'),
        value: percentLabel(t, language, mealsPercent),
        detail: t('journey.summary.ofPlanned'),
      };

  return (
    <Screen
      scroll
      gutter={theme.spacing.xl}
      topGap={theme.spacing.safeAreaGap}
      bottomInset={theme.spacing.huge}
      contentStyle={styles.content}
    >
      <ScreenHeader
        title={summary.planName ?? ''}
        subtitle={(summary.status === 'Active'
          ? t('journey.summary.activePlan')
          : t('journey.summary.completedPlan')
        ).toUpperCase()}
        subtitleColor={inkColor}
        backLabel={backLabel}
        onBack={goBack}
      />

      {summary.coachName || meta ? (
        <View style={styles.meta}>
          {summary.coachName ? (
            <CoachAvatar
              coach={{ firstName, lastName: rest.join(' ') }}
              size={theme.sizes.chatAvatar}
              initialsVariant="captionStrong"
            />
          ) : null}
          {meta ? (
            <Text variant="body" color="muted" style={styles.metaText}>
              {meta}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.tiles}>
        <SummaryTile {...firstTile} />
        <SummaryTile
          label={t('journey.summary.weight')}
          value={changeLabel(t, language, summary.weightStartKg, summary.weightEndKg, 'kg')}
          detail={fromToLabel(t, language, summary.weightStartKg, summary.weightEndKg, 'kg')}
        />
        <SummaryTile
          label={t('journey.summary.waist')}
          value={changeLabel(t, language, summary.waistStartCm, summary.waistEndCm, 'cm')}
          detail={fromToLabel(t, language, summary.waistStartCm, summary.waistEndCm, 'cm')}
        />
      </View>

      {summary.firstPhoto && summary.lastPhoto ? (
        <BeforeAfter first={summary.firstPhoto} last={summary.lastPhoto} />
      ) : null}

      {training && hasSessions ? (
        <ListCard>
          {/* The session list is built with the Training module; until then the row is shown, inert. */}
          <ListRow
            leading={<RowIcon symbol="list.bullet" tone="neutral" />}
            label={t('journey.summary.allSessions')}
            value={countFormat.format(done)}
          />
        </ListCard>
      ) : null}
    </Screen>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.lg,
    },
    state: {
      flex: 1,
      justifyContent: 'center',
      gap: theme.spacing.xl,
    },
    centered: {
      textAlign: 'center',
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    metaText: {
      flex: 1,
    },
    tiles: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
  });
