import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'

interface MealRowProps {
  name: string
  kcal: number
  eaten?: boolean
  time?: string | null
  onPress?: () => void
  onMarkEaten?: () => void
}

export function MealRow({ name, kcal, eaten, time, onPress, onMarkEaten }: MealRowProps) {
  const colors = useTheme()

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { borderBottomColor: colors.sep2 }]}
    >
      <View style={[styles.icon, { backgroundColor: eaten ? colors.green + '20' : colors.fill }]}>
        <Ionicons
          name={eaten ? 'checkmark' : 'restaurant-outline'}
          size={16}
          color={eaten ? colors.green : colors.label3}
        />
      </View>
      <View style={styles.info}>
        <Text
          style={[styles.name, { color: eaten ? colors.label3 : colors.label }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text style={[styles.meta, { color: colors.label3 }]}>
          {Math.round(kcal)} kcal{time ? ` · ${time}` : ''}
        </Text>
      </View>
      {!eaten && onMarkEaten && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onMarkEaten();
          }}
          hitSlop={8}
          style={[styles.eatBtn, { backgroundColor: colors.goldBg }]}
        >
          <Text style={[styles.eatText, { color: colors.gold }]}>Eaten</Text>
        </Pressable>
      )}
      {eaten && (
        <Text style={[styles.done, { color: colors.green }]}>Done</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    ...Type.body,
  },
  meta: {
    ...Type.caption1,
    marginTop: 2,
  },
  eatBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 8,
  },
  eatText: {
    ...Type.caption1,
    fontWeight: '600',
  },
  done: {
    ...Type.caption1,
    fontWeight: '600',
    marginLeft: 8,
  },
})

export default MealRow
