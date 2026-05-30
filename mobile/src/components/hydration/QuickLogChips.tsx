/**
 * QuickLogChips — horizontal scroll row of preset ml chips + a "Custom" chip.
 *
 * Preset amounts: 200, 250, 330, 500, 750 ml.
 * The "Custom" chip calls onCustomPress to open the CustomAmountSheet.
 */

import React, { useCallback } from 'react'
import { ScrollView, Text, Pressable, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { goldAlpha } from '@/constants/colors'

export const PRESET_AMOUNTS = [200, 250, 330, 500, 750] as const

interface QuickLogChipsProps {
  onLog: (amountMl: number) => void
  onCustomPress: () => void
}

export function QuickLogChips({ onLog, onCustomPress }: QuickLogChipsProps): React.ReactElement {
  const { t } = useTranslation()
  const colors = useTheme()

  const styles = makeStyles(colors)

  const handlePress = useCallback(
    (amount: number) => {
      onLog(amount)
    },
    [onLog],
  )

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {PRESET_AMOUNTS.map((amount) => (
        <Pressable
          key={amount}
          onPress={() => handlePress(amount)}
          style={({ pressed }) => [
            styles.chip,
            { opacity: pressed ? 0.7 : 1, backgroundColor: goldAlpha['10'], borderColor: goldAlpha['35'] },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('hydration.quickLog.presetLabel', { amount })}
        >
          <Text style={[styles.chipText, { color: colors.gold }]}>
            {t('hydration.quickLog.presetLabel', { amount })}
          </Text>
        </Pressable>
      ))}

      {/* Custom chip */}
      <Pressable
        onPress={onCustomPress}
        style={({ pressed }) => [
          styles.chip,
          { opacity: pressed ? 0.7 : 1, backgroundColor: colors.fill, borderColor: colors.sep },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('hydration.quickLog.customLabel')}
      >
        <View style={styles.chipInner}>
          <Text style={[styles.chipText, { color: colors.label2 }]}>
            {t('hydration.quickLog.customLabel')}
          </Text>
        </View>
      </Pressable>
    </ScrollView>
  )
}

export default QuickLogChips

type Colors = ReturnType<typeof useTheme>

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    scroll: {
      flexShrink: 0,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 4,
    },
    chip: {
      borderRadius: Radius.full,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    chipInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    chipText: {
      ...Type.footnote,
      fontWeight: '600',
    },
  })
}
