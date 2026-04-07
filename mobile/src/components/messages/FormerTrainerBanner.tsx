import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'

interface FormerTrainerBannerProps {
  trainerName: string
  onShow: () => void
  onIgnore: () => void
}

export function FormerTrainerBanner({ trainerName, onShow, onIgnore }: FormerTrainerBannerProps) {
  const colors = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: 'rgba(255,149,0,0.08)', borderColor: 'rgba(255,149,0,0.2)' }]}>
      <Text style={styles.icon}>⚠️</Text>
      <View style={styles.body}>
        <Text style={styles.title}>Message from former trainer</Text>
        <Text style={[styles.sub, { color: colors.label2 }]}>
          Collaboration with {trainerName} has ended. You see this message because they wrote to you again.
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={onShow}
            style={[styles.btn, { backgroundColor: colors.gold }]}
          >
            <Text style={styles.btnPrimary}>Show chat</Text>
          </Pressable>
          <Pressable
            onPress={onIgnore}
            style={[styles.btn, { backgroundColor: colors.fill }]}
          >
            <Text style={[styles.btnSecondary, { color: colors.label2 }]}>Ignore</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 14,
    marginVertical: 8,
    padding: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  icon: {
    fontSize: 16,
    flexShrink: 0,
    marginTop: 1,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff9500',
  },
  sub: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 7,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
  },
  btnPrimary: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  btnSecondary: {
    fontSize: 12,
    fontWeight: '600',
  },
})

export default FormerTrainerBanner
