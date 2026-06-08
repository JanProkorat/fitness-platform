import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { ProProfileView } from '@/components/trainers/ProProfileView'
import { useAuthStore } from '@/stores/auth'
import type { ColorScheme } from '@/constants/colors'

export function CoachProfileScreen() {
  const { coachId } = useLocalSearchParams<{ coachId: string }>()
  const router = useRouter()
  const colors = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const trainer = useAuthStore((s) => s.trainer)
  const coach = useAuthStore((s) => s.coach)
  const hasTrainer = useAuthStore((s) => s.hasTrainer)
  const hasCoach = useAuthStore((s) => s.hasCoach)

  const isLinkedTrainer = trainer?.id === coachId && hasTrainer
  const isLinkedCoach = coach?.id === coachId && hasCoach
  const isLinked = isLinkedTrainer || isLinkedCoach

  // Active collaborator entry — used to get the `since` date for the badge
  const activeCollaborator = isLinkedTrainer ? trainer : isLinkedCoach ? coach : null

  const styles = makeStyles(colors)

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Fixed blurred header */}
      <View style={[styles.fixedHeader, { paddingTop: insets.top }]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.headerContent}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={colors.gold} />
            <Text style={[styles.backLabel, { color: colors.gold }]}>{t('messages.title')}</Text>
          </Pressable>
        </View>
        <View style={[styles.headerBorder, { backgroundColor: colors.sep2 }]} />
      </View>

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + 52 }]}>
        {isLinked && activeCollaborator ? (
          <ProProfileView
            professionalPublicId={activeCollaborator.id}
            displayName={activeCollaborator.name}
            activeSince={activeCollaborator.since}
            onMessagePress={() => router.back()}
            onEndCollabPress={() => {}}
            showActionBar={false}
          />
        ) : (
          <ProProfileView
            professionalPublicId={coachId ?? ''}
            displayName=""
            activeSince=""
            onMessagePress={() => router.back()}
            onEndCollabPress={() => {}}
            showActionBar={false}
          />
        )}
      </View>
    </View>
  )
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    fixedHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    headerBorder: {
      height: StyleSheet.hairlineWidth,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    backLabel: {
      ...Type.body,
    },
    content: {
      flex: 1,
    },
  })

export default CoachProfileScreen
