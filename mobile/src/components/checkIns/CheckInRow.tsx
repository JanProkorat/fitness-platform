import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CheckInHistoryItem } from '@/api/checkIns';
import { coachFullName } from '@/api/professionals';
import { CoachAvatar } from '@/components/coach/CoachAvatar';
import { StatusPill } from '@/components/checkIns/StatusPill';
import { parseCalendarDate, splitName, weekLabel } from '@/components/checkIns/model';
import type { CheckInStatus } from '@/components/checkIns/model';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type CheckInRowProps = {
  item: CheckInHistoryItem;
  status: CheckInStatus | undefined;
};

/** One past check-in: coach avatar, the week it covered, the coach's name and the outcome. */
export function CheckInRow({ item, status }: CheckInRowProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const week = parseCalendarDate(item.weekStartDate);
  const name = splitName(item.professionalName);
  const title = week ? t('checkInHistory.weekOf', { date: weekLabel(i18n.language, week) }) : '';
  const coach = coachFullName(name);
  const outcome = status ? t(`checkInHistory.status.${status}`) : null;

  return (
    <View
      accessible
      accessibilityLabel={[title, coach, outcome].filter(Boolean).join(', ')}
      style={[styles.row, status === 'missed' && styles.missed]}
    >
      <CoachAvatar coach={name} size={theme.sizes.chatAvatar} initialsVariant="chipSmall" />
      <View style={styles.copy}>
        <Text variant="body" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" color="muted" numberOfLines={1}>
          {coach}
        </Text>
      </View>
      {status ? <StatusPill status={status} /> : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    missed: {
      opacity: theme.opacity.missed,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs / 2,
    },
  });
