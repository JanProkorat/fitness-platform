import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../src/stores/auth'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Badge } from '@/components/ui/Badge'
import { TrainerCard } from '@/components/trainers/TrainerCard'
import { SendInviteSheet } from '@/components/trainers/SendInviteSheet'
import { InviteDetailSheet } from '@/components/trainers/InviteDetailSheet'
import { Toast } from '@/lib/toast'
import {
  searchProfessionals,
  sendClientRequest,
  cancelClientRequest,
  getMyRequests,
  type ProfessionalSummary,
  type ClientRequestDto,
} from '../../src/api/professionals'
import { getCollaborations } from '../../src/api/profile'
import { startConversation } from '../../src/api/messages'

const ROLE_SEGMENTS = ['All', 'Trainers', 'Nutritionists'] as const
const ROLE_VALUES: Record<string, string | undefined> = {
  All: undefined,
  Trainers: 'Trainer',
  Nutritionists: 'Nutritionist',
}


// ─── Active Collaboration View ────────────────────────────────────────

function ActiveCollaborationView() {
  const colors = useTheme()

  return (
    <View style={styles.collabContainer}>
      <View style={[styles.collabCard, { backgroundColor: colors.bg2 }]}>
        <Ionicons name="people" size={40} color={colors.gold} />
        <Text style={[Type.title3, { color: colors.label, marginTop: 12 }]}>
          Active Collaboration
        </Text>
        <Text
          style={[
            Type.subheadline,
            { color: colors.label2, marginTop: 4, textAlign: 'center' },
          ]}
        >
          You're currently working with a trainer. Check your Profile tab for
          collaboration details.
        </Text>
        <Badge label="Connected" variant="active" />
      </View>
    </View>
  )
}

// ─── Search Marketplace ───────────────────────────────────────────────

function SearchMarketplace() {
  const colors = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const linkedRoles = useAuthStore((s) => s.user?.linkedRoles ?? [])
  const [search, setSearch] = useState('')
  const [roleIdx, setRoleIdx] = useState(0)
  const roleValue = ROLE_VALUES[ROLE_SEGMENTS[roleIdx]]

  // Sheets state
  const [inviteTarget, setInviteTarget] = useState<ProfessionalSummary | null>(null)
  const [detailTarget, setDetailTarget] = useState<{ request: ClientRequestDto; profName: string } | null>(null)

  const professionalsQuery = useQuery({
    queryKey: ['professionals', search, roleValue],
    queryFn: () =>
      searchProfessionals({
        search: search || undefined,
        role: roleValue,
        pageSize: 30,
      }),
  })

  const requestsQuery = useQuery({
    queryKey: ['my-requests'],
    queryFn: getMyRequests,
  })

  // Map professionalPublicId → pending request for quick lookup
  const requestByProfId = useMemo(() => {
    const map = new Map<string, ClientRequestDto>()
    requestsQuery.data?.forEach((r) => {
      if (r.status === 'Pending') {
        map.set(r.professionalPublicId, r)
      }
    })
    return map
  }, [requestsQuery.data])

  // Active collaborations — source of truth for "connected" state
  const collabQuery = useQuery({
    queryKey: ['collaborations'],
    queryFn: getCollaborations,
  })

  const connectedProfIds = useMemo(() => {
    const set = new Set<string>()
    collabQuery.data?.forEach((c) => set.add(c.professionalPublicId))
    return set
  }, [collabQuery.data])

  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set())

  // Clear optimistic IDs that are no longer pending (rejected, cancelled, accepted)
  useEffect(() => {
    if (optimisticIds.size === 0) return
    const stillPending = new Set<string>()
    optimisticIds.forEach((id) => {
      if (requestByProfId.has(id)) stillPending.add(id)
    })
    if (stillPending.size !== optimisticIds.size) {
      setOptimisticIds(stillPending)
    }
  }, [requestByProfId])

  const contactMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message?: string }) =>
      sendClientRequest(id, message),
    onMutate: ({ id }) => {
      setOptimisticIds((prev) => new Set(prev).add(id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
      setInviteTarget(null)
      Toast.show('Invitation sent')
    },
    onError: (_err, { id }) => {
      setOptimisticIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      Alert.alert('Error', 'Could not send invitation. Please try again.')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (publicId: string) => cancelClientRequest(publicId),
    onSuccess: (_data, publicId) => {
      // Find the professionalPublicId from the revoked request and clear optimistic state
      const revokedRequest = requestsQuery.data?.find((r) => r.publicId === publicId)
      if (revokedRequest) {
        setOptimisticIds((prev) => {
          const next = new Set(prev)
          next.delete(revokedRequest.professionalPublicId)
          return next
        })
      }
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
      setDetailTarget(null)
      Toast.show('Invitation revoked')
    },
    onError: () => {
      Alert.alert('Error', 'Could not revoke invitation.')
    },
  })

  const isRefreshing = professionalsQuery.isRefetching
  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['professionals'] })
    queryClient.invalidateQueries({ queryKey: ['my-requests'] })
    queryClient.invalidateQueries({ queryKey: ['collaborations'] })
  }, [queryClient])

  const renderItem = ({ item }: { item: ProfessionalSummary }) => {
    const existingRequest = requestByProfId.get(item.publicId)
    const hasPending = existingRequest?.status === 'Pending' || optimisticIds.has(item.publicId)
    const isConnected = connectedProfIds.has(item.publicId)

    let contactLabel = 'Invite'
    let contactDisabled = false
    let onContact = () => setInviteTarget(item)

    if (isConnected) {
      contactLabel = 'Message'
      contactDisabled = false
      onContact = () => {
        startConversation(item.publicId).then((conv) => {
          router.push(`/(client)/messages/${conv.id}` as never)
        })
      }
    } else if (hasPending) {
      contactLabel = 'Detail'
      contactDisabled = false
      onContact = () => {
        const req = existingRequest ?? requestsQuery.data?.find(
          (r) => r.professionalPublicId === item.publicId && r.status === 'Pending',
        )
        if (req) {
          setDetailTarget({
            request: req,
            profName: `${item.firstName} ${item.lastName}`,
          })
        }
      }
    }

    return (
      <TrainerCard
        professional={item}
        onProfile={() => {}}
        onContact={onContact}
        contactDisabled={contactDisabled}
        contactLabel={contactLabel}
      />
    )
  }

  return (
    <>
      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: colors.fill }]}>
          <Ionicons name="search" size={18} color={colors.label3} />
          <TextInput
            style={[styles.searchInput, { color: colors.label }]}
            placeholder="Search name, specialisation..."
            placeholderTextColor={colors.label3}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.label3} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Segmented control */}
      <View style={styles.segmentWrap}>
        <View style={[styles.segmented, { backgroundColor: colors.fill }]}>
          {ROLE_SEGMENTS.map((label, idx) => {
            const active = idx === roleIdx
            return (
              <Pressable
                key={label}
                onPress={() => setRoleIdx(idx)}
                style={[styles.segment, active && { backgroundColor: colors.bg2 }]}
              >
                <Text
                  style={[styles.segmentText, { color: active ? colors.label : colors.label2 }]}
                >
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Results */}
      {professionalsQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : (
        <FlatList
          data={(() => {
            const items = professionalsQuery.data?.items ?? []
            // Filter out professionals whose role is already linked, except the connected one
            const filtered = items.filter((item) => {
              const profRoles = item.roles?.length ? item.roles : item.role ? [item.role] : []
              const isConnected = connectedProfIds.has(item.publicId)
              const isRoleLinked = profRoles.some((r) => linkedRoles.includes(r))
              // Keep: not role-linked, OR this is the actual connected professional
              return !isRoleLinked || isConnected
            })
            // Sort connected coach to top
            return filtered.sort((a, b) => {
              const aConnected = connectedProfIds.has(a.publicId) ? 0 : 1
              const bConnected = connectedProfIds.has(b.publicId) ? 0 : 1
              return aConnected - bConnected
            })
          })()}
          keyExtractor={(item) => item.publicId}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.gold}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <Ionicons name="search-outline" size={48} color={colors.label3} />
              <Text style={[Type.headline, { color: colors.label3, marginTop: 12 }]}>
                No professionals found
              </Text>
              <Text
                style={[
                  Type.subheadline,
                  { color: colors.label3, marginTop: 4, textAlign: 'center' },
                ]}
              >
                Try adjusting your search or filters.
              </Text>
            </View>
          }
        />
      )}

      {/* Send invite sheet */}
      <SendInviteSheet
        visible={inviteTarget !== null}
        professional={inviteTarget}
        onClose={() => setInviteTarget(null)}
        onSend={(id, message) => contactMutation.mutate({ id, message })}
        isSending={contactMutation.isPending}
      />

      {/* Invite detail sheet */}
      <InviteDetailSheet
        visible={detailTarget !== null}
        request={detailTarget?.request ?? null}
        professionalName={detailTarget?.profName ?? ''}
        onClose={() => setDetailTarget(null)}
        onRevoke={(publicId) => revokeMutation.mutate(publicId)}
        isRevoking={revokeMutation.isPending}
      />
    </>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const colors = useTheme()
  const linkedRoles = useAuthStore((s) => s.user?.linkedRoles ?? [])
  const hasBothRoles = linkedRoles.includes('Trainer') && linkedRoles.includes('Nutritionist')

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[Type.largeTitle, { color: colors.label }]}>Coaches</Text>
      </View>

      {hasBothRoles ? <ActiveCollaborationView /> : <SearchMarketplace />}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  // Collaboration view
  collabContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  collabCard: {
    borderRadius: Radius.md,
    padding: 32,
    alignItems: 'center',
    gap: 4,
  },
  // Search
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    ...Type.body,
    height: '100%',
    padding: 0,
  },
  // Segmented
  segmentWrap: {
    paddingHorizontal: 16,
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
  // List
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyList: {
    alignItems: 'center',
    paddingTop: 60,
  },
})
