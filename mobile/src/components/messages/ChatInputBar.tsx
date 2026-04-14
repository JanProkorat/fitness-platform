import React, { useState } from 'react'
import { View, TextInput, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'

interface ChatInputBarProps {
  onSend: (text: string) => void
  onAttachPress: () => void
  onTyping?: () => void
}

export function ChatInputBar({ onSend, onAttachPress, onTyping }: ChatInputBarProps) {
  const colors = useTheme()
  const insets = useSafeAreaInsets()
  const [text, setText] = useState('')

  const canSend = text.trim().length > 0

  const handleSend = () => {
    if (!canSend) return
    onSend(text.trim())
    setText('')
  }

  const handleChangeText = (val: string) => {
    setText(val)
    onTyping?.()
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.inner,
          {
            borderTopColor: colors.sep2,
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}
      >
        {/* Attach button */}
        <Pressable
          onPress={onAttachPress}
          style={[styles.iconBtn, { backgroundColor: colors.fill }]}
        >
          <Ionicons name="add" size={20} color={colors.label2} />
        </Pressable>

        {/* Text input */}
        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: colors.bg2,
              borderColor: colors.sep,
            },
          ]}
        >
          <TextInput
            style={[styles.input, { color: colors.label }]}
            placeholder="Message"
            placeholderTextColor={colors.label3}
            value={text}
            onChangeText={handleChangeText}
            multiline
            maxLength={2000}
            textAlignVertical="center"
          />
        </View>

        {/* Send button */}
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={[
            styles.sendBtn,
            { backgroundColor: colors.gold, opacity: canSend ? 1 : 0.35 },
          ]}
        >
          <Ionicons name="arrow-up" size={18} color={colors.onAccent} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    zIndex: 10,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  inputWrap: {
    flex: 1,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 6,
    maxHeight: 120, // ~5 lines
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    lineHeight: 22,
    padding: 0,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
})

export default ChatInputBar
