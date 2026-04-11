import React, { useRef, useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Avatar } from '@/components/ui/Avatar'
import { GoldButton } from '@/components/ui/GoldButton'

const SCREEN_HEIGHT = Dimensions.get('window').height

export interface InviteTarget {
  id: string
  name: string
  role: string
  city: string
}

interface SendInviteSheetProps {
  visible: boolean
  target: InviteTarget | null
  onClose: () => void
  onSend: (trainerId: string, message?: string) => void
  isSending: boolean
}

export function SendInviteSheet({ visible, target, onClose, onSend, isSending }: SendInviteSheetProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [message, setMessage] = useState('')
  const [mounted, setMounted] = useState(false)
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const overlayOpacity = useRef(new Animated.Value(0)).current
  const targetRef = useRef(target)

  if (target) targetRef.current = target

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

  const prof = targetRef.current
  if (!prof) return null

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
          {t('collab.contactName', { name: prof.name.split(' ')[0] })}
        </Text>

        <View style={[styles.profRow, { borderBottomColor: colors.sep2 }]}>
          <Avatar name={prof.name} size="sm" />
          <View style={{ flex: 1 }}>
            <Text style={[Type.headline, { color: colors.label }]}>{prof.name}</Text>
            <Text style={[Type.caption1, { color: colors.label2 }]}>
              {prof.role}{prof.city ? ` · ${prof.city}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.fill, color: colors.label, borderColor: colors.sep }]}
            placeholder={t('collab.introPlaceholder')}
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
            title={isSending ? t('collab.sending') : t('collab.sendRequest')}
            onPress={() => onSend(prof.id, message || undefined)}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
