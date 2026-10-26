import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Button } from '@/components/Button';
import { AddMeasurementSheet } from '@/components/measurements/AddMeasurementSheet';
import {
  isDecrease,
  joinNames,
  metricValueLabel,
  trendLabel,
  updatedLabel,
} from '@/components/measurements/format';
import { MeasurementRow } from '@/components/measurements/MeasurementRow';
import {
  METRICS,
  latestValue,
  rangeStart,
  seriesChange,
  seriesSince,
} from '@/components/measurements/metrics';
import type { Range } from '@/components/measurements/metrics';
import { Segmented } from '@/components/onboarding/Segmented';
import type { SegmentOption } from '@/components/onboarding/Segmented';
import { EMPTY_VALUE } from '@/components/profile/format';
import { ListCard } from '@/components/profile/ListCard';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useCollaborations } from '@/hooks/useCollaborations';
import { useMeasurementHistory, usePlanStart } from '@/hooks/useMeasurementHistory';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const FADE_ID = 'measurementsAddFade';
const FADE_SOLID_AT = 0.55;

/** The client's body measurements: latest values and trends per metric, plus the add sheet. */
export default function MeasurementsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets.bottom);
  const router = useRouter();
  const language = i18n.language;
  const historyQuery = useMeasurementHistory();
  const planStartQuery = usePlanStart();
  const collaborationsQuery = useCollaborations();
  const [chosenRange, setChosenRange] = useState<Range | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [now] = useState(() => Date.now());

  const entries = historyQuery.data ?? [];
  const planStart = planStartQuery.data ?? null;
  const planAvailable = planStart !== null;
  const defaultRange: Range = planAvailable ? 'plan' : 'month';
  const range: Range =
    chosenRange === null || (chosenRange === 'plan' && !planAvailable) ? defaultRange : chosenRange;
  const since = rangeStart(range, now, planStart);

  const rangeOptions: SegmentOption<Range>[] = [
    { value: 'month', label: t('measurements.ranges.month') },
    ...(planAvailable ? [{ value: 'plan' as const, label: t('measurements.ranges.plan') }] : []),
    { value: 'all', label: t('measurements.ranges.all') },
  ];

  const coachNames = (collaborationsQuery.data ?? [])
    .map((coach) => (coach.professionalName ?? '').trim().split(/\s+/)[0] ?? '')
    .filter((name) => name !== '');

  const rows = METRICS.filter(
    (metric) => metric.key !== 'biceps' || latestValue(entries, metric) !== undefined,
  ).map((metric) => {
    const latest = latestValue(entries, metric);
    const values = seriesSince(entries, metric, since);
    const change = seriesChange(values);
    const isEstimate = metric.key === 'bodyFat';
    return (
      <MeasurementRow
        key={metric.key}
        label={t(`measurements.metrics.${metric.key}`)}
        caption={
          isEstimate
            ? t('measurements.trend.estimate')
            : change === null
              ? undefined
              : trendLabel(t, language, range, change)
        }
        captionPositive={!isEstimate && change !== null && isDecrease(change)}
        values={values}
        value={latest === undefined ? EMPTY_VALUE : metricValueLabel(t, language, metric.unit, latest)}
      />
    );
  });

  return (
    <View style={styles.root}>
      <Screen
        scroll
        gutter={theme.spacing.xl}
        topGap={theme.spacing.safeAreaGap}
        bottomInset={theme.sizes.measureAddFade}
        contentStyle={styles.content}
      >
        <ScreenHeader
          title={t('measurements.title')}
          subtitle={entries.length > 0 ? updatedLabel(t, entries[0].at, now) : undefined}
          backLabel={t('onboarding.back')}
          onBack={() => router.back()}
        />

        {historyQuery.isPending ? (
          <View style={styles.state}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : historyQuery.isError ? (
          <View style={styles.error}>
            <Text variant="body" color="muted" style={styles.centered}>
              {t('measurements.error.history')}
            </Text>
            <Button label={t('measurements.error.retry')} onPress={() => void historyQuery.refetch()} />
          </View>
        ) : entries.length === 0 ? (
          <ListCard>
            <View style={styles.empty}>
              <Text variant="bodyStrong" style={styles.centered}>
                {t('measurements.empty.title')}
              </Text>
              <Text variant="body" color="muted" style={styles.centered}>
                {t('measurements.empty.body')}
              </Text>
            </View>
          </ListCard>
        ) : (
          <>
            <Segmented
              options={rangeOptions}
              value={range}
              onChange={setChosenRange}
              accessibilityLabel={t('measurements.ranges.label')}
            />
            <ListCard>{rows}</ListCard>
          </>
        )}

        {coachNames.length > 0 ? (
          <View style={styles.shared}>
            <SymbolView
              name="info.circle"
              tintColor={theme.colors.muted}
              size={theme.sizes.measureInfoGlyph}
            />
            <Text variant="label" color="muted" style={styles.sharedText}>
              {t('measurements.shared.line', { names: joinNames(t, coachNames) })}
            </Text>
          </View>
        ) : null}
      </Screen>

      <View pointerEvents="box-none" style={styles.addBar}>
        <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={FADE_ID} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.colors.ground} stopOpacity={0} />
              <Stop offset={FADE_SOLID_AT} stopColor={theme.colors.ground} stopOpacity={1} />
              <Stop offset="1" stopColor={theme.colors.ground} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${FADE_ID})`} />
        </Svg>
        <Button
          label={t('measurements.add')}
          onPress={() => setSheetOpen(true)}
          icon={
            <SymbolView name="plus" weight="semibold" tintColor={theme.colors.onPrimary} size={theme.sizes.fieldIcon} />
          }
        />
      </View>

      <AddMeasurementSheet
        visible={sheetOpen}
        entries={entries}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

const makeStyles = (theme: Theme, bottomInset: number) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.ground,
    },
    content: {
      gap: theme.spacing.lg,
    },
    state: {
      alignItems: 'center',
      paddingVertical: theme.spacing.xxl,
    },
    error: {
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xl,
    },
    empty: {
      gap: theme.spacing.xxs,
      paddingVertical: theme.spacing.xl,
    },
    centered: {
      textAlign: 'center',
    },
    shared: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xxs,
    },
    sharedText: {
      flex: 1,
    },
    addBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: theme.sizes.measureAddFade,
      justifyContent: 'flex-end',
      paddingHorizontal: theme.spacing.xxl,
      paddingBottom: Math.max(bottomInset, theme.sizes.measureAddBottom),
    },
  });
