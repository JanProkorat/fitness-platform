import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CheckInHistoryItem } from '@/api/checkIns';
import { dueWeekday, parseCalendarDate, splitName, weekLabel } from '@/components/checkIns/model';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** A check-in still waiting for the client: the week, the coach and the day it is due. */
export function OpenNowCard({ item }: { item: CheckInHistoryItem }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const week = parseCalendarDate(item.weekStartDate);
  const title = week ? t('checkInHistory.weekOf', { date: weekLabel(i18n.language, week) }) : '';
  const coach = splitName(item.professionalName).firstName;
  const weekday = dueWeekday(i18n.language, item.dueAt);
  const caption = weekday ? t('checkInHistory.answerBy', { coach, weekday }) : coach;

  return (
    <View accessible accessibilityLabel={[t('checkInHistory.openNow'), title, caption].join(', ')} style={styles.card}>
      <Text variant="overline" color="accent" style={styles.overline}>
        {t('checkInHistory.openNow').toUpperCase()}
      </Text>
      <Text variant="subtitle">{title}</Text>
      <Text variant="label" color="muted">
        {caption}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: theme.spacing.hair,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.xxl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    overline: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
  });
