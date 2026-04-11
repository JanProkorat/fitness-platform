import React, { useEffect, useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

interface ContextBannerProps {
  icon: string
  title: string
  sub: string
  actionLabel: string
  onAction: () => void
  onAccept?: () => void
  onDecline?: () => void
}

export function ContextBanner({
  icon,
  title,
  sub,
  actionLabel,
  onAction,
  onAccept,
  onDecline,
}: ContextBannerProps) {
  const colors = useTheme()
  const hasInviteActions = !!onAccept && !!onDecline
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

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={(icon as keyof typeof Ionicons.glyphMap) || 'information-circle'}
            size={20}
            color={colors.gold}
          />
        </View>
        <View style={styles.body}>
          <Text style={[Type.subheadline, { color: colors.label, fontWeight: '600' }]}>
            {title}
          </Text>
          <Text style={[Type.caption1, { color: colors.label2 }]}>{sub}</Text>
        </View>
        {!hasInviteActions && (
          <Pressable onPress={onAction} hitSlop={8}>
            <Text style={[Type.subheadline, { color: colors.gold, fontWeight: '600' }]}>
              {actionLabel}
            </Text>
          </Pressable>
        )}
      </View>
      {hasInviteActions && (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.gold, flex: 1 }]}
            onPress={onAccept}
          >
            <Text style={styles.btnTextPrimary}>Accept</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.fill, flex: 1 }]}
            onPress={onDecline}
          >
            <Text style={[styles.btnTextSecondary, { color: colors.label2 }]}>Decline</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(201,168,76,1)',
    backgroundColor: 'rgba(201,168,76,0.08)',
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,168,76,0.12)',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    paddingVertical: 10,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  btnTextPrimary: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  btnTextSecondary: {
    fontSize: 14,
    fontWeight: '500',
  },
})

export default ContextBanner
