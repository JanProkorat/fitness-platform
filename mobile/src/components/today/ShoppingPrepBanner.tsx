import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { goldAlpha } from '@/constants/colors'
import { Radius } from '@/constants/radius'
import { hrefParams } from '@/lib/navigation'

interface ShoppingPrepBannerProps {
  week: number
}

export function ShoppingPrepBanner({ week }: ShoppingPrepBannerProps) {
  const { t } = useTranslation()
  const colors = useTheme()
  const router = useRouter()

  return (
    <View style={[styles.banner, { backgroundColor: colors.goldBg }]}>
      <View style={styles.content}>
        <View style={[styles.icon, { backgroundColor: goldAlpha['20'] }]}>
          <Ionicons name="cart-outline" size={22} color={colors.gold} />
        </View>
        <View style={styles.text}>
          <Text style={[styles.title, { color: colors.label }]}>
            {t('today.shoppingBannerTitle')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.label2 }]}>
            {t('today.shoppingBannerLabel')}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.gold }]}
        activeOpacity={0.8}
        onPress={() => router.push(hrefParams('/(client)/today-shopping', { week: String(week), from: 'today' }))}
      >
        <Ionicons name="list-outline" size={16} color={colors.onAccent} />
        <Text style={[styles.btnText, { color: colors.onAccent }]}>
          {t('today.shoppingBannerButton')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

export default ShoppingPrepBanner

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    borderRadius: Radius.md,
    padding: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...Type.subheadline,
    fontWeight: '600',
  },
  subtitle: {
    ...Type.footnote,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
  btnText: {
    ...Type.subheadline,
    fontWeight: '600',
  },
})
