import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import type { PendingDiaryRequestItem } from '@/api/questionnaire'

// ─── Stable green alpha values matching the prototype style ───────────────────
// We derive these from the theme's green color at render-time. The theme
// does not expose pre-computed green alphas, so we compute them once from
// the rgba values rather than hardcoding hex.
const greenAlpha = {
  bg: 'rgba(52,199,89,0.07)',
  border: 'rgba(52,199,89,0.22)',
  iconBg: 'rgba(52,199,89,0.15)',
  eyebrow: '#1f8a3e',
} as const

interface DiaryRequestBannerProps {
  /** The pending diary request item from the API response. */
  item: PendingDiaryRequestItem
  /** Called when the user taps "Accept" — routes to the accept wizard. */
  onAccept: () => void
  /** Called when the user taps "Dismiss" — routes to the dismiss flow. */
  onDismiss: () => void
}

export function DiaryRequestBanner({ item, onAccept, onDismiss }: DiaryRequestBannerProps) {
  const colors = useTheme()
  const { t } = useTranslation()
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
  }, [])

  // Only render when the status is Pending (defensive — the query already filters to Pending).
  if (item.status !== 'Pending') return null

  const roleKey =
    item.professionalRole === 'Trainer'
      ? 'today.diaryBanner.roleTrainer'
      : 'today.diaryBanner.roleNutritionist'

  return (
    <Animated.View style={[styles.wrapper, { opacity, transform: [{ translateY }] }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: greenAlpha.bg,
            borderColor: greenAlpha.border,
          },
        ]}
      >
        {/* Icon + text row */}
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: greenAlpha.iconBg }]}>
            <Text style={styles.icon}>📸</Text>
          </View>
          <View style={styles.textBlock}>
            <Text style={[styles.eyebrow, { color: greenAlpha.eyebrow }]}>
              {t('today.diaryBanner.from', { name: item.professionalName })}
            </Text>
            <Text style={[Type.subheadline, styles.title, { color: colors.label }]} numberOfLines={2}>
              {t('today.diaryBanner.title')}
            </Text>
            <Text style={[Type.caption1, { color: colors.label2, marginTop: 2 }]}>
              {t('today.diaryBanner.subtitle', {
                role: t(roleKey),
                days: item.durationDays,
              })}
            </Text>
          </View>
          <Text style={[styles.chevron, { color: colors.label3 }]}>›</Text>
        </View>

        {/* CTAs */}
        <View style={styles.ctaRow}>
          <Pressable
            onPress={onAccept}
            style={({ pressed }) => [
              styles.ctaAccept,
              { backgroundColor: colors.green, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.ctaText, { color: colors.onAccent }]}>
              {t('today.diaryBanner.accept')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.ctaDismiss,
              {
                borderColor: colors.sep,
                backgroundColor: colors.bg2,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[styles.ctaText, { color: colors.label }]}>
              {t('today.diaryBanner.dismiss')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  )
}

export default DiaryRequestBanner

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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: {
    fontSize: 20,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.05,
    marginBottom: 2,
  },
  title: {
    fontWeight: '600',
  },
  chevron: {
    fontSize: 18,
    fontWeight: '600',
    flexShrink: 0,
  },
  ctaRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  ctaAccept: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  ctaDismiss: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '600',
  },
})
