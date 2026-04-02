import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ScrollView,
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
import {
  searchProfessionals,
  sendClientRequest,
  getMyRequests,
  type ProfessionalSummary,
  type ClientRequestDto,
} from '../../src/api/professionals'

const ROLE_SEGMENTS = ['All', 'Trainers', 'Nutritionists'] as const
const ROLE_VALUES: Record<string, string | undefined> = {
  All: undefined,
  Trainers: 'Trainer',
  Nutritionists: 'Nutritionist',
}

const SPECIALIZATION_FILTERS = [
  'All',
  'Weight loss',
  'Muscle gain',
  'Fitness',
  'Rehabilitation',
] as const

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
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleIdx, setRoleIdx] = useState(0)
  const [specFilter, setSpecFilter] = useState('All')

  const roleValue = ROLE_VALUES[ROLE_SEGMENTS[roleIdx]]

  const professionalsQuery = useQuery({
    queryKey: ['professionals', search, roleValue, specFilter],
    queryFn: () =>
      searchProfessionals({
        search: search || undefined,
        role: roleValue,
        specialization: specFilter === 'All' ? undefined : specFilter,
        pageSize: 30,
      }),
  })

  const requestsQuery = useQuery({
    queryKey: ['my-requests'],
    queryFn: getMyRequests,
  })

  const pendingRequestIds = useMemo(() => {
    const set = new Set<string>()
    requestsQuery.data?.forEach((r) => {
      if (r.status === 'Pending') set.add(r.publicId)
    })
    return set
  }, [requestsQuery.data])

  const contactMutation = useMutation({
    mutationFn: (id: string) => sendClientRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
      Alert.alert('Request sent', 'Your request has been sent to the trainer.')
    },
    onError: () => {
      Alert.alert('Error', 'Could not send request. Please try again.')
    },
  })

  const handleContact = useCallback(
    (prof: ProfessionalSummary) => {
      Alert.alert(
        'Send request',
        `Send a collaboration request to ${prof.firstName} ${prof.lastName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send',
            onPress: () => contactMutation.mutate(prof.publicId),
          },
        ],
      )
    },
    [contactMutation],
  )

  const isRefreshing = professionalsQuery.isRefetching
  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['professionals'] })
    queryClient.invalidateQueries({ queryKey: ['my-requests'] })
  }, [queryClient])

  const renderItem = ({ item }: { item: ProfessionalSummary }) => {
    const hasPending = pendingRequestIds.has(item.publicId)
    return (
      <TrainerCard
        professional={item}
        onProfile={() => {
          // TODO: navigate to professional detail
        }}
        onContact={() => handleContact(item)}
        contactDisabled={hasPending || contactMutation.isPending}
        contactLabel={hasPending ? 'Pending' : 'Contact'}
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

      {/* Pill filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pills}
      >
        {SPECIALIZATION_FILTERS.map((f) => {
          const active = f === specFilter
          return (
            <Pressable
              key={f}
              onPress={() => setSpecFilter(f)}
              style={[
                styles.pill,
                { backgroundColor: active ? colors.gold : colors.fill },
              ]}
            >
              <Text
                style={[styles.pillText, { color: active ? '#000' : colors.label2 }]}
              >
                {f}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Results */}
      {professionalsQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : (
        <FlatList
          data={professionalsQuery.data?.items ?? []}
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
    </>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const colors = useTheme()
  const hasTrainer = useAuthStore((s) => s.user?.hasActiveLink ?? false)

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[Type.largeTitle, { color: colors.label }]}>Trainers</Text>
      </View>

      {hasTrainer ? <ActiveCollaborationView /> : <SearchMarketplace />}
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
  // Pill filters
  pills: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 12,
  },
  pill: {
    paddingHorizontal: 16,
    height: 36,
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  pillText: {
    fontSize: 14,
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
