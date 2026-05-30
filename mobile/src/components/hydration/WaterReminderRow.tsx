/**
 * WaterReminderRow — single reminder slot row for the hydration settings.
 *
 * Mirrors MealReminderRow's structure exactly:
 *  - Toggle gated on scheduleDailyReminder({ ... }).scheduled === true.
 *  - Permission-denied: toast + leave toggle off.
 *  - Web-unsupported: disables toggle + shows "Reminders are mobile-only" note.
 *
 * Key format:  water-slot-<index>
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
import { Toast } from '@/lib/toast'

// ─── Component ───────────────────────────────────────────────────────────────

export interface WaterReminderRowProps {
  /** Slot index within the hydration settings (0-based). */
  index: number
  onRemove: (index: number) => void
}

/**
 * Manages one water reminder slot. On toggle ON, calls scheduleDailyReminder
 * with key `water-slot-<index>` and only sets enabled=true if result.scheduled.
 * On toggle OFF, cancels the reminder and marks the slot disabled in the store.
 */
export function WaterReminderRow({ index, onRemove }: WaterReminderRowProps): React.ReactElement {
  const { t } = useTranslation()
  const colors = useTheme()

  const slot = useHydrationStore((s) => s.slots[index])
  const slotEnabled = useHydrationStore((s) => s.slotsEnabled[index])
  const setSlotTime = useHydrationStore((s) => s.setSlotTime)
  const setSlotEnabled = useHydrationStore((s) => s.setSlotEnabled)

  const reminderKey = `water-slot-${index}`

  // Local state initialised from MMKV via reminderScheduler.
  const [localEnabled, setLocalEnabled] = useState<boolean>(() => {
    const stored = getReminder(reminderKey)
    return stored?.enabled ?? slotEnabled ?? false
  })

  const [localTime, setLocalTime] = useState<ReminderTime>(() => {
    const stored = getReminder(reminderKey)
    return stored?.time ?? slot ?? { hour: 8, minute: 0 }
  })

  const [pickerVisible, setPickerVisible] = useState(false)

  // Keep in sync if index changes (list rebuild).
  useEffect(() => {
    const stored = getReminder(reminderKey)
    setLocalEnabled(stored?.enabled ?? slotEnabled ?? false)
    setLocalTime(stored?.time ?? slot ?? { hour: 8, minute: 0 })
  }, [reminderKey, slot, slotEnabled])

  const isWebPlatform = Platform.OS === 'web'

  const handleToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        const result = await scheduleDailyReminder({
          key: reminderKey,
          time: localTime,
          title: t('hydration.reminders.notificationTitle'),
          body: t('hydration.reminders.notificationBody'),
          data: { slotIndex: index },
        })
        if (!result.scheduled) {
          // Permission denied — leave toggle off, show non-blocking toast.
          setLocalEnabled(false)
          setSlotEnabled(index, false)
          if (result.reason === 'permission-denied') {
            Toast.show(t('hydration.reminders.permissionDeniedToast'))
          }
          return
        }
        setLocalEnabled(true)
        setSlotEnabled(index, true)
      } else {
        await cancelReminder(reminderKey)
        setLocalEnabled(false)
        setSlotEnabled(index, false)
      }
    },
    [reminderKey, localTime, index, setSlotEnabled, t],
  )

  const handleTimeConfirm = useCallback(
    async (time: ReminderTime) => {
      setPickerVisible(false)
      setLocalTime(time)
      setSlotTime(index, time)
      if (localEnabled) {
        // Reschedule with the new time.
        await scheduleDailyReminder({
          key: reminderKey,
          time,
          title: t('hydration.reminders.notificationTitle'),
          body: t('hydration.reminders.notificationBody'),
          data: { slotIndex: index },
        })
      }
    },
    [localEnabled, reminderKey, index, setSlotTime, t],
  )

  const handleRemove = useCallback(() => {
    onRemove(index)
  }, [onRemove, index])

  const styles = makeStyles(colors)

  const pad2 = (n: number): string => n.toString().padStart(2, '0')
  const timeLabel = `${pad2(localTime.hour)}:${pad2(localTime.minute)}`

  return (
    <View style={[styles.container, { borderTopColor: colors.sep }]}>
      {/* Toggle row */}
      <View style={styles.topRow}>
        <Text style={[styles.label, { color: colors.label2 }]}>
          {t('hydration.settings.reminderSlot', { n: index + 1 })}
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
              accessibilityLabel={t('hydration.settings.reminderSlot', { n: index + 1 })}
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
