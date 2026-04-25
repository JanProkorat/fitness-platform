import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'

interface DateSeparatorProps {
  timestamp: string
}

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export const DateSeparator = React.memo(function DateSeparator({ timestamp }: DateSeparatorProps) {
  const colors = useTheme()
  const { i18n } = useTranslation()

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: colors.label3 }]}>
        {formatDate(timestamp, i18n.language)}
      </Text>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
})

export default DateSeparator
