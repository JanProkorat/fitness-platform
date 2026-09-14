import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'

interface ScaleInputProps {
  min?: number
  max?: number
  value: number | undefined
  onChange: (val: number) => void
}

export function ScaleInput({ min = 1, max = 10, value, onChange }: ScaleInputProps) {
  const colors = useTheme()
  const buttons: number[] = []
  for (let i = min; i <= max; i++) buttons.push(i)

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {buttons.map((num) => {
          const selected = value === num
          return (
            <Pressable
              key={num}
              onPress={() => onChange(num)}
              style={[
                styles.button,
                {
                  backgroundColor: selected ? colors.gold : colors.bg2,
                  borderColor: selected ? colors.gold : colors.sep,
                },
              ]}
            >
              <Text
                style={[
                  styles.text,
                  { color: selected ? colors.onGoldChip : colors.label2 },
                ]}
              >
                {num}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <View style={styles.labels}>
        <Text style={[Type.caption2, { color: colors.label3 }]}>{min} — Low</Text>
        <Text style={[Type.caption2, { color: colors.label3 }]}>{max} — High</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
})

export default ScaleInput
