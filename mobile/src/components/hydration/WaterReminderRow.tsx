/**
 * WaterReminderRow — single reminder slot row for the hydration settings.
 *
 * Mirrors MealReminderRow's structure exactly:
 *  - Toggle gated on scheduleDailyReminder({ ... }).scheduled === true.
 *  - Permission-denied: toast + leave toggle off.
 *  - Web-unsupported: disables toggle + shows "Reminders are mobile-only" note.
 *
 * Key format:  water-slot-<slot.id>  (UUID-stable, never shifts on remove)
 */

import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import {
  scheduleDailyReminder,
  cancelReminder,
  getReminder,
} from '@/lib/reminderScheduler'
import type { ReminderTime } from '@/lib/reminderScheduler'
import { ReminderTimePicker } from '@/components/nutrition/ReminderTimePicker'
import { useHydrationStore } from '@/stores/hydrationStore'
import type { ReminderSlot } from '@/stores/hydrationStore'
import { Toast } from '@/lib/toast'

// ─── Component ───────────────────────────────────────────────────────────────

export interface WaterReminderRowProps {
  /** The full slot record — identity is the stable UUID slot.id. */
  slot: ReminderSlot
  /** Display number shown to the user (1-based position in the list). */
  displayIndex: number
  onRemove: (slotId: string) => void
}

/**
 * Manages one water reminder slot. On toggle ON, calls scheduleDailyReminder
 * with key `water-slot-<slot.id>` and only sets enabled=true if result.scheduled.
 * On toggle OFF, cancels the reminder and marks the slot disabled in the store.
 */
export function WaterReminderRow({ slot, displayIndex, onRemove }: WaterReminderRowProps): React.ReactElement {
  const { t } = useTranslation()
  const colors = useTheme()

  const setSlotTime = useHydrationStore((s) => s.setSlotTime)
  const setSlotEnabled = useHydrationStore((s) => s.setSlotEnabled)

  // Reminder key is UUID-stable — never shifts when slots above are removed.
  const reminderKey = `water-slot-${slot.id}`

  // Local state initialised from MMKV via reminderScheduler.
  const [localEnabled, setLocalEnabled] = useState<boolean>(() => {
    const stored = getReminder(reminderKey)
    return stored?.enabled ?? slot.enabled ?? false
  })

  const [localTime, setLocalTime] = useState<ReminderTime>(() => {
    const stored = getReminder(reminderKey)
    return stored?.time ?? { hour: slot.hour, minute: slot.minute }
  })

  const [pickerVisible, setPickerVisible] = useState(false)

  // Re-sync local state if the slot record reference changes (e.g. store reload).
  useEffect(() => {
    const stored = getReminder(reminderKey)
    setLocalEnabled(stored?.enabled ?? slot.enabled ?? false)
    setLocalTime(stored?.time ?? { hour: slot.hour, minute: slot.minute })
  }, [reminderKey, slot.id, slot.hour, slot.minute, slot.enabled])

  const isWebPlatform = Platform.OS === 'web'

  const handleToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        const result = await scheduleDailyReminder({
          key: reminderKey,
          time: localTime,
          title: t('hydration.reminders.notificationTitle'),
          body: t('hydration.reminders.notificationBody'),
          data: { slotId: slot.id },
        })
        if (!result.scheduled) {
          // Permission denied — leave toggle off, show non-blocking toast.
          setLocalEnabled(false)
          setSlotEnabled(slot.id, false)
          if (result.reason === 'permission-denied') {
            Toast.show(t('hydration.reminders.permissionDeniedToast'))
          }
          return
        }
        setLocalEnabled(true)
        setSlotEnabled(slot.id, true)
      } else {
        await cancelReminder(reminderKey)
        setLocalEnabled(false)
        setSlotEnabled(slot.id, false)
      }
    },
    [reminderKey, localTime, slot.id, setSlotEnabled, t],
  )

  const handleTimeConfirm = useCallback(
    async (time: ReminderTime) => {
      setPickerVisible(false)
      setLocalTime(time)
      setSlotTime(slot.id, time)
      if (localEnabled) {
        // Reschedule with the new time.
        await scheduleDailyReminder({
          key: reminderKey,
          time,
          title: t('hydration.reminders.notificationTitle'),
          body: t('hydration.reminders.notificationBody'),
          data: { slotId: slot.id },
        })
      }
    },
    [localEnabled, reminderKey, slot.id, setSlotTime, t],
  )

  const handleRemove = useCallback(() => {
    onRemove(slot.id)
  }, [onRemove, slot.id])

  const styles = makeStyles(colors)

  const pad2 = (n: number): string => n.toString().padStart(2, '0')
  const timeLabel = `${pad2(localTime.hour)}:${pad2(localTime.minute)}`

  return (
    <View style={[styles.container, { borderTopColor: colors.sep }]}>
      {/* Toggle row */}
      <View style={styles.topRow}>
        <Text style={[styles.label, { color: colors.label2 }]}>
          {t('hydration.settings.reminderSlot', { n: displayIndex })}
        </Text>
        <View style={styles.rightSide}>
          {isWebPlatform ? (
            <Text style={[styles.webNote, { color: colors.label3 }]}>
              {t('hydration.reminders.webUnsupported')}
            </Text>
          ) : (
            <Switch
              value={localEnabled}
              onValueChange={handleToggle}
              trackColor={{ false: colors.sep, true: colors.gold }}
              thumbColor={colors.bg}
              accessibilityLabel={t('hydration.settings.reminderSlot', { n: displayIndex })}
              accessibilityRole="switch"
            />
          )}
          <TouchableOpacity
            onPress={handleRemove}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('hydration.settings.removeSlot')}
          >
            <Text style={[styles.removeBtn, { color: colors.red }]}>
              {t('hydration.settings.removeSlot')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Time picker row — only visible when toggle is on and not web */}
      {localEnabled && !isWebPlatform && (
        <TouchableOpacity
          style={styles.timeRow}
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t('hydration.settings.reminderTimeLabel')}
        >
          <Text style={[styles.timeLabel, { color: colors.label2 }]}>
            {t('hydration.settings.reminderTimeLabel')}
          </Text>
          <Text style={[styles.timeValue, { color: colors.gold }]}>
            {timeLabel}
          </Text>
        </TouchableOpacity>
      )}

      {/* Time picker modal */}
      <ReminderTimePicker
        visible={pickerVisible}
        initialTime={localTime}
        onConfirm={handleTimeConfirm}
        onDismiss={() => setPickerVisible(false)}
      />
    </View>
  )
}

export default WaterReminderRow

// ─── Styles ──────────────────────────────────────────────────────────────────

type Colors = ReturnType<typeof useTheme>

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
    rightSide: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    webNote: {
      fontSize: 12,
      fontStyle: 'italic',
    },
    removeBtn: {
      fontSize: 12,
      fontWeight: '600',
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
  })
}
