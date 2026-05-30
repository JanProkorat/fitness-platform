/**
 * HydrationHistoryStrip — 7-day daily totals bar strip (oldest → newest,
 * left to right). Each column shows a proportional bar and abbreviated day
 * label. Today's column is highlighted in gold.
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { selectLast7DaysTotals } from '@/stores/hydrationStore'
import type { DrinkLog } from '@/stores/hydrationStore'
import { goldAlpha } from '@/constants/colors'

interface HydrationHistoryStripProps {
  log: DrinkLog[]
  targetMl: number
}

/** Abbreviated day labels matching the locale in i18n (2-char). */
function dayAbbrev(dateStr: string, t: ReturnType<typeof useTranslation>['t']): string {
  const d = new Date(dateStr)
  const dayIndex = d.getDay() // 0=Sun
  return t(`hydration.history.dayLabels.${dayIndex}`)
}

export function HydrationHistoryStrip({ log, targetMl }: HydrationHistoryStripProps): React.ReactElement {
  const { t } = useTranslation()
  const colors = useTheme()
  const styles = makeStyles(colors)

  // selectLast7DaysTotals returns newest-first; reverse to render oldest→newest left→right
  const days = selectLast7DaysTotals(log).reverse()
  const maxMl = Math.max(...days.map((d) => d.totalMl), targetMl, 1)

  const todayStr = days[days.length - 1]?.date ?? ''

  return (
    <View style={styles.container}>
      {days.map((day) => {
        const ratio = maxMl > 0 ? Math.min(day.totalMl / maxMl, 1) : 0
        const isToday = day.date === todayStr
        const reachedTarget = day.totalMl >= targetMl
        const barColor = reachedTarget ? colors.green : colors.gold

        return (
          <View key={day.date} style={styles.column}>
            {/* Bar track + fill */}
            <View style={[styles.barTrack, { backgroundColor: colors.fill }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    height: `${ratio * 100}%`,
                    backgroundColor: isToday ? barColor : colors.label3,
                  },
                ]}
              />
              {/* Target line */}
              {targetMl > 0 && maxMl > 0 && (
                <View
                  style={[
                    styles.targetLine,
                    {
                      bottom: `${(targetMl / maxMl) * 100}%`,
                      backgroundColor: isToday ? goldAlpha['35'] : colors.sep,
                    },
                  ]}
                />
              )}
            </View>

            {/* Day label */}
            <Text
              style={[
                styles.dayLabel,
                { color: isToday ? colors.gold : colors.label3 },
                isToday && styles.dayLabelToday,
              ]}
            >
              {dayAbbrev(day.date, t)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

export default HydrationHistoryStrip

type Colors = ReturnType<typeof useTheme>

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      paddingHorizontal: 16,
      height: 80,
    },
    column: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
    },
    barTrack: {
      width: '100%',
      flex: 1,
      borderRadius: Radius.sm,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      position: 'relative',
    },
    barFill: {
      width: '100%',
      borderRadius: Radius.sm,
    },
    targetLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
    },
    dayLabel: {
      ...Type.caption2,
    },
    dayLabelToday: {
      fontWeight: '700',
    },
  })
}
