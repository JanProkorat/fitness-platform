import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { BellButton } from '@/components/ui/BellButton'

interface TodayHeaderProps {
  unreadCount: number
  onBellPress: () => void
}

export function TodayHeader({ unreadCount, onBellPress }: TodayHeaderProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  const firstName = useAuthStore((s) => s.user?.firstName)

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <Text style={[Type.largeTitle, { color: colors.label }]}>
          {t('today.hi', { name: firstName })}
        </Text>
      </View>
      <BellButton
        count={unreadCount}
        onPress={onBellPress}
      />
    </View>
  )
}

export default TodayHeader

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  left: {
    flex: 1,
  },
})
