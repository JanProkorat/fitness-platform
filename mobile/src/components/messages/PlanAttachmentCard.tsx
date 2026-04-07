import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import type { PlanAttachment } from '../../types/messages'

interface PlanAttachmentCardProps {
  attachment: PlanAttachment
  onPress: () => void
}

export function PlanAttachmentCard({ attachment, onPress }: PlanAttachmentCardProps) {
  const colors = useTheme()

  return (
    <Pressable onPress={onPress} style={styles.card}>
      {/* Hero zone with gradient */}
      <LinearGradient
        colors={[attachment.gradientStart, attachment.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.planType}>
          {attachment.planType.toUpperCase()}
        </Text>
        <Text style={styles.planName} numberOfLines={2}>
          {attachment.planName}
        </Text>
      </LinearGradient>

      {/* Footer zone */}
      <View style={[styles.footer, { backgroundColor: colors.bg2 }]}>
        <Text
          style={[Type.caption1, { color: colors.label2, flex: 1 }]}
          numberOfLines={1}
        >
          {attachment.meta}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.label3} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    maxWidth: 220,
    borderRadius: 14,
    overflow: 'hidden',
  },
  hero: {
    height: 70,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'flex-end',
  },
  planType: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  planName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
})

export default PlanAttachmentCard
