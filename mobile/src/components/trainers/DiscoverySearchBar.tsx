import React from 'react'
import { View, TextInput, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

interface DiscoverySearchBarProps {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
}

export function DiscoverySearchBar({
  value,
  onChangeText,
  placeholder,
}: DiscoverySearchBarProps) {
  const colors = useTheme()

  return (
    <View style={[styles.bar, { backgroundColor: colors.fill }]}>
      <Ionicons name="search" size={18} color={colors.label3} />
      <TextInput
        style={[styles.input, { color: colors.label }]}
        placeholder={placeholder}
        placeholderTextColor={colors.label3}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={colors.label3} />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    gap: 8,
    marginHorizontal: 0,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    ...Type.body,
    height: '100%',
    padding: 0,
  },
})

export default DiscoverySearchBar
