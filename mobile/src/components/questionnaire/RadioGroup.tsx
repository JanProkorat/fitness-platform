import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

interface RadioGroupProps {
  choices: string[]
  value: string | undefined
  onChange: (choice: string) => void
}

export function RadioGroup({ choices, value, onChange }: RadioGroupProps) {
  const colors = useTheme()

  return (
    <View style={styles.container}>
      {choices.map((choice) => {
        const selected = value === choice
        return (
          <Pressable
            key={choice}
            onPress={() => onChange(choice)}
            style={[
              styles.pill,
              {
                backgroundColor: selected ? colors.goldBg : colors.bg2,
                borderColor: selected ? colors.gold : colors.sep,
              },
            ]}
          >
            <View
              style={[
                styles.radio,
                {
                  borderColor: selected ? colors.gold : colors.label3,
                },
              ]}
            >
              {selected && (
                <View style={[styles.radioInner, { backgroundColor: colors.gold }]} />
              )}
            </View>
            <Text
              style={[
                styles.label,
                { color: selected ? colors.label : colors.label2 },
              ]}
            >
              {choice}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    ...Type.body,
    flex: 1,
  },
})

export default RadioGroup
