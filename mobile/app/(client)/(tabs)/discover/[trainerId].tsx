import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { ProProfileView } from '@/components/trainers/ProProfileView'
import { useAuthStore } from '@/stores/auth'
import { useCollaboration } from '@/hooks/useCollaboration'
import { SendInviteSheet, type InviteTarget } from '@/components/trainers/SendInviteSheet'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getProfessionalProfile } from '@/api/professionals'
import { startConversation } from '@/api/messages'
import { href } from '@/lib/navigation'
import { Toast } from '@/lib/toast'

export default function TrainerProfileScreen() {
  const { trainerId } = useLocalSearchParams<{ trainerId: string }>()
  const router = useRouter()
  const colors = useTheme()
  const insets = useSafeAreaInsets()
  const [showInviteSheet, setShowInviteSheet] = useState(false)
  const { t } = useTranslation()
  const { sendRequest, cancelRequest, isSendingRequest, endTrainerCollab, endCoachCollab } = useCollaboration()
  const pendingRequests = useAuthStore((s) => s.pendingRequests)
  const hasTrainer = useAuthStore((s) => s.hasTrainer)
  const hasCoach = useAuthStore((s) => s.hasCoach)
  const trainer = useAuthStore((s) => s.trainer)
  const coach = useAuthStore((s) => s.coach)
  const queryClient = useQueryClient()

  // #773 — "Zpráva" must open a chat composer, not the Messages list, even
  // when no conversation exists yet with this coach. startConversation is a
  // get-or-create endpoint (POST /conversations), so it's safe to call every
  // time — it returns the existing thread if one is already there.
  const startConversationMutation = useMutation({
    mutationFn: (participantId: string) => startConversation(participantId),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      router.push(href(`/(client)/messages/${conversation.id ?? ''}`))
    },
    onError: () => {
      Toast.show(t('collab.startConversationError'))
    },
  })

  const handleMessagePress = (participantId: string) => {
    if (!participantId || startConversationMutation.isPending) return
    startConversationMutation.mutate(participantId)
  }

  // Profile query — same key as ProProfileView so cache is shared
  const query = useQuery({
    queryKey: ['trainer-profile', trainerId],
    queryFn: () => getProfessionalProfile(trainerId!),
    enabled: !!trainerId,
  })

  const profile = query.data
  const isPending = pendingRequests.some((r) => r.trainerId === trainerId)
  const isLinkedTrainer = trainer?.id === trainerId && hasTrainer
  const isLinkedCoach = coach?.id === trainerId && hasCoach
  const isLinked = isLinkedTrainer || isLinkedCoach

  const fullName = profile
    ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
    : ''

  const roles = profile?.roles?.length ? profile.roles : []
  const roleLabel = roles
    .map((r) => (r === 'Trainer' ? 'Osobní trenér' : r === 'Nutritionist' ? 'Výživový poradce' : r))
    .join(' & ')

  const showCTA = !isLinked
  const showInviteBtn = showCTA && !isPending

  // Active collaborator entry (used to get the `since` date for the badge)
  const activeCollaborator = isLinkedTrainer ? trainer : isLinkedCoach ? coach : null

  // End-collab handler for linked pros viewed from the detail screen
  const handleEndCollab = () => {
    if (isLinkedTrainer) endTrainerCollab()
    else if (isLinkedCoach) endCoachCollab()
  }

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
            <Text style={[styles.backLabel, { color: colors.gold }]}>{t('collab.title')}</Text>
          </Pressable>
          {showInviteBtn && (
            <Pressable
              onPress={() => setShowInviteSheet(true)}
              style={({ pressed }) => [
                styles.headerCTA,
                { backgroundColor: colors.gold, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.headerCTAText, { color: colors.onAccent }]}>
                {t('collab.contact')}
              </Text>
            </Pressable>
          )}
          {isPending && (
            <Pressable
              onPress={() => Alert.alert(
                t('collab.revokeTitle'),
                t('collab.revokeMessage', { name: fullName }),
                [
                  { text: t('collab.endCollabCancel'), style: 'cancel' },
                  { text: t('collab.revokeConfirm'), style: 'destructive', onPress: () => {
                    const req = pendingRequests.find((r) => r.trainerId === trainerId)
                    if (req) cancelRequest(req.id)
                  }},
                ],
              )}
              style={({ pressed }) => [
                styles.headerCTA,
                { backgroundColor: colors.red + '14', opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.headerCTAText, { color: colors.red }]}>
                {t('collab.cancelRequest')}
              </Text>
            </Pressable>
          )}
        </View>
        <View style={[styles.headerBorder, { backgroundColor: colors.sep2 }]} />
      </View>

      {/* Content — render ProProfileView for linked pros (has since date);
          for unlinked/pending, render it with empty activeSince so no badge shown. */}
      <View style={[styles.content, { paddingTop: insets.top + 52 }]}>
        {isLinked && activeCollaborator ? (
          <ProProfileView
            professionalPublicId={activeCollaborator.id}
            displayName={activeCollaborator.name}
            activeSince={activeCollaborator.since}
            onMessagePress={() => handleMessagePress(activeCollaborator.id)}
            onEndCollabPress={handleEndCollab}
          />
        ) : (
          <ProProfileView
            professionalPublicId={trainerId ?? ''}
            displayName={fullName}
            activeSince=""
            onMessagePress={() => handleMessagePress(trainerId ?? '')}
            onEndCollabPress={() => {}}
            showActionBar={false}
          />
        )}
      </View>

      {profile && showInviteBtn && (
        <SendInviteSheet
          visible={showInviteSheet}
          target={{
            id: profile.publicId ?? '',
            name: fullName,
            role: roleLabel,
            city: profile.city ?? '',
          }}
          onClose={() => setShowInviteSheet(false)}
          onSend={(id, message) => {
            sendRequest(id, message)
            setShowInviteSheet(false)
          }}
          isSending={isSendingRequest}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
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
    justifyContent: 'space-between',
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
  headerCTA: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  headerCTAText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
})
