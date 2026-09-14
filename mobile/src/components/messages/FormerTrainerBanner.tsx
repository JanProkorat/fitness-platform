import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Static } from '@/constants/colors'
import { Radius } from '@/constants/radius'

interface FormerTrainerBannerProps {
  trainerName: string
  onShow: () => void
  onIgnore: () => void
}

export function FormerTrainerBanner({ trainerName, onShow, onIgnore }: FormerTrainerBannerProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  return (
    <View style={[styles.container, { backgroundColor: 'rgba(255,149,0,0.08)', borderColor: 'rgba(255,149,0,0.2)' }]}>
      <Text style={styles.icon}>⚠️</Text>
      <View style={styles.body}>
        <Text style={styles.title}>{t('messages.formerTrainerTitle')}</Text>
        <Text style={[styles.sub, { color: colors.label2 }]}>
          {t('messages.formerTrainerDesc', { name: trainerName })}
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={onShow}
            style={[styles.btn, { backgroundColor: colors.gold }]}
          >
            <Text style={[styles.btnPrimary, { color: colors.onAccent }]}>{t('messages.showChat')}</Text>
          </Pressable>
          <Pressable
            onPress={onIgnore}
            style={[styles.btn, { backgroundColor: colors.fill }]}
          >
            <Text style={[styles.btnSecondary, { color: colors.label2 }]}>{t('messages.ignore')}</Text>
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
    color: Static.orange,
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
  },
  btnSecondary: {
    fontSize: 12,
    fontWeight: '600',
  },
})

export default FormerTrainerBanner
