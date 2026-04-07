import React, { useRef, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Badge } from '@/components/ui/Badge'
import type { ClientRequestDto } from '@/api/professionals'

const SCREEN_HEIGHT = Dimensions.get('window').height

interface InviteDetailSheetProps {
  visible: boolean
  request: ClientRequestDto | null
  professionalName: string
  onClose: () => void
  onRevoke: (publicId: string) => void
  isRevoking: boolean
}

export function InviteDetailSheet({
  visible,
  request,
  professionalName,
  onClose,
  onRevoke,
  isRevoking,
}: InviteDetailSheetProps) {
  const colors = useTheme()
  const insets = useSafeAreaInsets()
  const [mounted, setMounted] = useState(false)
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const overlayOpacity = useRef(new Animated.Value(0)).current
  const requestRef = useRef(request)
  const nameRef = useRef(professionalName)

  if (request) { requestRef.current = request; nameRef.current = professionalName }

  useEffect(() => {
    if (visible) {
      setMounted(true)
      translateY.setValue(SCREEN_HEIGHT)
      overlayOpacity.setValue(0)
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
      ]).start()
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }),
      ]).start(() => setMounted(false))
    }
  }, [visible])

  if (!mounted) return null

  const req = requestRef.current
  if (!req) return null

  const isPending = req.status === 'Pending'
  const badgeVariant = req.status === 'Accepted' ? 'active' as const
    : req.status === 'Rejected' ? 'warning' as const
    : req.status === 'Cancelled' ? 'inactive' as const
    : 'gold' as const

  const sentDate = new Date(req.sentAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { backgroundColor: colors.bg2, transform: [{ translateY }] }]}>
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: colors.sep }]} />
        </View>

        <Text style={[Type.title2, { color: colors.label, paddingHorizontal: 16 }]}>
          Invite Detail
        </Text>

        <View style={styles.content}>
          <View style={styles.row}>
            <Text style={[Type.caption1, { color: colors.label3 }]}>Coach</Text>
            <Text style={[Type.headline, { color: colors.label }]}>{nameRef.current}</Text>
          </View>

          <View style={styles.row}>
            <Text style={[Type.caption1, { color: colors.label3 }]}>Status</Text>
            <Badge label={req.status} variant={badgeVariant} />
          </View>

          <View style={styles.row}>
            <Text style={[Type.caption1, { color: colors.label3 }]}>Sent</Text>
            <Text style={[Type.subheadline, { color: colors.label }]}>{sentDate}</Text>
          </View>

          {req.message && (
            <View style={styles.row}>
              <Text style={[Type.caption1, { color: colors.label3 }]}>Your message</Text>
              <Text style={[Type.subheadline, { color: colors.label2, marginTop: 4 }]}>
                {req.message}
              </Text>
            </View>
          )}
        </View>

        {isPending && (
          <View style={styles.actions}>
            <Pressable
              onPress={() => onRevoke(req.publicId)}
              disabled={isRevoking}
              style={[styles.revokeBtn, { backgroundColor: colors.red + '18' }]}
            >
              <Text style={[styles.revokeText, { color: colors.red }]}>
                {isRevoking ? 'Revoking...' : 'Revoke Invitation'}
              </Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: insets.bottom + 60 }} />
      </Animated.View>
    </View>
  )
}

export default InviteDetailSheet

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  row: {
    gap: 4,
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  revokeBtn: {
    paddingVertical: 14,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  revokeText: {
    fontSize: 15,
    fontWeight: '600',
  },
})
