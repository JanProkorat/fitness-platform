import React, { useRef, useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { GoldButton } from '@/components/ui/GoldButton'
import type { ProfessionalSummary } from '@/api/professionals'

const SCREEN_HEIGHT = Dimensions.get('window').height

interface SendInviteSheetProps {
  visible: boolean
  professional: ProfessionalSummary | null
  onClose: () => void
  onSend: (professionalId: string, message?: string) => void
  isSending: boolean
}

export function SendInviteSheet({ visible, professional, onClose, onSend, isSending }: SendInviteSheetProps) {
  const colors = useTheme()
  const insets = useSafeAreaInsets()
  const [message, setMessage] = useState('')
  const [mounted, setMounted] = useState(false)
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const overlayOpacity = useRef(new Animated.Value(0)).current
  const profRef = useRef(professional)

  // Keep a ref to the last non-null professional so content stays during close animation
  if (professional) profRef.current = professional

  useEffect(() => {
    if (visible) {
      setMounted(true)
      setMessage('')
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

  const prof = profRef.current
  if (!prof) return null

  const fullName = `${prof.firstName} ${prof.lastName}`
  const roles = prof.roles?.length ? prof.roles : prof.role ? [prof.role] : []

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { backgroundColor: colors.bg2, paddingBottom: insets.bottom + 60, transform: [{ translateY }] }]}>
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: colors.sep }]} />
        </View>

        <Text style={[Type.title2, { color: colors.label, paddingHorizontal: 16 }]}>
          Send Invitation
        </Text>

        <View style={[styles.profRow, { borderBottomColor: colors.sep2 }]}>
          <View>
            <Text style={[Type.headline, { color: colors.label }]}>{fullName}</Text>
            <Text style={[Type.caption1, { color: colors.label2 }]}>
              {roles.join(' & ')}{prof.city ? ` · ${prof.city}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.fill, color: colors.label, borderColor: colors.sep }]}
            placeholder="Write an introduction message (optional)..."
            placeholderTextColor={colors.label3}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={[Type.caption2, { color: colors.label3, textAlign: 'right', marginTop: 4 }]}>
            {message.length}/500
          </Text>
        </View>

        <View style={styles.actions}>
          <GoldButton
            title={isSending ? 'Sending...' : 'Send Invitation'}
            onPress={() => onSend(prof.publicId, message || undefined)}
            disabled={isSending}
            style={{ flex: 1 }}
          />
        </View>
      </Animated.View>
    </View>
  )
}

export default SendInviteSheet

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
  profRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  inputWrap: {
    padding: 16,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    maxHeight: 160,
  },
  actions: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
})
