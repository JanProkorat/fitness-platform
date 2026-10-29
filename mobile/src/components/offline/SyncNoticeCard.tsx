import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { formatShortDate, localToday } from '@/components/nutrition/plan/model';
import { Text } from '@/components/Text';
import { coveredCollaborations } from '@/components/today/collaborationRoles';
import { useCollaborations } from '@/hooks/useCollaborations';
import type { DroppedEntry, EntryLabel, SyncConflict } from '@/lib/outbox/types';
import { useDroppedEntries, useOutboxStore, useSyncConflicts } from '@/stores/outbox';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** "27 Oct" in the app language, from the ISO time the user acted. */
const dayLabel = (language: string, iso: string | undefined, fallbackIso: string): string => {
  const time = Date.parse(iso ?? fallbackIso);
  return formatShortDate(language, localToday(new Date(Number.isNaN(time) ? Date.parse(fallbackIso) : time)));
};

type NoticeRowProps = {
  tone: 'info' | 'caution';
  title: string;
  body: string;
  first: boolean;
};

function NoticeRow({ tone, title, body, first }: NoticeRowProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const caution = tone === 'caution';

  return (
    <View accessible accessibilityLabel={`${title}. ${body}`} style={[styles.row, !first && styles.divider]}>
      <View style={[styles.badge, caution ? styles.badgeCaution : styles.badgeInfo]}>
        <SymbolView
          name={caution ? 'exclamationmark.triangle' : 'info.circle'}
          weight="medium"
          tintColor={caution ? theme.colors.cautionInk : theme.colors.ink2}
          size={theme.sizes.noticeGlyph}
        />
      </View>
      <View style={styles.copy}>
        <Text variant="bodyStrong">
          {title}
        </Text>
        <Text variant="label" color="muted">
          {body}
        </Text>
      </View>
    </View>
  );
}

/**
 * The Nutrition tab's account of the offline writes that did not go through as the client made them: plan
 * changes the coach made meanwhile, and entries that could not be saved. "Got it" clears both lists for good.
 */
export function SyncNoticeCard() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const language = i18n.language;
  const conflicts = useSyncConflicts();
  const dropped = useDroppedEntries();
  const clear = useOutboxStore((state) => state.clearSyncNotices);
  const collaborations = useCollaborations();

  if (conflicts.length === 0 && dropped.length === 0) return null;

  // A plan conflict is only ever reported to the plan's author, the client's nutritionist.
  const nutritionistName = coveredCollaborations(collaborations.data ?? [])
    .filter((entry) => entry.roles.includes('Nutritionist'))
    .map((entry) => (entry.collaboration.professionalName ?? '').trim().split(/\s+/)[0] ?? '')
    .find((name) => name !== '');
  const who = nutritionistName ?? t('offlineSync.who');

  const mealName = (label: EntryLabel): string => {
    if (!label.mealKind) return t('offlineSync.mealFallback');
    const name = t(`nutritionMeal.kind.${label.mealKind}`);
    // The sentence reads "changed lunch"; German nouns keep their capital.
    return language.startsWith('en') ? name.toLowerCase() : name;
  };

  const conflictRow = (conflict: SyncConflict) => ({
    key: `conflict-${conflict.id}`,
    tone: 'info' as const,
    title: t(`offlineSync.conflict.${conflict.kind}.title`, {
      who,
      meal: mealName(conflict.label),
      date: dayLabel(language, conflict.label.date, conflict.at),
    }),
    body: t(`offlineSync.conflict.${conflict.kind}.body`),
  });

  const droppedBody = (entry: DroppedEntry): string => {
    const date = dayLabel(language, entry.label?.date, entry.at);
    const name = entry.label?.name ?? (entry.label?.mealKind ? t(`nutritionMeal.kind.${entry.label.mealKind}`) : '');
    const subject =
      name === ''
        ? t(`offlineSync.dropped.subject.${entry.kind}`, { date })
        : t('offlineSync.dropped.subjectNamed', { name, date });
    return t(`offlineSync.dropped.reason.${entry.reason}`, { subject });
  };

  // One row with a counted title; each entry's reason is a line under it.
  const droppedRows =
    dropped.length === 0
      ? []
      : [
          {
            key: 'dropped',
            tone: 'caution' as const,
            title: t('offlineSync.dropped.title', { count: dropped.length }),
            body: dropped.map(droppedBody).join('\n'),
          },
        ];

  const rows = [...conflicts.map(conflictRow), ...droppedRows];

  return (
    <Card style={styles.card}>
      <Text variant="barTitle" accessibilityRole="header">
        {conflicts.length > 0 ? t('offlineSync.title') : t('offlineSync.titleDropped')}
      </Text>
      {rows.map((row, index) => (
        <NoticeRow key={row.key} tone={row.tone} title={row.title} body={row.body} first={index === 0} />
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('offlineSync.gotIt')}
        onPress={() => void clear()}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text variant="bodyStrong">{t('offlineSync.gotIt')}</Text>
      </Pressable>
    </Card>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.cardInset,
      gap: theme.spacing.md,
    },
    row: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    divider: {
      paddingTop: theme.spacing.md,
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.lineStrong,
    },
    badge: {
      width: theme.sizes.noticeIcon,
      height: theme.sizes.noticeIcon,
      flexShrink: 0,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeInfo: {
      backgroundColor: theme.colors.tabSelected,
    },
    badgeCaution: {
      backgroundColor: theme.colors.cautionSoft,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.hair,
    },
    button: {
      height: theme.sizes.buttonMedium,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.tabSelected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: theme.opacity.pressed,
    },
  });
