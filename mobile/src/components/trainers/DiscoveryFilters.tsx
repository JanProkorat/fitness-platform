import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

const ROLE_KEYS = [
  { key: 'all' as const, i18nKey: 'collab.all' },
  { key: 'trainer' as const, i18nKey: 'collab.trainers' },
  { key: 'coach' as const, i18nKey: 'collab.coaches' },
]

interface DiscoveryFiltersProps {
  roleFilter: 'all' | 'trainer' | 'coach'
  onRoleChange: (role: 'all' | 'trainer' | 'coach') => void
  hideRoleControl?: boolean
}

export function DiscoveryFilters({
  roleFilter,
  onRoleChange,
  hideRoleControl,
}: DiscoveryFiltersProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  if (hideRoleControl) return null

  return (
    <View style={styles.segmentWrap}>
      <View style={[styles.segmented, { backgroundColor: colors.fill }]}>
        {ROLE_KEYS.map(({ key, i18nKey }) => {
          const active = key === roleFilter
          return (
            <Pressable
              key={key}
              onPress={() => onRoleChange(key)}
              style={[styles.segment, active && { backgroundColor: colors.bg2 }]}
            >
              <Text style={[styles.segmentText, { color: active ? colors.label : colors.label2 }]}>
                {t(i18nKey)}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  segmentWrap: {
    paddingHorizontal: 0,
    paddingBottom: 8,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: Radius.sm,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.sm - 2,
    alignItems: 'center',
  },
  segmentText: {
    ...Type.subheadline,
    fontWeight: '600',
  },
})

export default DiscoveryFilters
