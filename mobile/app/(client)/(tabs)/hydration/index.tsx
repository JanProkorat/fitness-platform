/**
 * HydrationScreen — daily water-intake tracking screen (#334).
 *
 * Sections:
 *  1. Header bar with screen title.
 *  2. Progress bar (today total / target).
 *  3. Quick-log chips (preset amounts + custom sheet).
 *  4. Today's drink log (sortable list with delete).
 *  5. 7-day history strip.
 *  6. Settings: daily target input + reminder slots list + "Add slot" button.
 *
 * Orphan-reminder cleanup: on mount, any reminder key whose slot index is ≥
 * the current slot count is cancelled.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import {
  useHydrationStore,
  selectTodayDrinks,
  selectTodayTotalMl,
} from '@/stores/hydrationStore'
import { listReminderKeys, cancelReminder } from '@/lib/reminderScheduler'
import { HydrationProgressBar } from '@/components/hydration/HydrationProgressBar'
import { QuickLogChips } from '@/components/hydration/QuickLogChips'
import { CustomAmountSheet } from '@/components/hydration/CustomAmountSheet'
import { HydrationLogList } from '@/components/hydration/HydrationLogList'
import { HydrationHistoryStrip } from '@/components/hydration/HydrationHistoryStrip'
import { WaterReminderRow } from '@/components/hydration/WaterReminderRow'
import { SectionHeader } from '@/components/ui/SectionHeader'

const MAX_SLOTS = 8

export default function HydrationScreen() {
  const { t } = useTranslation()
  const colors = useTheme()

  // ── Store ──────────────────────────────────────────────────────────────────
  const log = useHydrationStore((s) => s.log)
  const targetMl = useHydrationStore((s) => s.targetMl)
  const slots = useHydrationStore((s) => s.slots)
  const addDrink = useHydrationStore((s) => s.addDrink)
  const removeDrink = useHydrationStore((s) => s.removeDrink)
  const setTarget = useHydrationStore((s) => s.setTarget)
  const addSlot = useHydrationStore((s) => s.addSlot)
  const removeSlot = useHydrationStore((s) => s.removeSlot)

  // ── Derived ─────────────────────────────────────────────────────────────
  const todayDrinks = selectTodayDrinks(log)
  const todayTotal = selectTodayTotalMl(log)

  // ── Custom-amount sheet state ──────────────────────────────────────────
  const [customSheetVisible, setCustomSheetVisible] = useState(false)

  // ── Target input (local editing state) ────────────────────────────────
  const [targetInput, setTargetInput] = useState(String(targetMl))
  // Sync local input if the store target changes externally (e.g. MMKV restore).
  const prevTargetRef = useRef(targetMl)
  useEffect(() => {
    if (prevTargetRef.current !== targetMl) {
      setTargetInput(String(targetMl))
      prevTargetRef.current = targetMl
    }
  }, [targetMl])

  const handleTargetBlur = useCallback(() => {
    const parsed = parseInt(targetInput, 10)
    if (!isNaN(parsed) && parsed > 0 && parsed <= 10_000) {
      setTarget(parsed)
      prevTargetRef.current = parsed
    } else {
      // Revert to the current store value if the entry is invalid.
      setTargetInput(String(targetMl))
    }
  }, [targetInput, setTarget, targetMl])

  // ── Quick-log handlers ────────────────────────────────────────────────
  const handleLog = useCallback(
    (amountMl: number) => {
      addDrink(amountMl)
    },
    [addDrink],
  )

  const handleCustomConfirm = useCallback(
    (amountMl: number) => {
      addDrink(amountMl)
      setCustomSheetVisible(false)
    },
    [addDrink],
  )

  // ── Orphan-reminder cleanup ───────────────────────────────────────────
  // Cancel any reminder whose slot index is ≥ the current slot count.
  // This handles cases where slots were removed while the app was backgrounded
  // and the previous session's reminders were not cleaned up.
  useEffect(() => {
    const keys = listReminderKeys('water-slot-')
    const slotCount = slots.length
    for (const key of keys) {
      // Key format: water-slot-<N>
      const parts = key.split('-')
      const idx = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(idx) && idx >= slotCount) {
        cancelReminder(key).catch(() => {
          // Best-effort; ignore failures.
        })
      }
    }
    // Run only when slot count changes (not on every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots.length])

  const styles = makeStyles(colors)

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Screen title */}
        <View style={styles.headerRow}>
          <Text style={[styles.screenTitle, { color: colors.label }]}>
            {t('hydration.screen.title')}
          </Text>
        </View>

        {/* Progress */}
        <View style={[styles.progressCard, { backgroundColor: colors.bg2 }]}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.label }]}>
              {t('hydration.card.todayProgress', {
                current: todayTotal,
                target: targetMl,
              })}
            </Text>
          </View>
          <HydrationProgressBar
            currentMl={todayTotal}
            targetMl={targetMl}
            barHeight={8}
          />
        </View>

        {/* Quick-log chips */}
        <View style={styles.chipsSection}>
          <QuickLogChips
            onLog={handleLog}
            onCustomPress={() => setCustomSheetVisible(true)}
          />
        </View>

        {/* Today's log */}
        <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
          <HydrationLogList drinks={todayDrinks} onRemove={removeDrink} />
        </View>

        {/* 7-day history strip */}
        <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
          <HydrationHistoryStrip log={log} targetMl={targetMl} />
        </View>

        {/* Settings section */}
        <View style={styles.settingsSection}>
          <SectionHeader title={t('hydration.settings.targetLabel')} />

          {/* Target input */}
          <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
            <View style={styles.targetRow}>
              <Text style={[styles.targetLabel, { color: colors.label }]}>
                {t('hydration.settings.targetLabel')}
              </Text>
              <View style={styles.targetInputWrap}>
                <TextInput
                  style={[
                    styles.targetInput,
                    {
                      color: colors.label,
                      backgroundColor: colors.fill,
                      borderColor: colors.sep,
                    },
                  ]}
                  keyboardType="number-pad"
                  value={targetInput}
                  onChangeText={setTargetInput}
                  onBlur={handleTargetBlur}
                  maxLength={5}
                  returnKeyType="done"
                  onSubmitEditing={handleTargetBlur}
                  accessibilityLabel={t('hydration.settings.targetLabel')}
                />
                <Text style={[styles.targetSuffix, { color: colors.label2 }]}>
                  {t('hydration.settings.targetSuffix')}
                </Text>
              </View>
            </View>
          </View>

          {/* Reminder slots */}
          <SectionHeader title={t('hydration.settings.remindersLabel')} />

          <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
            {slots.map((_, idx) => (
              <WaterReminderRow key={idx} index={idx} onRemove={removeSlot} />
            ))}

            {/* Add slot button — disabled when cap reached */}
            {slots.length < MAX_SLOTS && (
              <Pressable
                onPress={addSlot}
                style={({ pressed }) => [
                  styles.addSlotBtn,
                  { borderTopColor: colors.sep, opacity: pressed ? 0.7 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('hydration.settings.addSlot')}
              >
                <Text style={[styles.addSlotLabel, { color: colors.gold }]}>
                  {t('hydration.settings.addSlot')}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Bottom padding */}
        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Custom amount sheet */}
      <CustomAmountSheet
        visible={customSheetVisible}
        onConfirm={handleCustomConfirm}
        onDismiss={() => setCustomSheetVisible(false)}
      />
    </KeyboardAvoidingView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

type Colors = ReturnType<typeof useTheme>

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingTop: 8,
      gap: 12,
    },
    headerRow: {
      paddingHorizontal: 20,
      paddingVertical: 6,
    },
    screenTitle: {
      ...Type.largeTitle,
      fontWeight: '700',
    },
    progressCard: {
      marginHorizontal: 16,
      borderRadius: Radius.lg,
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 10,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    progressLabel: {
      ...Type.headline,
      fontWeight: '600',
    },
    chipsSection: {
      marginHorizontal: 0,
    },
    card: {
      marginHorizontal: 16,
      borderRadius: Radius.lg,
      overflow: 'hidden',
    },
    settingsSection: {
      gap: 12,
    },
    targetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    targetLabel: {
      ...Type.body,
    },
    targetInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    targetInput: {
      width: 80,
      height: 36,
      borderRadius: Radius.md,
      borderWidth: 1,
      paddingHorizontal: 10,
      textAlign: 'center',
      ...Type.body,
    },
    targetSuffix: {
      ...Type.body,
      fontWeight: '600',
    },
    addSlotBtn: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
    },
    addSlotLabel: {
      ...Type.subheadline,
      fontWeight: '600',
    },
    bottomPad: {
      height: 32,
    },
  })
}
