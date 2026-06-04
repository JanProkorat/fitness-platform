/**
 * HydrationSetupSheet — modal sheet for configuring the hydration feature.
 *
 * Contains:
 *   - Daily goal numeric input (1–10 000 ml)
 *   - Reminder toggle + time slots list (reuses WaterReminderRow)
 *   - Cancel / Save actions
 *
 * Error paths (per design review):
 *   - Daily-goal input invalid (0, non-numeric, > 10 000 ml) → Save is blocked
 *     / reverts to prior value.
 *   - Reminder slot at MAX_SLOTS → "Add time" is hidden so user cannot add more.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { WaterReminderRow } from './WaterReminderRow'
import { useHydrationStore, MAX_SLOTS } from '@/stores/hydrationStore'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

const MAX_GOAL_ML = 10_000

interface HydrationSetupSheetProps {
  visible: boolean
  onDismiss: () => void
  /** Called after a successful save — lets the caller update persisted `enabled` flag. */
  onSaved: () => void
}

export function HydrationSetupSheet({
  visible,
  onDismiss,
  onSaved,
}: HydrationSetupSheetProps): React.ReactElement {
  const { t } = useTranslation()
  const colors = useTheme()

  const targetMl = useHydrationStore((s) => s.targetMl)
  const slots = useHydrationStore((s) => s.slots)
  const setTarget = useHydrationStore((s) => s.setTarget)
  const addSlot = useHydrationStore((s) => s.addSlot)
  const removeSlot = useHydrationStore((s) => s.removeSlot)

  // Local editing state for the goal input — synced from store when sheet opens.
  const [goalInput, setGoalInput] = useState(String(targetMl))
  const [goalError, setGoalError] = useState<string | null>(null)
  const prevTargetRef = useRef(targetMl)

  // Sync local input when the sheet is opened or when the store changes externally.
  useEffect(() => {
    if (visible) {
      setGoalInput(String(targetMl))
      setGoalError(null)
      prevTargetRef.current = targetMl
    }
  }, [visible, targetMl])

  const handleGoalChange = useCallback((text: string) => {
    setGoalInput(text)
    setGoalError(null)
  }, [])

  const handleSave = useCallback(() => {
    const parsed = parseInt(goalInput, 10)
    if (isNaN(parsed) || parsed <= 0 || parsed > MAX_GOAL_ML) {
      setGoalError(t('hydration.setup.goalError'))
      return
    }
    setTarget(parsed)
    prevTargetRef.current = parsed
    setGoalError(null)
    onSaved()
  }, [goalInput, setTarget, onSaved, t])

  const handleCancel = useCallback(() => {
    // Revert local input to the store value.
    setGoalInput(String(targetMl))
    setGoalError(null)
    onDismiss()
  }, [targetMl, onDismiss])

  const styles = makeStyles(colors)

  return (
    <BottomSheet
      visible={visible}
      onClose={handleCancel}
      title={t('hydration.setup.title')}
      fitContent={false}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Daily goal section */}
          <SectionHeader title={t('hydration.setup.goalSectionTitle')} />
          <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
            <View style={styles.goalRow}>
              <Text style={[styles.goalLabel, { color: colors.label }]}>
                {t('hydration.settings.targetLabel')}
              </Text>
              <View style={styles.goalInputWrap}>
                <TextInput
                  style={[
                    styles.goalInput,
                    {
                      color: colors.label,
                      backgroundColor: colors.fill,
                      borderColor: goalError ? colors.red : colors.sep,
                    },
                  ]}
                  keyboardType="number-pad"
                  value={goalInput}
                  onChangeText={handleGoalChange}
                  maxLength={5}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                  accessibilityLabel={t('hydration.settings.targetLabel')}
                />
                <Text style={[styles.goalSuffix, { color: colors.label2 }]}>
                  {t('hydration.settings.targetSuffix')}
                </Text>
              </View>
            </View>
            {goalError !== null && (
              <Text style={[styles.goalErrorText, { color: colors.red }]}>{goalError}</Text>
            )}
          </View>
          <Text style={[styles.goalHint, { color: colors.label3 }]}>
            {t('hydration.setup.goalHint')}
          </Text>

          {/* Reminders section */}
          <View style={styles.remindersSectionHeader}>
            <SectionHeader title={t('hydration.settings.remindersLabel')} />
          </View>
          <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
            {slots.map((slot, idx) => (
              <WaterReminderRow
                key={slot.id}
                slot={slot}
                displayIndex={idx + 1}
                onRemove={removeSlot}
              />
            ))}

            {/* Add slot — hidden when at MAX_SLOTS cap (AC: no affordance that silently fails) */}
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

          {/* Action buttons */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelBtn,
                { borderColor: colors.sep, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={handleCancel}
              accessibilityRole="button"
            >
              <Text style={[styles.cancelLabel, { color: colors.label2 }]}>
                {t('hydration.setup.cancel')}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: colors.gold, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleSave}
              accessibilityRole="button"
            >
              <Text style={[styles.saveLabel, { color: colors.onAccent }]}>
                {t('hydration.setup.save')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>
      </KeyboardAvoidingView>
    </BottomSheet>
  )
}

export default HydrationSetupSheet

type Colors = ReturnType<typeof useTheme>

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: 4,
      gap: 0,
    },
    card: {
      marginHorizontal: 16,
      borderRadius: Radius.lg,
      overflow: 'hidden',
    },
    goalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    goalLabel: {
      ...Type.body,
    },
    goalInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    goalInput: {
      width: 84,
      height: 38,
      borderRadius: Radius.md,
      borderWidth: 1,
      paddingHorizontal: 10,
      textAlign: 'center',
      ...Type.body,
      fontWeight: '600',
    },
    goalSuffix: {
      ...Type.body,
      fontWeight: '600',
    },
    goalErrorText: {
      ...Type.footnote,
      paddingHorizontal: 16,
      paddingBottom: 10,
      marginTop: -6,
    },
    goalHint: {
      ...Type.footnote,
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 2,
    },
    remindersSectionHeader: {
      marginTop: 12,
    },
    addSlotBtn: {
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderTopWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
    },
    addSlotLabel: {
      ...Type.subheadline,
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginHorizontal: 16,
      marginTop: 20,
    },
    cancelBtn: {
      flex: 1,
      height: 46,
      borderRadius: Radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelLabel: {
      ...Type.subheadline,
      fontWeight: '600',
    },
    saveBtn: {
      flex: 2,
      height: 46,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveLabel: {
      ...Type.subheadline,
      fontWeight: '600',
    },
    bottomPad: {
      height: 24,
    },
  })
}
