import React, { useRef, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Avatar } from '@/components/ui/Avatar'
import type { TrainerInvite } from '@/hooks/useClientInvite'

interface InviteCardProps {
  invite: TrainerInvite
  onAccept: () => void
  onDecline: () => void
}

export function InviteCard({ invite, onAccept, onDecline }: InviteCardProps) {
  const colors = useTheme()
  const opacity = useRef(new Animated.Value(1)).current
  const maxHeight = useRef(new Animated.Value(300)).current

  const animateOut = useCallback(
    (callback: () => void) => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 350,
          useNativeDriver: false,
        }),
        Animated.timing(maxHeight, {
          toValue: 0,
          duration: 350,
          useNativeDriver: false,
        }),
      ]).start(() => callback())
    },
    [opacity, maxHeight],
  )

  return (
    <Animated.View style={[styles.wrapper, { opacity, maxHeight }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.bg2,
            borderColor: 'rgba(201,168,76,0.25)',
            shadowColor: '#c9a84c',
          },
        ]}
      >
        {/* Trainer info */}
        <View style={styles.trainerRow}>
          <Avatar name={invite.trainerName} size="md" />
          <View style={styles.trainerInfo}>
            <Text style={[Type.headline, { color: colors.label }]}>
              {invite.trainerName}
            </Text>
            <Text style={[Type.caption1, { color: colors.label2 }]}>
              {invite.trainerRole}{invite.trainerCity ? ` \u00b7 ${invite.trainerCity}` : ''}
            </Text>
          </View>
        </View>

        {/* Message */}
        {invite.message ? (
          <Text style={[Type.subheadline, { color: colors.label2, marginTop: 10 }]}>
            {invite.message}
          </Text>
        ) : (
          <Text style={[Type.subheadline, { color: colors.label2, marginTop: 10 }]}>
            {invite.trainerName} would like to work with you as your {invite.trainerRole.toLowerCase()}.
          </Text>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.gold, flex: 1 }]}
            onPress={() => animateOut(onAccept)}
          >
            <Text style={styles.btnTextPrimary}>Accept invitation</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.fill, flex: 1 }]}
            onPress={() => animateOut(onDecline)}
          >
            <Text style={[styles.btnTextSecondary, { color: colors.label2 }]}>Decline</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  )
}

export default InviteCard

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  trainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trainerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btn: {
    paddingVertical: 12,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  btnTextPrimary: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  btnTextSecondary: {
    fontSize: 15,
    fontWeight: '500',
  },
})
