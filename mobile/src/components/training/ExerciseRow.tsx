import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'

const MUSCLE_COLORS: Record<string, string> = {
  chest: '#ff6b6b',
  back: '#4ecdc4',
  shoulders: '#45b7d1',
  legs: '#96ceb4',
  arms: '#ffeaa7',
  core: '#dda0dd',
  cardio: '#f7dc6f',
}

interface ExerciseRowProps {
  name: string
  setsDescription: string
  muscleGroup?: string
  completed?: boolean
  onToggle?: () => void
}

export function ExerciseRow({
  name,
  setsDescription,
  muscleGroup,
  completed,
  onToggle,
}: ExerciseRowProps) {
  const colors = useTheme()
  const dotColor = muscleGroup
    ? MUSCLE_COLORS[muscleGroup.toLowerCase()] ?? colors.label3
    : colors.label3

  return (
    <View style={[styles.row, { borderBottomColor: colors.sep2 }]}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View style={styles.info}>
        <Text
          style={[
            styles.name,
            { color: completed ? colors.label3 : colors.label },
          ]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text style={[styles.sets, { color: colors.label3 }]}>
          {setsDescription}
        </Text>
      </View>
      {onToggle && (
        <Pressable onPress={onToggle} hitSlop={8} style={styles.checkbox}>
          <Ionicons
            name={completed ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={completed ? colors.green : colors.label3}
          />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    ...Type.body,
  },
  sets: {
    ...Type.caption1,
    marginTop: 2,
  },
  checkbox: {
    marginLeft: 12,
  },
})

export default ExerciseRow
