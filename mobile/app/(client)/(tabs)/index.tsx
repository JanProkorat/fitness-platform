import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { href, hrefParams } from '@/lib/navigation'
import { useTodayStore } from '@/stores/todayStore'
import { useTodayState } from '@/hooks/useTodayState'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/auth'
import { TodayHeader } from '@/components/today/TodayHeader'
import { NoTrainerState } from '@/components/today/NoTrainerState'
import { HasTrainerState } from '@/components/today/HasTrainerState'
import { NotificationSheet } from '@/components/notifications/NotificationSheet'
import { InviteCard } from '@/components/notifications/InviteCard'
import { QuestionnaireBanner } from '@/components/notifications/QuestionnaireBanner'
import { DiaryRequestBanner } from '@/components/today/DiaryRequestBanner'
import { DiaryWorkflowBanner } from '@/components/today/DiaryWorkflowBanner'
import { WeeklyCheckInBanner } from '@/components/today/WeeklyCheckInBanner'
import { useNotifications } from '@/hooks/useNotifications'
import { useClientInvite } from '@/hooks/useClientInvite'
import {
  getPendingQuestionnaires,
  type PendingQuestionnairesResponse,
  type PendingDiaryRequestItem,
} from '@/api/questionnaire'
import {
  getActiveWorkflowDiaryRequests,
  type ClientPhotoDiaryRequestSummary,
} from '@/api/diaryRequests'
import { getCurrentCheckIns, type CheckInSummary } from '@/api/weeklyCheckIns'
import { onEvent } from '@/api/signalr'
import { Toast } from '@/lib/toast'

// ─── Main Screen ──────────────────────────────────────────────────────

export default function TodayScreen() {
  const colors = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [sheetOpen, setSheetOpen] = useState(false)

  // ── State resolution ──
  useTodayState()
  const todayState = useTodayStore((s) => s.state)

  // Notifications
  const {
    notifications,
    unreadCount,
    markAllRead,
    markRead,
  } = useNotifications()

  // Pending invite — always fetch, client can receive invites in any state
  const { invite, accept, decline } = useClientInvite(true)

  // ── Weekly check-ins (pending banner) ──
  const hasActiveLink = useAuthStore((s) => s.user?.hasActiveLink ?? false)
  const checkInsQuery = useQuery({
    queryKey: ['current-weekly-check-ins'],
    queryFn: getCurrentCheckIns,
    enabled: hasActiveLink,
    staleTime: 30_000,
  })
  const pendingCheckIns: CheckInSummary[] = checkInsQuery.data?.checkIns ?? []

  // Subscribe to weeklycheckinupdated so the banner disappears when client responds
  // or when the trainer marks reviewed (both paths fire the event).
  useEffect(() => {
    const unsub = onEvent('weeklycheckinupdated', () => {
      queryClient.invalidateQueries({ queryKey: ['current-weekly-check-ins'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })
    return unsub
  }, [queryClient])

  // Pending questionnaires — visible in all states with an active link
  const pendingQQuery = useQuery<PendingQuestionnairesResponse>({
    queryKey: ['pending-questionnaires'],
    queryFn: getPendingQuestionnaires,
    enabled: hasActiveLink,
    retry: false,
  })
  const pendingQItems = pendingQQuery.data?.items ?? []
  const pendingQCount = pendingQItems.length
  const pendingQCoachNames = useMemo(
    () => pendingQItems.map((i) => i.professionalName ?? ''),
    [pendingQItems],
  )

  // Pending diary requests — only Pending status (defensive; the query already filters)
  const pendingDiaryItems: PendingDiaryRequestItem[] = useMemo(
    () => (pendingQQuery.data?.pendingDiaryRequests ?? []).filter(
      (r) => r.status === 'Pending',
    ),
    [pendingQQuery.data?.pendingDiaryRequests],
  )

  // Active workflow diary requests (Accepted or InProgress, Mode === Workflow)
  const activeWorkflowQuery = useQuery<ClientPhotoDiaryRequestSummary[]>({
    queryKey: ['active-workflow-diary-requests'],
    queryFn: getActiveWorkflowDiaryRequests,
    enabled: hasActiveLink,
    staleTime: 30_000,
  })
  const activeWorkflowItems: ClientPhotoDiaryRequestSummary[] = activeWorkflowQuery.data ?? []

  // Subscribe to photoDiarySubmitted so workflow banners disappear when the diary
  // is auto-finalized server-side (day N+1 scheduler) or submitted manually.
  useEffect(() => {
    const unsub = onEvent('photodiarysubmitted', () => {
      queryClient.invalidateQueries({ queryKey: ['active-workflow-diary-requests'] })
      queryClient.invalidateQueries({ queryKey: ['pending-questionnaires'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })
    return unsub
  }, [queryClient])

  const handleNotificationAction = useCallback(
    (n: (typeof notifications)[0]) => {
      markRead(n.id)
      setSheetOpen(false)
      switch (n.type) {
        case 'invitation':
          break // invite card visible on Today
        case 'questionnaire':
          router.push(href('/(client)/questionnaire'))
          break
        case 'new_plan':
          if (n.actionPayload?.planId) {
            router.push(href(`/(client)/plans/${n.actionPayload.planId}`))
          }
          break
        case 'message':
          if (n.actionPayload?.threadId) {
            router.push(href(`/(client)/messages/${n.actionPayload.threadId}`))
          }
          break
        case 'weekly_checkin':
          if (n.actionPayload?.weeklyCheckInId) {
            router.push(href(`/(client)/weekly-checkin/${n.actionPayload.weeklyCheckInId}`))
          }
          break
      }
    },
    [markRead, router],
  )

  const handleNotificationDismiss = useCallback(
    (n: (typeof notifications)[0]) => {
      markRead(n.id)
    },
    [markRead],
  )

  // ── Refresh (manual pull-to-refresh only) ──
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['today-plan'] }),
      queryClient.invalidateQueries({ queryKey: ['today-log'] }),
      queryClient.invalidateQueries({ queryKey: ['today-training'] }),
      queryClient.invalidateQueries({ queryKey: ['compliance-score'] }),
      queryClient.invalidateQueries({ queryKey: ['nutrition-plan-full'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      queryClient.invalidateQueries({ queryKey: ['client-invite'] }),
      queryClient.invalidateQueries({ queryKey: ['pending-questionnaires'] }),
      queryClient.invalidateQueries({ queryKey: ['current-weekly-check-ins'] }),
      queryClient.invalidateQueries({ queryKey: ['active-workflow-diary-requests'] }),
    ])
    setRefreshing(false)
  }, [queryClient])

  // ── Loading state ──
  if (todayState === 'loading') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <TodayHeader
        unreadCount={unreadCount}
        onBellPress={() => setSheetOpen(true)}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
      >
        {/* Pending invite — visible in all states */}
        {invite && (
          <InviteCard
            invite={invite}
            onAccept={() => {
              accept(invite.id)
              Toast.show(t('today.inviteAccepted'))
            }}
            onDecline={() => decline(invite.id)}
          />
        )}

        {/* Weekly check-in banners — one per pending check-in, stacks vertically */}
        {pendingCheckIns.map((checkIn) => (
          <WeeklyCheckInBanner
            key={checkIn.id}
            checkIn={checkIn}
            onOpen={(ci) =>
              router.push(href(`/(client)/weekly-checkin/${ci.id}`))
            }
          />
        ))}

        {/* ── State: no-trainer ── */}
        {todayState === 'no-trainer' && <NoTrainerState />}

        {/* ── State: has-trainer ── */}
        {/* The pending-questionnaire banner is rendered inside HasTrainerState
            (right below the stat strip) so it doesn't cover the at-a-glance stats. */}
        {todayState === 'has-trainer' && (
          <HasTrainerState
            topBanner={
              <>
                {/* Diary-request banners render above questionnaire banners (ordering per #93) */}
                {pendingDiaryItems.map((item) => (
                  <DiaryRequestBanner
                    key={item.requestPublicId}
                    item={item}
                    onAccept={() =>
                      router.push(href(`/(client)/diary/${item.requestPublicId}`))
                    }
                    onDismiss={() =>
                      router.push(href(`/(client)/diary/${item.requestPublicId}/dismiss`))
                    }
                  />
                ))}

                {/* Active workflow diary banners — one per active 7-day workflow */}
                {activeWorkflowItems.map((item) => (
                  <DiaryWorkflowBanner
                    key={item.id}
                    request={item}
                    onOpen={() =>
                      router.push(href(`/(client)/diary/${item.id}/workflow`))
                    }
                  />
                ))}

                {/* Questionnaire banner */}
                {pendingQCount > 0 && (
                  <QuestionnaireBanner
                    count={pendingQCount}
                    coachNames={pendingQCoachNames}
                    onFill={() => {
                      if (pendingQCount > 1) {
                        router.push(href('/(client)/pending-questionnaires'))
                      } else {
                        router.push(hrefParams('/(auth)/questionnaire', { linkPublicId: pendingQItems[0]?.linkPublicId ?? '' }))
                      }
                    }}
                  />
                )}
              </>
            }
          />
        )}
      </ScrollView>

      <NotificationSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        notifications={notifications}
        onMarkAllRead={markAllRead}
        onAction={handleNotificationAction}
        onDismiss={handleNotificationDismiss}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingBottom: 100,
  },
})
