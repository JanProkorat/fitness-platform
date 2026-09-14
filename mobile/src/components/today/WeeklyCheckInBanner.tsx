import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { goldAlpha } from '@/constants/colors'
import { Radius } from '@/constants/radius'
import type { CheckInSummary } from '@/api/weeklyCheckIns'

interface WeeklyCheckInBannerProps {
  /** A single pending check-in (one banner per item). */
  checkIn: CheckInSummary
  /** Called when the user taps "Let them know". */
  onOpen: (checkIn: CheckInSummary) => void
}

function ProfessionPill({ profession }: { profession: CheckInSummary['profession'] }) {
  const colors = useTheme()
  const emoji = profession === 'Training' ? '🏋️' : '🥗'
  return (
    <View style={[styles.pill, { backgroundColor: goldAlpha['12'] }]}>
      <Text style={[styles.pillText, { color: colors.gold }]}>
        {emoji}
      </Text>
    </View>
  )
}

export function WeeklyCheckInBanner({ checkIn, onOpen }: WeeklyCheckInBannerProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-32)).current

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
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start()
  }, [opacity, translateY])

  const promptKey =
    checkIn.profession === 'Training'
      ? 'weeklyCheckIn.defaultPrompt.training'
      : 'weeklyCheckIn.defaultPrompt.nutrition'

  return (
    <Animated.View style={[styles.wrapper, { opacity, transform: [{ translateY }] }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.goldBg,
            borderColor: goldAlpha['25'],
          },
        ]}
      >
        {/* Icon + text row */}
        <View style={styles.iconRow}>
          <View style={[styles.iconCircle, { backgroundColor: goldAlpha['20'] }]}>
            <Text style={styles.iconEmoji}>📅</Text>
          </View>
          <View style={styles.textBlock}>
            <View style={styles.nameRow}>
              <Text
                style={[Type.headline, { color: colors.label, flexShrink: 1 }]}
                numberOfLines={1}
              >
                {checkIn.professionalName}
              </Text>
              <ProfessionPill profession={checkIn.profession} />
            </View>
            <Text
              style={[Type.caption1, { color: colors.label2, marginTop: 2 }]}
              numberOfLines={2}
            >
              {t(promptKey)}
            </Text>
          </View>
        </View>

        {/* CTA button */}
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.gold, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => onOpen(checkIn)}
          accessibilityRole="button"
          accessibilityLabel={t('weeklyCheckIn.banner.cta')}
        >
          <Text style={[styles.btnText, { color: colors.onAccent }]}>
            {t('weeklyCheckIn.banner.cta')}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

export default WeeklyCheckInBanner

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
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 22,
  },
  textBlock: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  btn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
})
