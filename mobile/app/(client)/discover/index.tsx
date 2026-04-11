import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore, getCollabState } from '../../../src/stores/auth'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { useCollaboration } from '@/hooks/useCollaboration'
import { useTrainers } from '@/hooks/useTrainers'
import { DiscoverySearchBar } from '@/components/trainers/DiscoverySearchBar'
import { DiscoveryFilters } from '@/components/trainers/DiscoveryFilters'
import { TrainerCard, type TrainerCardData } from '@/components/trainers/TrainerCard'
import { ActiveCollaboratorCard } from '@/components/trainers/ActiveCollaboratorCard'
import { SendInviteSheet, type InviteTarget } from '@/components/trainers/SendInviteSheet'
import type { ProfessionalSummary } from '@/api/professionals'
import type { ActiveCollaborator } from '@/stores/auth'

// ─── Fixed page header ───────────────────────────────────────────────

function PageHeader({ titleKey, subtitleKey }: { titleKey: string; subtitleKey?: string }) {
  const colors = useTheme()
  const { t } = useTranslation()
  return (
    <View style={styles.pageHeader}>
      <Text style={[Type.largeTitle, { color: colors.label }]}>{t(titleKey)}</Text>
      {subtitleKey && (
        <Text style={[Type.subheadline, { color: colors.label2, marginTop: 2 }]}>
          {t(subtitleKey)}
        </Text>
      )}
    </View>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────

function toTrainerCardData(p: ProfessionalSummary): TrainerCardData {
  const roles = p.roles?.length ? p.roles : p.role ? [p.role] : []
  const roleLabel = roles
    .map((r) => (r === 'Trainer' ? 'Osobní trenér' : r === 'Nutritionist' ? 'Výž. poradce' : r))
    .join(' & ')

  const roleLabels = roles.map((r) =>
    r === 'Trainer' ? 'Osobní trenér' : r === 'Nutritionist' ? 'Výž. poradce' : r,
  )

  return {
    id: p.publicId,
    name: `${p.firstName} ${p.lastName}`,
    role: roleLabel,
    roles: roleLabels,
    city: p.city ?? '',
    rating: 0,
    reviewCount: 0,
    priceMonthly: p.estimatedPrice ?? '',
    tags: p.specializations,
    accepting: true,
  }
}

// ─── Discovery List ──────────────────────────────────────────────────

function DiscoveryList({
  role,
  headerComponent,
}: {
  role: 'all' | 'trainer' | 'coach'
  headerComponent?: React.ReactElement
}) {
  const colors = useTheme()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'trainer' | 'coach'>(role)
  const [inviteTarget, setInviteTarget] = useState<InviteTarget | null>(null)
  const pendingRequests = useAuthStore((s) => s.pendingRequests)
  const { sendRequest, cancelRequest, isSendingRequest } = useCollaboration()

  const effectiveRole = role !== 'all' ? role : roleFilter

  const trainersQuery = useTrainers({
    search,
    role: effectiveRole,
    goal: '',
  })

  const items = useMemo(() => {
    const pages = trainersQuery.data?.pages ?? []
    return pages.flatMap((page) => page.items)
  }, [trainersQuery.data])

  const cardData = useMemo(() => {
    const cards = items.map(toTrainerCardData)
    // Sort pending (invited) coaches to the top
    const pIds = new Set(pendingRequests.map((r) => r.trainerId))
    return cards.sort((a, b) => {
      const aP = pIds.has(a.id) ? 0 : 1
      const bP = pIds.has(b.id) ? 0 : 1
      return aP - bP
    })
  }, [items, pendingRequests])

  const pendingIds = useMemo(
    () => new Set(pendingRequests.map((r) => r.trainerId)),
    [pendingRequests],
  )

  const handleEndReached = () => {
    if (trainersQuery.hasNextPage && !trainersQuery.isFetchingNextPage) {
      trainersQuery.fetchNextPage()
    }
  }

  const renderItem = ({ item }: { item: TrainerCardData }) => {
    const isPending = pendingIds.has(item.id)

    return (
      <TrainerCard
        trainer={item}
        requestStatus={isPending ? 'pending' : 'none'}
        onProfilePress={() => router.push(`/(client)/discover/${item.id}` as never)}
        onContactPress={() => {
          if (!isPending) setInviteTarget({ id: item.id, name: item.name, role: item.role, city: item.city })
        }}
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
  }

  const { t } = useTranslation()
  const searchPlaceholder =
    role === 'coach'
      ? t('collab.searchCoach')
      : role === 'trainer'
        ? t('collab.searchTrainer')
        : t('collab.searchPlaceholder')

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
          <>
            {headerComponent}
            <View style={{ paddingBottom: 4 }}>
              <DiscoverySearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={searchPlaceholder}
              />
              <DiscoveryFilters
                roleFilter={effectiveRole}
                onRoleChange={setRoleFilter}
                hideRoleControl={role !== 'all'}
              />
            </View>
          </>
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

// ─── State A: none — full discovery ──────────────────────────────────

function DiscoveryView() {
  return <DiscoveryList role="all" />
}

// ─── State B: trainer — has trainer, looking for coach ───────────────

function TrainerActiveView({ trainer }: { trainer: ActiveCollaborator }) {
  const colors = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const { endTrainerCollab } = useCollaboration()

  return (
    <DiscoveryList
      role="coach"
      headerComponent={
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.label }]}>{t('collab.yourTrainer')}</Text>
          </View>
          <ActiveCollaboratorCard
            collaborator={trainer}
            onProfilePress={() => router.push(`/(client)/discover/${trainer.id}` as never)}
            onMessagePress={() => router.push('/(client)/messages' as never)}
            onEndCollaboration={endTrainerCollab}
          />

          <View style={[styles.infoBanner, { backgroundColor: 'rgba(201,168,76,0.07)', borderColor: 'rgba(201,168,76,0.2)' }]}>
            <Text style={[styles.infoBannerTitle, { color: colors.label }]}>
              {t('collab.lookingForCoach')}
            </Text>
            <Text style={[styles.infoBannerBody, { color: colors.label2 }]}>
              {t('collab.lookingForCoachDesc')}
            </Text>
          </View>

          <View style={[styles.sectionHeader, { marginTop: 8 }]}>
            <Text style={[styles.sectionTitle, { color: colors.label }]}>{t('collab.nutritionCoaches')}</Text>
          </View>
        </>
      }
    />
  )
}

// ─── State C: coach — has coach, looking for trainer ─────────────────

function CoachActiveView({ coach }: { coach: ActiveCollaborator }) {
  const colors = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const { endCoachCollab } = useCollaboration()

  return (
    <DiscoveryList
      role="trainer"
      headerComponent={
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.label }]}>{t('collab.yourCoach')}</Text>
          </View>
          <ActiveCollaboratorCard
            collaborator={coach}
            onProfilePress={() => router.push(`/(client)/discover/${coach.id}` as never)}
            onMessagePress={() => router.push('/(client)/messages' as never)}
            onEndCollaboration={endCoachCollab}
          />

          <View style={[styles.infoBanner, { backgroundColor: 'rgba(201,168,76,0.07)', borderColor: 'rgba(201,168,76,0.2)' }]}>
            <Text style={[styles.infoBannerTitle, { color: colors.label }]}>
              {t('collab.lookingForTrainer')}
            </Text>
            <Text style={[styles.infoBannerBody, { color: colors.label2 }]}>
              {t('collab.lookingForTrainerDesc')}
            </Text>
          </View>

          <View style={[styles.sectionHeader, { marginTop: 8 }]}>
            <Text style={[styles.sectionTitle, { color: colors.label }]}>{t('collab.personalTrainers')}</Text>
          </View>
        </>
      }
    />
  )
}

// ─── State D: both — two active cards, no discovery ──────────────────

function BothActiveView({
  trainer,
  coach,
}: {
  trainer: ActiveCollaborator
  coach: ActiveCollaborator
}) {
  const colors = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const { endTrainerCollab, endCoachCollab } = useCollaboration()

  return (
    <ScrollView
      contentContainerStyle={styles.bothContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.label }]}>{t('collab.trainer')}</Text>
      </View>
      <ActiveCollaboratorCard
        collaborator={trainer}
        stats={{ compliancePercent: 95, progressLabel: '21', planWeek: '4/12' }}
        onProfilePress={() => router.push(`/(client)/discover/${trainer.id}` as never)}
        onMessagePress={() => router.push('/(client)/messages' as never)}
        onEndCollaboration={endTrainerCollab}
      />

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.label }]}>{t('collab.nutritionCoach')}</Text>
      </View>
      <ActiveCollaboratorCard
        collaborator={coach}
        stats={{ compliancePercent: 91, progressLabel: '−2,4 kg', planWeek: '8/12' }}
        onProfilePress={() => router.push(`/(client)/discover/${coach.id}` as never)}
        onMessagePress={() => router.push('/(client)/messages' as never)}
        onEndCollaboration={endCoachCollab}
      />
    </ScrollView>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const colors = useTheme()
  const hasTrainer = useAuthStore((s) => s.hasTrainer)
  const hasCoach = useAuthStore((s) => s.hasCoach)
  const trainer = useAuthStore((s) => s.trainer)
  const coach = useAuthStore((s) => s.coach)

  // Initialize collaboration data
  useCollaboration()

  const state = getCollabState(hasTrainer, hasCoach)

  const subtitleKey =
    state === 'none'
      ? 'collab.subtitleNone'
      : state === 'both'
        ? 'collab.subtitleBoth'
        : undefined

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <PageHeader titleKey="collab.title" subtitleKey={subtitleKey} />
      {state === 'none' && <DiscoveryView />}
      {state === 'trainer' && trainer && <TrainerActiveView trainer={trainer} />}
      {state === 'coach' && coach && <CoachActiveView coach={coach} />}
      {state === 'both' && trainer && coach && (
        <BothActiveView trainer={trainer} coach={coach} />
      )}
    </SafeAreaView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  sectionTitle: {
    ...Type.subheadline,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  bothContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  infoBanner: {
    marginHorizontal: 0,
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoBannerBody: {
    fontSize: 12,
  },
})
