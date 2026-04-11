import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import type { PendingPlan } from '@/stores/todayStore'

interface PlanBannerProps {
  plan: PendingPlan
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function formatStartDate(iso: string, locale: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

export function PlanBanner({ plan }: PlanBannerProps) {
  const colors = useTheme()
  const router = useRouter()
  const { t, i18n } = useTranslation()

  const accent = plan.accentColor
  const bgColor = hexToRgba(accent, 0.08)
  const borderColor = hexToRgba(accent, 0.22)
  const tagBgColor = hexToRgba(accent, 0.18)
  const emoji = plan.type === 'training' ? '🏋️' : '🥗'
  const typeLabel = plan.type === 'training'
    ? t('today.trainingPlanType')
    : t('today.nutritionPlanType')

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderColor }]}>
      {/* Top row: type icon + label + starts date badge */}
      <View style={styles.topRow}>
        <View style={styles.typeGroup}>
          <View style={[styles.iconBox, { backgroundColor: tagBgColor }]}>
            <Text style={styles.iconEmoji}>{emoji}</Text>
          </View>
          <Text style={[styles.typeLabel, { color: colors.label2 }]}>
            {typeLabel}
          </Text>
        </View>
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>
            {t('today.startsOn', { date: formatStartDate(plan.startDate, i18n.language) })}
          </Text>
        </View>
      </View>

      {/* Trainer name + detail chips */}
      {(plan.trainerName || (plan.chips ?? []).length > 0) ? (
        <View style={styles.detailRow}>
          {plan.trainerName ? (
            <Text style={[styles.trainerName, { color: colors.label }]}>{plan.trainerName}</Text>
          ) : null}
          {(plan.chips ?? []).map((chip) => (
            <View key={chip} style={styles.chip}>
              <Text style={[styles.chipText, { color: colors.label2 }]}>{chip}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* CTA pill button */}
      <Pressable
        style={[styles.ctaButton, { backgroundColor: accent }]}
        onPress={() => router.push('/(client)/plans' as never)}
      >
        <Ionicons name="calendar-outline" size={14} color="#fff" />
        <Text style={styles.ctaText}>{t('today.viewPlan')}</Text>
      </Pressable>
    </View>
  )
}

export default PlanBanner

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  trainerName: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  chip: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  typeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 15,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  dateBadge: {
    backgroundColor: 'rgba(255,149,0,0.10)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ff9500',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
})
