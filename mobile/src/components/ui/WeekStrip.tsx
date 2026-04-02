import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

type DayStatus = 'done' | 'today' | 'future' | 'rest'

interface WeekStripProps {
  days: DayStatus[]
}

export function WeekStrip({ days }: WeekStripProps) {
  const colors = useTheme()

  return (
    <View style={styles.strip}>
      {DAY_LABELS.map((label, idx) => {
        const status = days[idx] ?? 'future'
        const isDone = status === 'done'
        const isToday = status === 'today'

        return (
          <View key={idx} style={styles.day}>
            <Text style={[styles.label, { color: isToday ? colors.gold : colors.label3 }]}>
              {label}
            </Text>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: isDone
                    ? colors.green
                    : isToday
                      ? colors.gold
                      : colors.fill,
                },
              ]}
            >
              {isDone && (
                <Ionicons name="checkmark" size={12} color="#fff" />
              )}
              {isToday && (
                <View style={[styles.todayInner, { backgroundColor: colors.gold }]} />
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  day: {
    alignItems: 'center',
    flex: 1,
  },
  label: {
    ...Type.caption2,
    fontWeight: '600',
    marginBottom: 6,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})

export default WeekStrip
