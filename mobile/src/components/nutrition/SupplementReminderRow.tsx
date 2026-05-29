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
import type { SupplementDto } from '@/api/nutrition';
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

export interface SupplementReminderRowProps {
  supplement: SupplementDto;
}

/**
 * Displays one supplement with its name, dose (if set), and optionally
 * expandable notes. Provides a reminder toggle and a time picker.
 *
 * The reminder state is stored locally via MMKV (not on the server — v1
 * decision, see design handoff for issue #332).
 *
 * Key format used:  supplement-<externalId>
 */
export function SupplementReminderRow({
  supplement,
}: SupplementReminderRowProps): React.ReactElement {
  const { t } = useTranslation();
  const colors = useTheme();

  const reminderKey = `supplement-${supplement.externalId}`;

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
  const [notesExpanded, setNotesExpanded] = useState(false);

  // Keep local state in sync if supplement.externalId changes (list rebuild).
  useEffect(() => {
    const stored = getReminder(reminderKey);
    setReminderEnabled(stored?.enabled ?? false);
    setReminderTime(stored?.time ?? DEFAULT_REMINDER_TIME);
  }, [reminderKey]);

  const handleToggle = useCallback(
    async (value: boolean) => {
      setReminderEnabled(value);
      if (value) {
        await scheduleDailyReminder({
          key: reminderKey,
          time: reminderTime,
          title: t('nutrition.reminders.title'),
          body: t('nutrition.reminders.body', { name: supplement.name }),
          data: { supplementExternalId: supplement.externalId },
        });
      } else {
        await cancelReminder(reminderKey);
      }
    },
    [reminderKey, reminderTime, supplement.name, supplement.externalId, t],
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
          title: t('nutrition.reminders.title'),
          body: t('nutrition.reminders.body', { name: supplement.name }),
          data: { supplementExternalId: supplement.externalId },
        });
      }
    },
    [reminderEnabled, reminderKey, supplement.name, supplement.externalId, t],
  );

  const styles = makeStyles(colors);
  const hasNotes = Boolean(supplement.notes?.trim());

  return (
    <View style={[styles.container, { borderBottomColor: colors.sep }]}>
      {/* Name + dose row */}
      <View style={styles.topRow}>
        <View style={styles.nameBlock}>
          <Text style={[styles.name, { color: colors.label }]} numberOfLines={2}>
            {supplement.name}
          </Text>
          {supplement.dose ? (
            <Text style={[styles.dose, { color: colors.label2 }]}>{supplement.dose}</Text>
          ) : null}
        </View>

        {/* Reminder toggle */}
        <Switch
          value={reminderEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.sep, true: colors.gold }}
          thumbColor={colors.bg}
          accessibilityLabel={t('nutrition.supplements.reminderToggle.label')}
          accessibilityRole="switch"
        />
      </View>

      {/* Time picker row — only visible when toggle is on */}
      {reminderEnabled && (
        <TouchableOpacity
          style={styles.timeRow}
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t('nutrition.supplements.reminderTime.label')}
        >
          <Text style={[styles.timeLabel, { color: colors.label2 }]}>
            {t('nutrition.supplements.reminderTime.label')}
          </Text>
          <Text style={[styles.timeValue, { color: colors.gold }]}>
            {`${reminderTime.hour.toString().padStart(2, '0')}:${reminderTime.minute.toString().padStart(2, '0')}`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Notes row — collapsible */}
      {hasNotes && (
        <TouchableOpacity
          style={styles.notesToggle}
          onPress={() => setNotesExpanded((v) => !v)}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text style={[styles.notesToggleText, { color: colors.label3 }]}>
            {notesExpanded ? '▾ ' : '▸ '}
            {notesExpanded
              ? (supplement.notes ?? '')
              : `${(supplement.notes ?? '').slice(0, 60)}${(supplement.notes ?? '').length > 60 ? '…' : ''}`}
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

export default SupplementReminderRow;

// ─── Styles ──────────────────────────────────────────────────────────────────

type Colors = ReturnType<typeof useTheme>;

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    nameBlock: {
      flex: 1,
      marginRight: 12,
    },
    name: {
      fontSize: 14,
      fontWeight: '600',
    },
    dose: {
      fontSize: 12,
      marginTop: 2,
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
    notesToggle: {
      marginTop: 6,
    },
    notesToggleText: {
      fontSize: 12,
      lineHeight: 18,
    },
  });
}
