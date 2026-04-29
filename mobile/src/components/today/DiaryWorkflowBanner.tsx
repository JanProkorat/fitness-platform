/**
 * DiaryWorkflowBanner — persistent Today-screen banner for an active 7-day
 * workflow diary request.
 *
 * Shown when Mode === Workflow AND Status ∈ {Accepted, InProgress}.
 * Tapping opens the workflow screen.
 */
import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Pressable, Animated, useColorScheme } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { useThemeStore } from '@/stores/themeStore'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { goldAlpha } from '@/constants/colors'
import type { ClientPhotoDiaryRequestSummary } from '@/api/diaryRequests'

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Compute the current day number: min(daysSince(acceptedAt) + 1, durationDays).
 * Returns 1 when acceptedAt is absent as a safe fallback.
 */
function computeCurrentDay(
  acceptedAt: string | undefined,
  durationDays: number,
): number {
  if (!acceptedAt) return 1
  const accepted = new Date(acceptedAt)
  const now = new Date()
  const msPerDay = 24 * 60 * 60 * 1000
  const daysSince = Math.floor((now.getTime() - accepted.getTime()) / msPerDay)
  return Math.min(daysSince + 1, durationDays)
}

// ─── Component ───────────────────────────────────────────────────────────────

interface DiaryWorkflowBannerProps {
  request: ClientPhotoDiaryRequestSummary
  professionalName?: string
  onOpen: () => void
}

export function DiaryWorkflowBanner({
  request,
  professionalName,
  onOpen,
}: DiaryWorkflowBannerProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  const systemScheme = useColorScheme()
  const preference = useThemeStore((s) => s.preference)
  const effectiveScheme = preference === 'system' ? (systemScheme ?? 'light') : preference

  const goldBg = effectiveScheme === 'dark' ? goldAlpha['10'] : goldAlpha['08']
  const goldBorder = effectiveScheme === 'dark' ? goldAlpha['25'] : goldAlpha['20']

  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-40)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 16,
        stiffness: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start()
  }, [opacity, translateY])

  const durationDays = request.durationDays ?? 7
  const currentDay = computeCurrentDay(request.acceptedAt, durationDays)
  const daysLeft = Math.max(0, durationDays - currentDay)

  const daysLeftKey =
    daysLeft === 1
      ? 'diary.workflow.daysLeft_one'
      : daysLeft < 5
        ? 'diary.workflow.daysLeft_few'
        : 'diary.workflow.daysLeft_many'

  return (
    <Animated.View style={[styles.wrapper, { opacity, transform: [{ translateY }] }]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={t('diary.workflowBanner.title')}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: goldBg,
            borderColor: goldBorder,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        {/* Top row: title + open label */}
        <View style={styles.topRow}>
          <Text style={[Type.footnote, styles.eyebrow, { color: colors.gold }]}>
            {t('diary.workflowBanner.title')}
          </Text>
          <Text style={[Type.footnote, { color: colors.gold }]}>
            {t('diary.workflowBanner.open')} ›
          </Text>
        </View>

        {/* Day counter row + dots */}
        <View style={styles.counterRow}>
          <Text style={[Type.headline, { color: colors.label }]}>
            {t('diary.workflowBanner.dayCounter', { day: currentDay, total: durationDays })}
          </Text>
          <View style={styles.dots}>
            {Array.from({ length: durationDays }).map((_, i) => {
              const isDone = i < currentDay - 1
              const isCurrent = i === currentDay - 1
              return (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    isDone
                      ? { backgroundColor: colors.gold }
                      : isCurrent
                        ? {
                            backgroundColor: 'transparent',
                            borderWidth: 1.5,
                            borderColor: colors.gold,
                          }
                        : { backgroundColor: colors.fill },
                  ]}
                />
              )
            })}
          </View>
        </View>

        {/* Sub-text */}
        <Text style={[Type.caption1, { color: colors.label2, marginTop: 4 }]}>
          {daysLeft > 0
            ? t(daysLeftKey, { count: daysLeft })
            : professionalName
              ? t('diary.workflow.coachNote', { name: professionalName })
              : t('diary.workflowBanner.title')}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

export default DiaryWorkflowBanner

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eyebrow: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})
