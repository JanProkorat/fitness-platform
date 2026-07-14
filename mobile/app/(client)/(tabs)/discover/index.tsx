import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { href } from '@/lib/navigation'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { useCollaboration } from '@/hooks/useCollaboration'
import { useClientInvite } from '@/hooks/useClientInvite'
import { useTrainers } from '@/hooks/useTrainers'
import { DiscoverySearchBar } from '@/components/trainers/DiscoverySearchBar'
import { DiscoveryFilters } from '@/components/trainers/DiscoveryFilters'
import { TrainerCard, type TrainerCardData } from '@/components/trainers/TrainerCard'
import { ProProfileView } from '@/components/trainers/ProProfileView'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SendInviteSheet, type InviteTarget } from '@/components/trainers/SendInviteSheet'
import type { ProfessionalSummary } from '@/api/professionals'
import type { ActiveCollaborator } from '@/stores/auth'

// ─── Tab keys ─────────────────────────────────────────────────────────

type CollabTab = 'trainer' | 'coach' | 'search'

// ─── Helpers ──────────────────────────────────────────────────────────

function toTrainerCardData(p: ProfessionalSummary): TrainerCardData {
  const roles = p.roles ?? []
  const roleLabel = roles
    .map((r) => (r === 'Trainer' ? 'Osobní trenér' : r === 'Nutritionist' ? 'Výž. poradce' : r))
    .join(' & ')

  const roleLabels = roles.map((r) =>
    r === 'Trainer' ? 'Osobní trenér' : r === 'Nutritionist' ? 'Výž. poradce' : r,
  )

  return {
    id: p.publicId ?? '',
    name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
    role: roleLabel,
    roles: roleLabels,
    city: p.city ?? '',
    rating: 0,
    reviewCount: 0,
    priceMonthly: p.estimatedPrice ?? '',
    tags: p.specializations ?? [],
    accepting: true,
    avatarImageUrl: p.avatarBlobUrl ?? null,
  }
}

// ─── Determine which tabs are enabled and the default selected tab ─────

interface TabConfig {
  trainerEnabled: boolean
  coachEnabled: boolean
  searchEnabled: boolean
  defaultTab: CollabTab
}

function getTabConfig(hasTrainer: boolean, hasCoach: boolean): TabConfig {
  if (hasTrainer && hasCoach) {
    return { trainerEnabled: true, coachEnabled: true, searchEnabled: false, defaultTab: 'trainer' }
  }
  if (hasTrainer) {
    return { trainerEnabled: true, coachEnabled: false, searchEnabled: true, defaultTab: 'trainer' }
  }
  if (hasCoach) {
    return { trainerEnabled: false, coachEnabled: true, searchEnabled: true, defaultTab: 'coach' }
  }
  return { trainerEnabled: false, coachEnabled: false, searchEnabled: true, defaultTab: 'search' }
}

// ─── Hledat tab (discovery list) ──────────────────────────────────────

function SearchTab() {
  const colors = useTheme()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'trainer' | 'coach'>('all')
  const [inviteTarget, setInviteTarget] = useState<InviteTarget | null>(null)
  const pendingRequests = useAuthStore((s) => s.pendingRequests)
  const { sendRequest, cancelRequest, isSendingRequest } = useCollaboration()
  // Pending invite FROM a professional — surfaced first in this list with a
  // "Zobrazit pozvánku" CTA instead of "Oslovit" (#772).
  const { invite } = useClientInvite(true)
  const invitedTrainerId = invite?.trainerId ?? null

  const trainersQuery = useTrainers({ search, role: roleFilter, goal: '' })

  const items = useMemo(() => {
    const pages = trainersQuery.data?.pages ?? []
    return pages.flatMap((page) => page.items ?? []).filter((p): p is ProfessionalSummary => p != null)
  }, [trainersQuery.data])

  const cardData = useMemo(() => {
    const cards = items.map(toTrainerCardData)
    const pIds = new Set(pendingRequests.map((r) => r.trainerId))
    return cards.sort((a, b) => {
      const aInvited = a.id === invitedTrainerId ? 0 : 1
      const bInvited = b.id === invitedTrainerId ? 0 : 1
      if (aInvited !== bInvited) return aInvited - bInvited
      const aP = pIds.has(a.id) ? 0 : 1
      const bP = pIds.has(b.id) ? 0 : 1
      return aP - bP
    })
  }, [items, pendingRequests, invitedTrainerId])

  const pendingIds = useMemo(
    () => new Set(pendingRequests.map((r) => r.trainerId)),
    [pendingRequests],
  )

  const { t } = useTranslation()

  const handleEndReached = () => {
    if (trainersQuery.hasNextPage && !trainersQuery.isFetchingNextPage) {
      trainersQuery.fetchNextPage()
    }
  }

  const renderItem = useCallback(({ item }: { item: TrainerCardData }) => {
    const isPending = pendingIds.has(item.id)
    const isInvited = item.id === invitedTrainerId
    const requestStatus = isInvited ? 'invited' : isPending ? 'pending' : 'none'

    return (
      <TrainerCard
        trainer={item}
        requestStatus={requestStatus}
        onProfilePress={() => router.push(href(`/(client)/discover/${item.id}`))}
        onContactPress={() => {
          if (!isPending) setInviteTarget({ id: item.id, name: item.name, role: item.role, city: item.city })
        }}
        onViewInvitePress={() => router.push(href('/(client)/discover/invite'))}
        onRevokePress={() => {
          Alert.alert(
            t('collab.revokeTitle'),
            t('collab.revokeMessage', { name: item.name }),
            [
              { text: t('collab.endCollabCancel'), style: 'cancel' },
              { text: t('collab.revokeConfirm'), style: 'destructive', onPress: () => {
                const req = pendingRequests.find((r) => r.trainerId === item.id)
                if (req) cancelRequest(req.id)
              }},
            ],
          )
        }}
      />
    )
  }, [pendingIds, invitedTrainerId, router, t, pendingRequests, cancelRequest])

  const handleSend = (trainerId: string, message?: string) => {
    sendRequest(trainerId, message)
    setInviteTarget(null)
  }

  return (
    <>
      <FlatList
        data={cardData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={trainersQuery.isRefetching}
            onRefresh={() => trainersQuery.refetch()}
            tintColor={colors.gold}
          />
        }
        ListHeaderComponent={
          <View style={{ paddingBottom: 4 }}>
            <DiscoverySearchBar
              value={search}
              onChangeText={setSearch}
              placeholder={t('collab.searchPlaceholder')}
            />
            <DiscoveryFilters
              roleFilter={roleFilter}
              onRoleChange={setRoleFilter}
              hideRoleControl={false}
            />
          </View>
        }
        ListFooterComponent={
          trainersQuery.isFetchingNextPage ? (
            <ActivityIndicator style={{ paddingVertical: 20 }} color={colors.gold} />
          ) : null
        }
        ListEmptyComponent={
          trainersQuery.isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.gold} />
            </View>
          ) : (
            <View style={styles.emptyList}>
              <Text style={[Type.headline, { color: colors.label3 }]}>
                {t('collab.noResults')}
              </Text>
              <Text style={[Type.subheadline, { color: colors.label3, marginTop: 4, textAlign: 'center' }]}>
                {t('collab.noResultsHint')}
              </Text>
            </View>
          )
        }
      />
      <SendInviteSheet
        visible={inviteTarget !== null}
        target={inviteTarget}
        onClose={() => setInviteTarget(null)}
        onSend={handleSend}
        isSending={isSendingRequest}
      />
    </>
  )
}

// ─── Pro tab (inline profile) ──────────────────────────────────────────

function ProTab({ collaborator, onEnd }: { collaborator: ActiveCollaborator; onEnd: () => void }) {
  const router = useRouter()

  return (
    <ProProfileView
      professionalPublicId={collaborator.id}
      displayName={collaborator.name}
      activeSince={collaborator.since}
      onMessagePress={() => router.push(href('/(client)/messages'))}
      onEndCollabPress={onEnd}
    />
  )
}

// ─── Main screen ───────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const colors = useTheme()
  const { t } = useTranslation()
  const hasTrainer = useAuthStore((s) => s.hasTrainer)
  const hasCoach = useAuthStore((s) => s.hasCoach)
  const trainer = useAuthStore((s) => s.trainer)
  const coach = useAuthStore((s) => s.coach)
  const { endTrainerCollab, endCoachCollab } = useCollaboration()

  const { trainerEnabled, coachEnabled, searchEnabled, defaultTab } = getTabConfig(hasTrainer, hasCoach)

  const [selectedTab, setSelectedTab] = useState<CollabTab>(defaultTab)

  // If the default tab changes (e.g. collab ends while on screen), snap to a valid enabled tab.
  const effectiveTab = (() => {
    if (selectedTab === 'trainer' && !trainerEnabled) return defaultTab
    if (selectedTab === 'coach' && !coachEnabled) return defaultTab
    if (selectedTab === 'search' && !searchEnabled) return defaultTab
    return selectedTab
  })()

  const segmentOptions = [
    { key: 'trainer' as const, label: t('collab.tabTrainer'), disabled: !trainerEnabled },
    { key: 'coach' as const, label: t('collab.tabCoach'), disabled: !coachEnabled },
    { key: 'search' as const, label: t('collab.tabSearch'), disabled: !searchEnabled },
  ]

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header: title only — no subtitle per AC */}
      <View style={styles.pageHeader}>
        <Text style={[Type.largeTitle, { color: colors.label }]}>{t('collab.title')}</Text>
      </View>

      {/* Segmented control */}
      <SegmentedControl
        options={segmentOptions}
        selectedKey={effectiveTab}
        onSelect={(key) => setSelectedTab(key as CollabTab)}
      />

      {/* Tab content */}
      {effectiveTab === 'trainer' && trainer && (
        <ProTab collaborator={trainer} onEnd={endTrainerCollab} />
      )}
      {effectiveTab === 'coach' && coach && (
        <ProTab collaborator={coach} onEnd={endCoachCollab} />
      )}
      {effectiveTab === 'search' && <SearchTab />}
    </SafeAreaView>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  centered: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyList: {
    alignItems: 'center',
    paddingTop: 60,
  },
})
