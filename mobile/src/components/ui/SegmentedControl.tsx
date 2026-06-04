import React from 'react'
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

export interface SegmentOption {
  key: string
  label: string
  disabled?: boolean
}

interface SegmentedControlProps {
  options: SegmentOption[]
  selectedKey: string
  onSelect: (key: string) => void
  style?: ViewStyle
}

export function SegmentedControl({
  options,
  selectedKey,
  onSelect,
  style,
}: SegmentedControlProps) {
  const colors = useTheme()

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.track, { backgroundColor: colors.fill }]}>
        {options.map(({ key, label, disabled }) => {
          const active = key === selectedKey
          return (
            <Pressable
              key={key}
              onPress={() => {
                if (!disabled) onSelect(key)
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled }}
              style={[
                styles.segment,
                active && !disabled && { backgroundColor: colors.bg2 },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: disabled
                      ? colors.label3
                      : active
                        ? colors.label
                        : colors.label2,
                  },
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  track: {
    flexDirection: 'row',
    borderRadius: Radius.sm,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.sm - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    ...Type.subheadline,
    fontWeight: '600',
  },
})

export default SegmentedControl
