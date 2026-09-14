import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { GoldButton } from '@/components/ui/GoldButton'
import { useTheme } from '@/hooks/useTheme'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { addMeasurement } from '@/api/measurements'
import { addPendingMutation } from '@/stores/offline'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Ionicons } from '@expo/vector-icons'

interface WeightInputSheetProps {
  visible: boolean
  onClose: () => void
  onSaved: () => void
  defaultWeight?: number
}

const MIN_WEIGHT = 20
const MAX_WEIGHT = 300

function formatDateCZ(date: Date): string {
  return `${date.getDate()}. ${date.getMonth() + 1}. ${date.getFullYear()}`
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b)
}

export function WeightInputSheet({
  visible,
  onClose,
  onSaved,
  defaultWeight,
}: WeightInputSheetProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isConnected = useNetworkStatus()

  const [weightText, setWeightText] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => new Date())

  // Reset state when opening
  useEffect(() => {
    if (visible) {
      setWeightText(defaultWeight != null ? defaultWeight.toFixed(1) : '')
      setSelectedDate(new Date())
    }
  }, [visible, defaultWeight])

  const parsedWeight = parseFloat(weightText.replace(',', '.'))
  const isValid =
    !isNaN(parsedWeight) && parsedWeight >= MIN_WEIGHT && parsedWeight <= MAX_WEIGHT

  const adjustWeight = useCallback(
    (delta: number) => {
      const current = isNaN(parsedWeight) ? defaultWeight ?? 70 : parsedWeight
      const next = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, current + delta))
      setWeightText(next.toFixed(1))
    },
    [parsedWeight, defaultWeight],
  )

  const shiftDate = useCallback(
    (days: number) => {
      setSelectedDate((prev) => {
        const next = new Date(prev)
        next.setDate(next.getDate() + days)
        // Don't allow future dates
        const today = new Date()
        if (next > today) return prev
        return next
      })
    },
    [],
  )

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['measurements'] })
    queryClient.invalidateQueries({ queryKey: ['measurements-recent'] })
    queryClient.invalidateQueries({ queryKey: ['measurements-recent-7'] })
    queryClient.invalidateQueries({ queryKey: ['measurement-stats'] })
    queryClient.invalidateQueries({ queryKey: ['latest-measurement'] })
  }, [queryClient])

  const mutation = useMutation({
    mutationFn: addMeasurement,
    onSuccess: () => {
      invalidateQueries()
      onSaved()
    },
  })

  const handleSave = useCallback(() => {
    if (!isValid) return

    const request = {
      weightKg: parsedWeight,
      measuredAt: selectedDate.toISOString(),
    }

    if (isConnected) {
      mutation.mutate(request)
    } else {
      addPendingMutation({
        method: 'POST',
        url: '/client/measurements',
        data: request,
      })
      invalidateQueries()
      onSaved()
    }
  }, [isValid, parsedWeight, selectedDate, isConnected, mutation, invalidateQueries, onSaved])

  const isToday = isSameDay(selectedDate, new Date())
  const isFutureBlocked = (() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const check = new Date(selectedDate)
    check.setDate(check.getDate() + 1)
    return check >= tomorrow
  })()

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('profile.recordWeight')}
      heightFraction={0.65}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        {/* Weight input with stepper */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.label2 }]}>
            {t('profile.weightKg')}
          </Text>
          <View style={styles.weightRow}>
            <Pressable
              onPress={() => adjustWeight(-0.1)}
              style={({ pressed }) => [
                styles.stepperBtn,
                { backgroundColor: colors.fill, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="remove" size={22} color={colors.label} />
            </Pressable>

            <TextInput
              style={[styles.weightInput, { color: colors.label }]}
              value={weightText}
              onChangeText={setWeightText}
              keyboardType="decimal-pad"
              placeholder="63,0"
              placeholderTextColor={colors.label3}
              selectTextOnFocus
              textAlign="center"
            />

            <Pressable
              onPress={() => adjustWeight(0.1)}
              style={({ pressed }) => [
                styles.stepperBtn,
                { backgroundColor: colors.fill, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="add" size={22} color={colors.label} />
            </Pressable>
          </View>
          <Text style={[styles.weightUnit, { color: colors.label3 }]}>kg</Text>
        </View>

        {/* Date selector */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.label2 }]}>
            {t('profile.date')}
          </Text>
          <View style={styles.dateRow}>
            <Pressable
              onPress={() => shiftDate(-1)}
              hitSlop={12}
              style={({ pressed }) => [
                styles.dateChevron,
                { backgroundColor: colors.fill, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="chevron-back" size={18} color={colors.label} />
            </Pressable>

            <View style={styles.dateCenter}>
              <Text style={[styles.dateText, { color: colors.label }]}>
                {formatDateCZ(selectedDate)}
              </Text>
              {isToday && (
                <Text style={[styles.dateSub, { color: colors.gold }]}>
                  {t('profile.today')}
                </Text>
              )}
            </View>

            <Pressable
              onPress={() => shiftDate(1)}
              hitSlop={12}
              disabled={isFutureBlocked}
              style={({ pressed }) => [
                styles.dateChevron,
                {
                  backgroundColor: colors.fill,
                  opacity: isFutureBlocked ? 0.3 : pressed ? 0.6 : 1,
                },
              ]}
            >
              <Ionicons name="chevron-forward" size={18} color={colors.label} />
            </Pressable>
          </View>
        </View>

        {/* Save button */}
        <GoldButton
          title={t('profile.save')}
          onPress={handleSave}
          disabled={!isValid}
          loading={mutation.isPending}
          style={styles.saveBtn}
        />

        {/* Cancel */}
        <Pressable onPress={onClose} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: colors.label2 }]}>
            {t('common.cancel')}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    ...Type.caption1,
    fontWeight: '500',
    marginBottom: 8,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightInput: {
    ...Type.largeTitle,
    minWidth: 120,
    textAlign: 'center',
    padding: 0,
  },
  weightUnit: {
    ...Type.caption1,
    textAlign: 'center',
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateChevron: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenter: {
    alignItems: 'center',
    flex: 1,
  },
  dateText: {
    ...Type.headline,
  },
  dateSub: {
    ...Type.caption2,
    fontWeight: '600',
    marginTop: 2,
  },
  saveBtn: {
    marginTop: 4,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelText: {
    ...Type.body,
  },
})

export default WeightInputSheet
