import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import type { SessionDto } from '@/api/training';
import {
  scheduleDailyReminder,
  cancelReminder,
  getReminder,
} from '@/lib/reminderScheduler';
import type { ReminderTime } from '@/lib/reminderScheduler';
import { ReminderTimePicker } from '@/components/nutrition/ReminderTimePicker';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_REMINDER_TIME: ReminderTime = { hour: 8, minute: 0 };

// ─── Component ───────────────────────────────────────────────────────────────

export interface SessionReminderRowProps {
  session: SessionDto;
}

/**
 * Displays a reminder toggle + time picker for a single training session.
 *
 * Mirrors MealReminderRow (and SupplementReminderRow) — same toggle-gate
 * pattern (ON state only set when scheduleDailyReminder returns { scheduled: true }),
 * same time-picker UX, same MMKV backing via reminderScheduler.
 *
 * Key format: session-<sessionId>
 */
export function SessionReminderRow({
  session,
}: SessionReminderRowProps): React.ReactElement {
  const { t } = useTranslation();
  const colors = useTheme();

  const reminderKey = `session-${session.sessionId ?? ''}`;

  // Initialise state from MMKV on mount.
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(() => {
    const stored = getReminder(reminderKey);
    return stored?.enabled ?? false;
  });
  const [reminderTime, setReminderTime] = useState<ReminderTime>(() => {
    const stored = getReminder(reminderKey);
    return stored?.time ?? DEFAULT_REMINDER_TIME;
  });
  const [pickerVisible, setPickerVisible] = useState(false);

  // Re-sync if sessionId changes (e.g. list rebuild).
  useEffect(() => {
    const stored = getReminder(reminderKey);
    setReminderEnabled(stored?.enabled ?? false);
    setReminderTime(stored?.time ?? DEFAULT_REMINDER_TIME);
  }, [reminderKey]);

  const handleToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        const result = await scheduleDailyReminder({
          key: reminderKey,
          time: reminderTime,
          title: t('training.sessions.reminder.notificationTitle'),
          body: t('training.sessions.reminder.notificationBody', {
            sessionName: session.name ?? '',
          }),
          data: { sessionId: session.sessionId ?? '' },
        });
        if (!result.scheduled) {
          // Permission denied or web-unsupported — leave toggle off.
          setReminderEnabled(false);
          return;
        }
        setReminderEnabled(true);
      } else {
        await cancelReminder(reminderKey);
        setReminderEnabled(false);
      }
    },
    [reminderKey, reminderTime, session.name, session.sessionId, t],
  );

  const handleTimeConfirm = useCallback(
    async (time: ReminderTime) => {
      setPickerVisible(false);
      setReminderTime(time);
      if (reminderEnabled) {
        // Reschedule with the new time.
        await scheduleDailyReminder({
          key: reminderKey,
          time,
          title: t('training.sessions.reminder.notificationTitle'),
          body: t('training.sessions.reminder.notificationBody', {
            sessionName: session.name ?? '',
          }),
          data: { sessionId: session.sessionId ?? '' },
        });
      }
    },
    [reminderEnabled, reminderKey, session.name, session.sessionId, t],
  );

  const styles = makeStyles(colors);

  return (
    <View style={[styles.container, { borderTopColor: colors.sep }]}>
      {/* Toggle row */}
      <View style={styles.topRow}>
        <Text style={[styles.label, { color: colors.label2 }]}>
          {t('training.sessions.reminder.toggleLabel')}
        </Text>
        <Switch
          value={reminderEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.sep, true: colors.gold }}
          thumbColor={colors.bg}
          accessibilityLabel={t('training.sessions.reminder.toggleLabel')}
          accessibilityRole="switch"
        />
      </View>

      {/* Time picker row — only visible when toggle is on */}
      {reminderEnabled && (
        <TouchableOpacity
          style={styles.timeRow}
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t('training.sessions.reminder.timeLabel')}
        >
          <Text style={[styles.timeLabel, { color: colors.label2 }]}>
            {t('training.sessions.reminder.timeLabel')}
          </Text>
          <Text style={[styles.timeValue, { color: colors.gold }]}>
            {`${reminderTime.hour.toString().padStart(2, '0')}:${reminderTime.minute.toString().padStart(2, '0')}`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Time picker modal */}
      <ReminderTimePicker
        visible={pickerVisible}
        initialTime={reminderTime}
        onConfirm={handleTimeConfirm}
        onDismiss={() => setPickerVisible(false)}
      />
    </View>
  );
}

export default SessionReminderRow;

// ─── Styles ──────────────────────────────────────────────────────────────────

type Colors = ReturnType<typeof useTheme>;

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    label: {
      fontSize: 13,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    timeLabel: {
      fontSize: 13,
    },
    timeValue: {
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
