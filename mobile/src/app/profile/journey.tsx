import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { isActivePlan, planKind } from '@/api/plans';
import { BackButton } from '@/components/BackButton';
import { JourneyChart } from '@/components/journey/JourneyChart';
import { JourneyError } from '@/components/journey/JourneyError';
import { PlanRow } from '@/components/journey/PlanRow';
import {
  changeLabel,
  domainOf,
  fromToLabel,
  journeyRangeLabel,
  parseTime,
  planWindow,
} from '@/components/journey/format';
import type { PlanBand, SeriesPoint, Unit } from '@/components/journey/format';
import { Segmented } from '@/components/onboarding/Segmented';
import type { SegmentOption } from '@/components/onboarding/Segmented';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useClientPlans } from '@/hooks/useClientPlans';
import { useJourneyPhotos } from '@/hooks/useJourneyPhotos';
import { useJourneySeries } from '@/hooks/useJourneySeries';
import { usePlanSummaries } from '@/hooks/usePlanSummary';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type Tab = 'weight' | 'waist' | 'photos';
type Metric = Exclude<Tab, 'photos'>;

const UNITS: Record<Metric, Unit> = { weight: 'kg', waist: 'cm' };

/** The client's whole journey: weight or waist over time against their plans, plus the list of plans. */
export default function JourneyScreen() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const [metric, setMetric] = useState<Metric>('weight');
  // Fixed for the lifetime of the screen so the chart and the plan rows agree on "now".
  const [now] = useState(() => Date.now());

  const seriesQuery = useJourneySeries();
  const photosQuery = useJourneyPhotos();
  const plansQuery = useClientPlans();

  const plans = useMemo(() => {
    const items = [...(plansQuery.data ?? [])];
    return items.sort((a, b) => {
      const activeA = isActivePlan(a);
      const activeB = isActivePlan(b);
      if (activeA !== activeB) return activeA ? -1 : 1;
      if (activeA && planKind(a) !== planKind(b)) return planKind(a) === 'training' ? -1 : 1;
      return (parseTime(b.startDate) ?? 0) - (parseTime(a.startDate) ?? 0);
    });
  }, [plansQuery.data]);

  const finishedIds = plans.filter((plan) => !isActivePlan(plan)).map((plan) => plan.planId ?? '');
  const summaries = usePlanSummaries(finishedIds);
  const summaryById = new Map(finishedIds.map((id, index) => [id, summaries[index]?.data]));

  const bands = useMemo<PlanBand[]>(
    () =>
      plans.flatMap((plan) => {
        const window = planWindow(plan, now, isActivePlan(plan));
        return window ? [{ kind: planKind(plan), ...window }] : [];
      }),
    [plans, now],
  );

  const measurements = seriesQuery.data;
  const points = useMemo<SeriesPoint[]>(
    () =>
      (measurements ?? []).flatMap((point) => {
        const value = metric === 'weight' ? point.weightKg : point.waistCm;
        return value === undefined ? [] : [{ at: point.at, value }];
      }),
    [measurements, metric],
  );
  const domain = useMemo(
    () =>
      domainOf([
        ...(measurements ?? []).map((point) => point.at),
        ...bands.flatMap((band) => [band.from, band.to]),
      ]),
    [measurements, bands],
  );

  const first = points[0];
  const last = points[points.length - 1];
  const unit = UNITS[metric];
  const photoDates = photosQuery.data ?? [];

  const options: SegmentOption<Tab>[] = [
    { value: 'weight', label: t('journey.tabs.weight') },
    { value: 'waist', label: t('journey.tabs.waist') },
    { value: 'photos', label: t('journey.tabs.photos') },
  ];
  // Photos opens its own screen; the chart keeps showing the last measurement tab.
  const onTab = (tab: Tab) => {
    if (tab === 'photos') {
      router.push('/profile/photos');
      return;
    }
    setMetric(tab);
  };

  const legend: { key: string; label: string; color: string; ring?: boolean }[] = [
    ...(bands.some((band) => band.kind === 'training')
      ? [{ key: 'training', label: t('journey.legend.training'), color: theme.colors.training }]
      : []),
    ...(bands.some((band) => band.kind === 'nutrition')
      ? [{ key: 'nutrition', label: t('journey.legend.nutrition'), color: theme.colors.nutrition }]
      : []),
    ...(photoDates.length > 0
      ? [{ key: 'photos', label: t('journey.legend.photos'), color: theme.colors.accent, ring: true }]
      : []),
  ];

  return (
    <Screen
      scroll
      gutter={theme.spacing.xl}
      topGap={theme.spacing.safeAreaGap}
      bottomInset={theme.spacing.huge}
      contentStyle={styles.content}
    >
      <View style={styles.topBar}>
        <BackButton label={t('onboarding.back')} onPress={() => router.back()} />
      </View>

      <View style={styles.titles}>
        {domain ? (
          <Text variant="bodyLarge" color="muted">
            {journeyRangeLabel(language, domain.start, domain.end)}
          </Text>
        ) : null}
        <Text variant="title" accessibilityRole="header">
          {t('journey.title')}
        </Text>
      </View>

      <Segmented
        options={options}
        value={metric}
        onChange={onTab}
        accessibilityLabel={t('journey.tabs.label')}
      />

      <View style={styles.card}>
        {seriesQuery.isPending ? (
          <View style={styles.state}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : seriesQuery.isError ? (
          <JourneyError
            message={t('journey.error.series')}
            retryLabel={t('journey.error.retry')}
            onRetry={() => void seriesQuery.refetch()}
          />
        ) : first && last && points.length >= 2 && domain ? (
          <>
            <View style={styles.headline}>
              <Text variant="display" accessibilityRole="header">
                {changeLabel(t, language, first.value, last.value, unit)}
              </Text>
              <Text variant="bodySmall" color="muted">
                {fromToLabel(t, language, first.value, last.value, unit)}
              </Text>
            </View>
            <JourneyChart points={points} bands={bands} photoDates={photoDates} domain={domain} />
            {legend.length > 0 ? (
              <View style={styles.legend}>
                {legend.map((item) => (
                  <View key={item.key} style={styles.legendItem}>
                    <View
                      style={[
                        item.ring ? styles.legendRing : styles.legendDash,
                        item.ring ? { borderColor: item.color } : { backgroundColor: item.color },
                      ]}
                    />
                    <Text variant="bodySmall" color="muted">
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {photosQuery.isError ? (
              <JourneyError
                message={t('journey.error.photos')}
                retryLabel={t('journey.error.retry')}
                onRetry={() => void photosQuery.refetch()}
              />
            ) : null}
          </>
        ) : (
          <View style={styles.state}>
            <Text variant="body" color="muted" style={styles.centered}>
              {t(`journey.chart.empty.${metric}`)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text variant="heading" accessibilityRole="header">
          {t('journey.plans.title')}
        </Text>
        {plansQuery.isPending ? (
          <View style={styles.state}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : plansQuery.isError ? (
          <JourneyError
            message={t('journey.error.plans')}
            retryLabel={t('journey.error.retry')}
            onRetry={() => void plansQuery.refetch()}
          />
        ) : plans.length === 0 ? (
          <View style={styles.state}>
            <Text variant="body" color="muted" style={styles.centered}>
              {t('journey.plans.empty')}
            </Text>
          </View>
        ) : (
          plans.map((plan) => {
            const planId = plan.planId ?? '';
            return (
              <View key={planId} style={styles.planDivider}>
                <PlanRow
                  plan={plan}
                  now={now}
                  summary={summaryById.get(planId)}
                  onPress={
                    isActivePlan(plan) ? undefined : () => router.push(`/profile/plan/${planId}`)
                  }
                />
              </View>
            );
          })
        )}
      </View>
    </Screen>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.lg,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    titles: {
      gap: theme.spacing.xxs,
    },
    card: {
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.xl,
      borderRadius: theme.radii.xxl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    headline: {
      flexDirection: 'row',
      alignItems: 'baseline',
      flexWrap: 'wrap',
      columnGap: theme.spacing.md,
      marginBottom: theme.spacing.xl,
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: theme.spacing.xl,
      rowGap: theme.spacing.xs,
      marginTop: theme.spacing.lg,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    legendDash: {
      width: theme.sizes.ruleDot,
      height: theme.sizes.progressBar,
      borderRadius: theme.radii.pill,
    },
    legendRing: {
      width: theme.sizes.statusDot + theme.sizes.borderStrong * 2,
      height: theme.sizes.statusDot + theme.sizes.borderStrong * 2,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.borderStrong,
    },
    state: {
      alignItems: 'center',
      paddingVertical: theme.spacing.xxl,
    },
    centered: {
      textAlign: 'center',
    },
    planDivider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.lineStrong,
      marginTop: theme.spacing.md,
    },
  });
