import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { dueWeekday } from '@/components/checkIns/model';
import { AddMeasurementSheet } from '@/components/measurements/AddMeasurementSheet';
import { useCheckInHistory } from '@/hooks/useCheckInHistory';
import { useCollaborations } from '@/hooks/useCollaborations';
import { useLocalDayChange } from '@/hooks/useLocalDayChange';
import { useMeasurementHistory } from '@/hooks/useMeasurementHistory';
import { usePhotos } from '@/hooks/usePhotos';
import { useProfileSummary } from '@/hooks/useProfileSummary';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { StatTile } from './StatTile';
import { daysSinceNewestPhoto, openCheckIn, weeklyWeightChange } from './statTileData';
import { checkInDaysLabel } from './todayFormat';

/** Shown in a tile whose source could not be read. */
const PLACEHOLDER_VALUE = '–';

/** Weight, photos and check-in at a glance; a tile whose source fails shows a placeholder and the others stay. */
export function StatTiles() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const language = i18n.language;
  const [sheetOpen, setSheetOpen] = useState(false);

  const summary = useProfileSummary();
  const measurements = useMeasurementHistory();
  const photos = usePhotos();
  const checkIns = useCheckInHistory();
  const collaborations = useCollaborations();
  // Day precision is enough here; reading the clock in render is impure, so derive it from the current day.
  const day = useLocalDayChange();
  const now = useMemo(() => {
    const [year, month, date] = day.split('-').map(Number);
    return new Date(year, month - 1, date).getTime();
  }, [day]);

  const unavailable = t('today.stats.unavailable');

  const weightTile = (() => {
    const action = { symbol: 'plus' as const, label: t('today.own.logWeight'), onPress: () => setSheetOpen(true) };
    const base = { symbol: 'scalemass' as const, label: t('today.stats.weight'), action };
    if (summary.isError) return { ...base, value: PLACEHOLDER_VALUE, caption: unavailable };
    const latest = summary.data?.latestWeightKg;
    if (summary.data === undefined) return { ...base, value: PLACEHOLDER_VALUE, caption: '' };
    if (latest === undefined) return { ...base, value: PLACEHOLDER_VALUE, caption: t('today.stats.weightNone') };
    const value = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(latest);
    const change = measurements.data ? weeklyWeightChange(measurements.data) : null;
    if (change === null) return { ...base, value, unit: t('today.stats.kg'), caption: '' };
    const formatted = new Intl.NumberFormat(language, {
      signDisplay: 'exceptZero',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(change);
    return {
      ...base,
      value,
      unit: t('today.stats.kg'),
      caption: t('today.stats.weightChange', { change: formatted }),
      captionColor: change < 0 ? ('nutritionInk' as const) : ('muted' as const),
    };
  })();

  const photoTile = (() => {
    const action = { symbol: 'plus' as const, label: t('today.own.addPhoto'), onPress: () => router.push('/profile/photos') };
    const base = { symbol: 'camera' as const, label: t('today.stats.photos'), action };
    if (summary.isError) return { ...base, value: PLACEHOLDER_VALUE, caption: unavailable };
    if (summary.data === undefined) return { ...base, value: PLACEHOLDER_VALUE, caption: '' };
    const count = summary.data.progressPhotoCount ?? 0;
    if (count === 0) return { ...base, value: '0', caption: t('today.stats.photosNone') };
    const days = photos.data ? daysSinceNewestPhoto(photos.data, now) : null;
    const caption = days === null ? '' : days === 0 ? t('today.stats.photosToday') : t('today.stats.photosAgo', { count: days });
    return { ...base, value: String(count), caption };
  })();

  const checkInTile = (() => {
    const action = {
      symbol: 'chevron.right' as const,
      label: t('today.stats.openCheckIns'),
      onPress: () => router.push('/profile/check-ins'),
    };
    const base = { symbol: 'checkmark.circle' as const, label: t('today.stats.checkIn'), action };
    if (checkIns.isError) return { ...base, value: PLACEHOLDER_VALUE, caption: unavailable };
    if (checkIns.isPending) return { ...base, value: PLACEHOLDER_VALUE, caption: '' };

    const open = openCheckIn(checkIns.items, now);
    if (open) {
      const weekday = dueWeekday(language, open.dueAt);
      const caption =
        open.daysLeft === null
          ? t('today.stats.checkInOpen')
          : open.daysLeft === 0
            ? t('today.stats.checkInDueToday')
            : t('today.stats.checkInDue', { count: open.daysLeft });
      return { ...base, value: weekday ?? t('today.stats.checkInOpen'), caption: weekday ? caption : '' };
    }

    // The coach's own schedule; no weekday is assumed when the coach has none.
    const days = checkInDaysLabel(language, collaborations.data?.flatMap((entry) => entry.checkIns ?? []));
    if (days) return { ...base, value: days, caption: t('today.stats.checkInWeekly') };
    return { ...base, value: PLACEHOLDER_VALUE, caption: t('today.stats.checkInNone') };
  })();

  return (
    <View style={styles.row}>
      <StatTile {...weightTile} />
      <StatTile {...photoTile} />
      <StatTile {...checkInTile} />
      <AddMeasurementSheet
        visible={sheetOpen}
        entries={measurements.data ?? []}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
  });
