import React, { useRef, useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Avatar } from '@/components/ui/Avatar'
import { GoldButton } from '@/components/ui/GoldButton'

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
  const [message, setMessage] = useState('')
  const targetRef = useRef(target)

  if (target) targetRef.current = target

  useEffect(() => {
    if (visible) setMessage('')
  }, [visible])

  const prof = targetRef.current
  if (!prof) return null

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('collab.contactName', { name: prof.name.split(' ')[0] })}
      fitContent
    >
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
        />
      </View>
    </BottomSheet>
  )
}

export default SendInviteSheet

const styles = StyleSheet.create({
  profRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    padding: 16,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    padding: 12,
    fontSize: 15,
    minHeight: 150,
    maxHeight: 240,
  },
  actions: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
})
