import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { goldAlpha } from '@/constants/colors'
import { Radius } from '@/constants/radius'

interface QuestionnaireBannerProps {
  /** Number of pending questionnaires. If >1, shows count and navigates to list. */
  count?: number
  /** Names of coaches who sent questionnaires (shown as subtitle). */
  coachNames?: string[]
  /** Called when user taps "Fill in" (single) or the banner (multiple → list screen). */
  onFill: () => void
}

export function QuestionnaireBanner({ count = 1, coachNames, onFill }: QuestionnaireBannerProps) {
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

  const isMultiple = count > 1
  const subtitle = coachNames?.length
    ? t('pendingQuestionnaires.fromCoaches', { names: coachNames.join(', ') })
    : isMultiple
      ? t('pendingQuestionnaires.subtitle')
      : t('today.questionnaireDesc')

  return (
    <Animated.View style={[styles.wrapper, { opacity, transform: [{ translateY }] }]}>
      <Pressable
        onPress={isMultiple ? onFill : undefined}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.goldBg,
            borderColor: goldAlpha['25'],
            opacity: isMultiple && pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={styles.iconRow}>
          <View style={[styles.iconCircle, { backgroundColor: goldAlpha['20'] }]}>
            <Text style={{ fontSize: 22 }}>📋</Text>
          </View>
          <View style={styles.textBlock}>
            <Text style={[Type.headline, { color: colors.label }]}>
              {isMultiple
                ? t('pendingQuestionnaires.bannerTitle', { count })
                : t('today.questionnaireTitle')}
            </Text>
            <Text style={[Type.caption1, { color: colors.label2, marginTop: 2 }]} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
          {isMultiple && (
            <Text style={{ fontSize: 18, color: colors.label3 }}>›</Text>
          )}
        </View>

        {!isMultiple && (
          <Pressable
            onPress={onFill}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: colors.gold, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.btnText, { color: colors.onAccent }]}>{t('today.questionnaireFill')}</Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  )
}

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
  textBlock: {
    flex: 1,
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

export default QuestionnaireBanner
