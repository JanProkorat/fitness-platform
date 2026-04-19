import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { goldAlpha } from '@/constants/colors'
import { Radius } from '@/constants/radius'
import { Avatar } from '@/components/ui/Avatar'
import { Toast } from '@/lib/toast'
import {
  getCurrentCheckIns,
  respondToCheckIn,
  dismissCheckIn,
  CHECK_IN_FLAGS,
} from '@/api/weeklyCheckIns'
import type { CheckInFlag, CheckInDetail } from '@/api/weeklyCheckIns'

// ─── Flag metadata ─────────────────────────────────────────────────────────────

const FLAG_EMOJI: Record<CheckInFlag, string> = {
  Traveling: '✈️',
  EventOrCelebration: '🎉',
  SickOrLowEnergy: '🤒',
  InjuryOrPain: '🩹',
  MoreTimeAvailable: '⏱️',
  LessTimeAvailable: '⏳',
}

const FLAG_I18N_KEY: Record<CheckInFlag, string> = {
  Traveling: 'weeklyCheckIn.flag.traveling',
  EventOrCelebration: 'weeklyCheckIn.flag.eventOrCelebration',
  SickOrLowEnergy: 'weeklyCheckIn.flag.sickOrLowEnergy',
  InjuryOrPain: 'weeklyCheckIn.flag.injuryOrPain',
  MoreTimeAvailable: 'weeklyCheckIn.flag.moreTimeAvailable',
  LessTimeAvailable: 'weeklyCheckIn.flag.lessTimeAvailable',
}

const NOTE_MAX_LENGTH = 500

// ─── Helper: format week range ────────────────────────────────────────────────

/**
 * Given an ISO date string "YYYY-MM-DD" for the week's Monday,
 * returns a localized range string "Mon Apr 20 – Sun Apr 26".
 */
function formatWeekRange(weekStartDate: string, locale: string): string {
  const monday = new Date(`${weekStartDate}T00:00:00`)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const monStr = monday.toLocaleDateString(locale, opts)
  const sunStr = sunday.toLocaleDateString(locale, { ...opts, year: 'numeric' })
  return `${monStr} – ${sunStr}`
}

// ─── Chip component ────────────────────────────────────────────────────────────

interface ChipProps {
  flag: CheckInFlag
  selected: boolean
  disabled: boolean
  onToggle: (flag: CheckInFlag) => void
}

function FlagChip({ flag, selected, disabled, onToggle }: ChipProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const bgColor = selected ? goldAlpha['20'] : colors.fill2
  const borderColor = selected ? colors.gold : colors.sep
  const textColor = selected ? colors.gold : colors.label2

  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: bgColor,
          borderColor,
          opacity: pressed && !disabled ? 0.75 : 1,
        },
      ]}
      onPress={() => !disabled && onToggle(flag)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${FLAG_EMOJI[flag]} ${t(FLAG_I18N_KEY[flag])}`}
    >
      <Text style={styles.chipEmoji}>{FLAG_EMOJI[flag]}</Text>
      <Text style={[styles.chipLabel, { color: textColor }]} numberOfLines={2}>
        {t(FLAG_I18N_KEY[flag])}
      </Text>
    </Pressable>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WeeklyCheckInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colors = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation()

  // Fetch the full list to find this specific check-in (including responded ones).
  // The current endpoint returns only active (pending) check-ins.
  // For responded check-ins, the data comes via route params from the banner/notification.
  // We use a TanStack query so SignalR invalidations auto-refresh.
  const { data, isLoading } = useQuery({
    queryKey: ['current-weekly-check-ins'],
    queryFn: getCurrentCheckIns,
    // Stale time: 30s — SignalR drives the real invalidation
    staleTime: 30_000,
  })

  // Find this check-in in the result. If not found (already responded / dismissed),
  // we rely on the detail passed via navigation params (see note below).
  const activeCheckIn = data?.checkIns.find((c) => c.id === id)

  // When the check-in was previously responded to, it won't appear in the
  // /current list (which only returns pending). The parent (Today screen)
  // passes the full detail via expo-router params for the read-only case.
  // We read those extra params here.
  const params = useLocalSearchParams<{
    id: string
    professionalName?: string
    profession?: string
    weekStartDate?: string
    flags?: string
    note?: string
    respondedAt?: string
    reviewedByTrainerAt?: string
  }>()

  // Build the effective check-in object, preferring live query data.
  const effectiveCheckIn: CheckInDetail | null = activeCheckIn
    ? {
        ...activeCheckIn,
        flags: [],
        note: null,
        respondedAt: null,
        dismissedByClientAt: null,
        reviewedByTrainerAt: null,
      }
    : params.professionalName
      ? {
          id: params.id ?? id,
          professionalUserId: '',
          professionalName: params.professionalName,
          profession: (params.profession as CheckInDetail['profession']) ?? 'Training',
          weekStartDate: params.weekStartDate ?? '',
          sentAt: '',
          flags: params.flags ? (JSON.parse(params.flags) as CheckInFlag[]) : [],
          note: params.note ?? null,
          respondedAt: params.respondedAt ?? null,
          dismissedByClientAt: null,
          reviewedByTrainerAt: params.reviewedByTrainerAt ?? null,
        }
      : null

  // ── Edit mode state ──
  const alreadyReviewed = Boolean(effectiveCheckIn?.reviewedByTrainerAt)
  const isResponded = Boolean(effectiveCheckIn?.respondedAt)

  // Start in read-only mode when already responded; editing allowed until reviewed.
  const [editing, setEditing] = useState(!isResponded)
  const [selectedFlags, setSelectedFlags] = useState<CheckInFlag[]>(
    effectiveCheckIn?.flags ?? [],
  )
  const [note, setNote] = useState(effectiveCheckIn?.note ?? '')

  const isReadOnly = isResponded && !editing

  // ── Mutations ──
  const respondMutation = useMutation({
    mutationFn: (body: { flags: CheckInFlag[]; note?: string }) =>
      respondToCheckIn(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-weekly-check-ins'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      router.back()
    },
    onError: (err: unknown) => {
      // Check for 409 CHECK_IN_ALREADY_REVIEWED
      const status = (err as { response?: { status?: number; data?: { errorCode?: string } } })
        ?.response?.status
      if (status === 409) {
        Toast.show(t('weeklyCheckIn.sheet.editLocked'))
        queryClient.invalidateQueries({ queryKey: ['current-weekly-check-ins'] })
        return
      }
      Toast.show(t('common.error'))
    },
  })

  const dismissMutation = useMutation({
    mutationFn: () => dismissCheckIn(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-weekly-check-ins'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      router.back()
    },
    onError: () => {
      Toast.show(t('common.error'))
    },
  })

  // ── Handlers ──
  const handleToggleFlag = useCallback((flag: CheckInFlag) => {
    setSelectedFlags((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag],
    )
  }, [])

  const handleSubmit = useCallback(() => {
    respondMutation.mutate({
      flags: selectedFlags,
      note: note.trim() || undefined,
    })
  }, [respondMutation, selectedFlags, note])

  const handleSkip = useCallback(() => {
    dismissMutation.mutate()
  }, [dismissMutation])

  const handleClose = useCallback(() => {
    router.back()
  }, [router])

  // ── Loading / not found ──
  if (isLoading && !effectiveCheckIn) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </SafeAreaView>
    )
  }

  if (!effectiveCheckIn) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={[Type.body, { color: colors.label2 }]}>{t('common.error')}</Text>
          <Pressable onPress={handleClose} style={styles.closeBtn}>
            <Text style={[Type.body, { color: colors.blue }]}>{t('common.back')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const professionLabel =
    effectiveCheckIn.profession === 'Training'
      ? '🏋️ Training'
      : '🥗 Nutrition'

  const promptKey =
    effectiveCheckIn.profession === 'Training'
      ? 'weeklyCheckIn.defaultPrompt.training'
      : 'weeklyCheckIn.defaultPrompt.nutrition'

  const notePlaceholderKey =
    effectiveCheckIn.profession === 'Training'
      ? 'weeklyCheckIn.sheet.notePlaceholder.training'
      : 'weeklyCheckIn.sheet.notePlaceholder.nutrition'

  const weekRange = effectiveCheckIn.weekStartDate
    ? formatWeekRange(effectiveCheckIn.weekStartDate, i18n.language)
    : ''

  const isMutating = respondMutation.isPending || dismissMutation.isPending

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        {/* ── Drag indicator + close ── */}
        <View style={styles.dragRow}>
          <View style={[styles.dragHandle, { backgroundColor: colors.sep }]} />
          <Pressable
            onPress={handleClose}
            style={styles.closeTouchable}
            accessibilityRole="button"
            accessibilityLabel={t('weeklyCheckIn.sheet.close')}
          >
            <Ionicons name="close" size={22} color={colors.label2} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header: avatar + name + profession pill ── */}
          <View style={styles.header}>
            <Avatar name={effectiveCheckIn.professionalName} size="md" />
            <View style={styles.headerText}>
              <Text style={[Type.title3, { color: colors.label }]}>
                {effectiveCheckIn.professionalName}
              </Text>
              <View style={[styles.profPill, { backgroundColor: goldAlpha['12'] }]}>
                <Text style={[styles.profPillText, { color: colors.gold }]}>
                  {professionLabel}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Prompt ── */}
          <Text style={[Type.subheadline, { color: colors.label2, marginTop: 16 }]}>
            {t(promptKey)}
          </Text>

          {/* ── Week anchor ── */}
          {weekRange !== '' && (
            <View style={[styles.weekAnchor, { backgroundColor: colors.fill2, borderColor: colors.sep2 }]}>
              <Ionicons name="calendar-outline" size={14} color={colors.label3} />
              <Text style={[Type.footnote, { color: colors.label2 }]}>
                {t('weeklyCheckIn.sheet.weekOf', { range: weekRange })}
              </Text>
            </View>
          )}

          {/* ── Chips grid (2 columns) ── */}
          <View style={styles.chipsGrid}>
            {CHECK_IN_FLAGS.map((flag) => (
              <FlagChip
                key={flag}
                flag={flag}
                selected={selectedFlags.includes(flag)}
                disabled={isReadOnly}
                onToggle={handleToggleFlag}
              />
            ))}
          </View>

          {/* ── Note textarea ── */}
          <View style={[styles.noteWrapper, { borderColor: colors.sep, backgroundColor: colors.bg2 }]}>
            <TextInput
              style={[styles.noteInput, { color: colors.label }]}
              placeholder={t(notePlaceholderKey)}
              placeholderTextColor={colors.label3}
              multiline
              maxLength={NOTE_MAX_LENGTH}
              value={note}
              onChangeText={setNote}
              editable={!isReadOnly}
              textAlignVertical="top"
              accessibilityLabel={t(notePlaceholderKey)}
            />
            <Text style={[styles.charCounter, { color: colors.label3 }]}>
              {note.length}/{NOTE_MAX_LENGTH}
            </Text>
          </View>

          {/* ── Reviewed lock notice ── */}
          {isResponded && alreadyReviewed && (
            <View style={[styles.lockedBanner, { backgroundColor: colors.fill2 }]}>
              <Ionicons name="lock-closed-outline" size={14} color={colors.label3} />
              <Text style={[Type.caption1, { color: colors.label2, flex: 1 }]}>
                {t('weeklyCheckIn.sheet.editLocked')}
              </Text>
            </View>
          )}

          {/* ── Edit button (read-only, not yet reviewed) ── */}
          {isResponded && !alreadyReviewed && !editing && (
            <Pressable
              style={[styles.editBtn, { borderColor: colors.sep, backgroundColor: colors.fill2 }]}
              onPress={() => setEditing(true)}
              accessibilityRole="button"
            >
              <Ionicons name="pencil-outline" size={16} color={colors.label2} />
              <Text style={[Type.subheadline, { color: colors.label2 }]}>{t('weeklyCheckIn.sheet.edit')}</Text>
            </Pressable>
          )}

          {/* Spacer so pinned actions don't occlude content on short screens */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* ── Pinned action bar ── */}
        {(!isResponded || editing) && (
          <View style={[styles.actions, { borderTopColor: colors.sep2, backgroundColor: colors.bg }]}>
            {/* Submit */}
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionBtnPrimary,
                { backgroundColor: colors.gold, opacity: pressed || isMutating ? 0.75 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={isMutating}
              accessibilityRole="button"
            >
              {respondMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.onAccent} />
              ) : (
                <Text style={[styles.actionBtnText, { color: colors.onAccent }]}>
                  {t('weeklyCheckIn.sheet.submit')}
                </Text>
              )}
            </Pressable>

            {/* Skip (only in initial, non-edit mode) */}
            {!isResponded && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnSecondary,
                  { borderColor: colors.sep, opacity: pressed || isMutating ? 0.65 : 1 },
                ]}
                onPress={handleSkip}
                disabled={isMutating}
                accessibilityRole="button"
              >
                {dismissMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.label2} />
                ) : (
                  <Text style={[styles.actionBtnText, { color: colors.label2 }]}>
                    {t('weeklyCheckIn.sheet.skip')}
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  closeBtn: {
    padding: 8,
  },
  dragRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 4,
    position: 'relative',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  closeTouchable: {
    position: 'absolute',
    right: 16,
    top: 8,
    padding: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 16,
  },
  headerText: {
    flex: 1,
    gap: 6,
  },
  profPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  profPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  weekAnchor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 20,
  },
  chip: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  chipEmoji: {
    fontSize: 18,
  },
  chipLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  noteWrapper: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 12,
    minHeight: 100,
  },
  noteInput: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 72,
  },
  charCounter: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 6,
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Radius.md,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 11,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  bottomSpacer: {
    height: 16,
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
    borderTopWidth: 1,
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimary: {
    // background set inline
  },
  actionBtnSecondary: {
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
})
