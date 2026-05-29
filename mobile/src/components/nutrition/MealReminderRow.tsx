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
import type { PlanMeal } from '@/api/nutrition';
import {
  scheduleDailyReminder,
  cancelReminder,
  getReminder,
} from '@/lib/reminderScheduler';
import type { ReminderTime } from '@/lib/reminderScheduler';
import { ReminderTimePicker } from './ReminderTimePicker';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_REMINDER_TIME: ReminderTime = { hour: 8, minute: 0 };

// ─── Component ───────────────────────────────────────────────────────────────

export interface MealReminderRowProps {
  meal: PlanMeal;
  /** Day label shown in the notification body (e.g. "Pondělí"). Pass empty string to omit. */
  dayLabel?: string;
}

/**
 * Displays a reminder toggle + time picker for a single plan meal.
 *
 * Mirrors SupplementReminderRow's structure exactly — same toggle-gate
 * pattern (ON state only set when scheduleDailyReminder returns { scheduled: true }),
 * same time-picker UX, same MMKV backing via reminderScheduler.
 *
 * Key format: meal-<mealId>
 */
export function MealReminderRow({
  meal,
  dayLabel = '',
}: MealReminderRowProps): React.ReactElement {
  const { t } = useTranslation();
  const colors = useTheme();

  const reminderKey = `meal-${meal.mealId ?? ''}`;

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

  // Re-sync if mealId changes (e.g. list rebuild).
  useEffect(() => {
    const stored = getReminder(reminderKey);
    setReminderEnabled(stored?.enabled ?? false);
    setReminderTime(stored?.time ?? DEFAULT_REMINDER_TIME);
  }, [reminderKey]);

  const handleToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        const dayPart = dayLabel ? ` (${dayLabel})` : '';
        const result = await scheduleDailyReminder({
          key: reminderKey,
          time: reminderTime,
          title: t('nutrition.meals.reminder.notificationTitle'),
          body: t('nutrition.meals.reminder.notificationBody', {
            mealKind: meal.kind ?? '',
            dayPart,
          }),
          data: { mealId: meal.mealId ?? '' },
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
    [reminderKey, reminderTime, meal.kind, meal.mealId, dayLabel, t],
  );

  const handleTimeConfirm = useCallback(
    async (time: ReminderTime) => {
      setPickerVisible(false);
      setReminderTime(time);
      if (reminderEnabled) {
        // Reschedule with the new time — always fire-and-forget after confirmation.
        const dayPart = dayLabel ? ` (${dayLabel})` : '';
        await scheduleDailyReminder({
          key: reminderKey,
          time,
          title: t('nutrition.meals.reminder.notificationTitle'),
          body: t('nutrition.meals.reminder.notificationBody', {
            mealKind: meal.kind ?? '',
            dayPart,
          }),
          data: { mealId: meal.mealId ?? '' },
        });
      }
    },
    [reminderEnabled, reminderKey, meal.kind, meal.mealId, dayLabel, t],
  );

  const styles = makeStyles(colors);

  return (
    <View style={[styles.container, { borderTopColor: colors.sep }]}>
      {/* Toggle row */}
      <View style={styles.topRow}>
        <Text style={[styles.label, { color: colors.label2 }]}>
          {t('nutrition.meals.reminder.toggleLabel')}
        </Text>
        <Switch
          value={reminderEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.sep, true: colors.gold }}
          thumbColor={colors.bg}
          accessibilityLabel={t('nutrition.meals.reminder.toggleLabel')}
          accessibilityRole="switch"
        />
      </View>

      {/* Time picker row — only visible when toggle is on */}
      {reminderEnabled && (
        <TouchableOpacity
          style={styles.timeRow}
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t('nutrition.meals.reminder.timeLabel')}
        >
          <Text style={[styles.timeLabel, { color: colors.label2 }]}>
            {t('nutrition.meals.reminder.timeLabel')}
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

export default MealReminderRow;

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
