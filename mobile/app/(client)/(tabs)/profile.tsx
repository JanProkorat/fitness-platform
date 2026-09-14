import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore, type ThemePreference } from '@/stores/themeStore'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { WeightBarChart } from '@/components/ui/WeightBarChart'
import { WeightInputSheet } from '@/components/profile/WeightInputSheet'
import { WeightHistorySheet } from '@/components/profile/WeightHistorySheet'
import { PersonalRecordsCard } from '@/components/profile/PersonalRecordsCard'
import { HydrationProfileSection } from '@/components/hydration/HydrationProfileSection'
import { useTranslation } from 'react-i18next'
import {
  getMeasurements,
  getMeasurementStats,
  type MeasurementDto,
  type MeasurementStatsResponse,
} from '@/api/measurements'
import {
  getComplianceScore,
  generateAvatarUploadUrl,
  confirmAvatar,
  type ComplianceScoreResponse,
} from '@/api/profile'
import { Toast } from '@/lib/toast'

// ─── Stats Grid ───────────────────────────────────────────────────────

function StatsGrid({
  stats,
  compliance,
}: {
  stats: MeasurementStatsResponse | undefined
  compliance: ComplianceScoreResponse | undefined
}) {
  const colors = useTheme()
  const { t } = useTranslation()

  const items = useMemo(
    () => [
      {
        label: t('profile.currentWeight'),
        value: stats?.latestWeight != null ? `${stats.latestWeight.toFixed(1)} kg` : '—',
        sub:
          stats?.weightChange30Days != null && stats.weightChange30Days !== 0
            ? `${stats.weightChange30Days > 0 ? '+' : ''}${stats.weightChange30Days.toFixed(1)} kg`
            : undefined,
        subColor:
          stats?.weightChange30Days != null
            ? stats.weightChange30Days <= 0
              ? colors.green
              : colors.red
            : undefined,
      },
      {
        label: t('profile.measurements'),
        value: String(stats?.totalCount ?? 0),
        sub: t('profile.totalRecords'),
      },
      {
        label: t('profile.compliance'),
        value: compliance ? `${Math.round(compliance.compliancePercent ?? 0)}%` : '—',
        sub: compliance ? t('profile.streak', { count: compliance.currentStreak ?? 0 }) : undefined,
        subColor: colors.gold,
      },
      {
        label: t('profile.mealsLogged'),
        value: compliance ? `${compliance.mealsLogged}` : '—',
        sub: compliance ? t('profile.planned', { count: compliance.mealsPlanned }) : undefined,
      },
    ],
    [stats, compliance, colors, t],
  )

  return (
    <View style={styles.statsGrid}>
      {items.map((item) => (
        <View key={item.label} style={[styles.statCell, { backgroundColor: colors.bg2 }]}>
          <Text style={[styles.statValue, { color: colors.label }]}>{item.value}</Text>
          {item.sub && (
            <Text style={[styles.statSub, { color: item.subColor ?? colors.label3 }]}>
              {item.sub}
            </Text>
          )}
          <Text style={[styles.statLabel, { color: colors.label2 }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  )
}

// ─── Profile Row ──────────────────────────────────────────────────────

function ProfileRow({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: string
}) {
  const colors = useTheme()

  return (
    <View style={[styles.profileRow, { borderBottomColor: colors.sep2 }]}>
      {icon && (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={colors.label3}
          style={styles.profileRowIcon}
        />
      )}
      <Text style={[Type.body, { color: colors.label2, flex: 1 }]}>{label}</Text>
      <Text style={[Type.body, { color: colors.label }]}>{value}</Text>
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function ProfileScreen() {
  const colors = useTheme()
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const hasTrainer = user?.hasActiveLink ?? false
  const [weightSheetOpen, setWeightSheetOpen] = useState(false)
  const [historySheetOpen, setHistorySheetOpen] = useState(false)
  const themePreference = useThemeStore((s) => s.preference)
  const setThemePreference = useThemeStore((s) => s.setPreference)
  const insets = useSafeAreaInsets()

  const statsQuery = useQuery({
    queryKey: ['measurement-stats'],
    queryFn: getMeasurementStats,
  })

  const measurementsQuery = useQuery({
    queryKey: ['measurements-recent'],
    queryFn: () => getMeasurements({ pageSize: 20 }),
  })

  const complianceQuery = useQuery({
    queryKey: ['compliance-score'],
    queryFn: () => getComplianceScore(),
    enabled: hasTrainer,
  })

  const isRefreshing =
    statsQuery.isRefetching || measurementsQuery.isRefetching || complianceQuery.isRefetching

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['measurement-stats'] })
    queryClient.invalidateQueries({ queryKey: ['measurements-recent'] })
    queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
  }, [queryClient])

  const weightEntries = useMemo(() => {
    const items = measurementsQuery.data?.items ?? []
    return items
      .filter((m): m is MeasurementDto & { weightKg: number; measuredAt: string } => m.weightKg != null && m.measuredAt != null)
      .map((m) => ({ date: m.measuredAt, weight: m.weightKg }))
      .reverse()
  }, [measurementsQuery.data])

  // Delta between the latest measurement and the one before it
  const latestWeightDelta = useMemo(() => {
    if (weightEntries.length < 2) return null
    const latest = weightEntries[weightEntries.length - 1].weight
    const previous = weightEntries[weightEntries.length - 2].weight
    return latest - previous
  }, [weightEntries])

  const handleWeightSaved = useCallback(() => {
    setWeightSheetOpen(false)
    onRefresh()
  }, [onRefresh])

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')

  const handleRequestAvatarUpload = useCallback(
    async ({ contentType, sizeBytes }: { contentType: string; sizeBytes: number }) => {
      const result = await generateAvatarUploadUrl({ contentType, sizeBytes })
      return {
        uploadUrl: result.uploadUrl ?? '',
        blobUrl: result.blobUrl ?? '',
      }
    },
    [],
  )

  const handleAvatarUploaded = useCallback(
    async (blobUrl: string) => {
      try {
        await confirmAvatar(blobUrl)
        // Refresh the user profile in the auth store so the new avatar is reflected everywhere.
        await refreshProfile()
        queryClient.invalidateQueries({ queryKey: ['user-profile'] })
        Toast.show(t('avatar.uploadSuccess'))
      } catch {
        Toast.show(t('avatar.uploadError'))
      }
    },
    [refreshProfile, queryClient, t],
  )

  const handleLogout = useCallback(() => {
    Alert.alert(t('profile.signOut'), t('profile.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.signOut'),
        style: 'destructive',
        onPress: () => {
          logout()
          router.replace('/(auth)/login')
        },
      },
    ])
  }, [logout, router, t])

  const isLoading = statsQuery.isLoading || measurementsQuery.isLoading

  if (isLoading) {
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
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Avatar
            name={fullName || t('profile.client')}
            size="xl"
            imageUrl={user?.avatarBlobUrl}
            editable
            onRequestUpload={handleRequestAvatarUpload}
            onUploaded={handleAvatarUploaded}
          />
          <Text style={[Type.title1, { color: colors.label, marginTop: 12 }]}>
            {fullName}
          </Text>
          <Text style={[Type.subheadline, { color: colors.label2, marginTop: 2 }]}>
            {user?.email}
          </Text>
          <View style={styles.badges}>
            {complianceQuery.data && (complianceQuery.data.currentStreak ?? 0) > 0 && (
              <Badge
                label={`🔥 ${complianceQuery.data.currentStreak ?? 0}d streak`}
                variant="gold"
              />
            )}
            {complianceQuery.data && (
              <Badge
                label={`${Math.round(complianceQuery.data.compliancePercent ?? 0)}% compliance`}
                variant="active"
              />
            )}
          </View>
        </View>

        {/* Stats grid */}
        <StatsGrid stats={statsQuery.data} compliance={complianceQuery.data} />

        {/* Weight progress */}
        <View style={styles.section}>
          <SectionHeader
            title={t('profile.weightProgress')}
            actionLabel={t('profile.recordWeightShort')}
            onActionPress={() => setWeightSheetOpen(true)}
          />
          <WeightBarChart
            entries={weightEntries}
            currentWeight={statsQuery.data?.latestWeight}
            weightDelta={latestWeightDelta}
            targetWeight={statsQuery.data?.targetWeightKg}
            onViewHistory={() => setHistorySheetOpen(true)}
            entryCount={statsQuery.data?.totalCount ?? 0}
          />
        </View>

        {/* Personal records */}
        <PersonalRecordsCard />

        {/* Photos section */}
        <View style={styles.section}>
          <SectionHeader title={t('profilePhotos.title')} />
          <Pressable
            onPress={() => router.push('/(client)/profile-photos')}
            style={({ pressed }) => [
              styles.photosRow,
              { backgroundColor: colors.bg2, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('profilePhotos.openA11y')}
          >
            <Ionicons name="images-outline" size={20} color={colors.label3} style={styles.profileRowIcon} />
            <Text style={[Type.body, { color: colors.label, flex: 1 }]}>
              {t('profilePhotos.title')}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.label3} />
          </Pressable>
        </View>

        {/* Hydration section — sits between Photos and Profile rows */}
        <View style={styles.section}>
          <HydrationProfileSection />
        </View>

        {/* Profile section */}
        <View style={styles.section}>
          <SectionHeader title={t('profile.title')} />
          <View style={[styles.groupedList, { backgroundColor: colors.bg2 }]}>
            <ProfileRow label={t('profile.name')} value={fullName || '—'} icon="person-outline" />
            <ProfileRow label={t('profile.email')} value={user?.email ?? '—'} icon="mail-outline" />
            <ProfileRow label={t('profile.role')} value={user?.roles?.[0] ?? t('profile.client')} icon="shield-outline" />
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <SectionHeader title={t('profile.appearance')} />
          <View style={[styles.groupedList, { backgroundColor: colors.bg2 }]}>
            {(['system', 'light', 'dark'] as const).map((pref) => {
              const labels: Record<ThemePreference, { label: string; icon: string }> = {
                system: { label: t('profile.system'), icon: 'phone-portrait-outline' },
                light: { label: t('profile.light'), icon: 'sunny-outline' },
                dark: { label: t('profile.dark'), icon: 'moon-outline' },
              }
              const { label, icon } = labels[pref]
              const selected = themePreference === pref
              return (
                <Pressable
                  key={pref}
                  onPress={() => setThemePreference(pref)}
                  style={[styles.profileRow, { borderBottomColor: colors.sep2 }]}
                >
                  <Ionicons
                    name={icon as keyof typeof Ionicons.glyphMap}
                    size={20}
                    color={selected ? colors.gold : colors.label3}
                    style={styles.profileRowIcon}
                  />
                  <Text style={[Type.body, { color: colors.label, flex: 1 }]}>{label}</Text>
                  {selected && (
                    <Ionicons name="checkmark" size={20} color={colors.gold} />
                  )}
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* Sign out */}
        <View style={styles.section}>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutRow,
              { backgroundColor: colors.bg2, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.red} />
            <Text style={[Type.body, { color: colors.red, marginLeft: 12 }]}>
              {t('profile.signOut')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <WeightInputSheet
        visible={weightSheetOpen}
        onClose={() => setWeightSheetOpen(false)}
        onSaved={handleWeightSaved}
        defaultWeight={statsQuery.data?.latestWeight ?? undefined}
      />

      <WeightHistorySheet
        visible={historySheetOpen}
        onClose={() => setHistorySheetOpen(false)}
        entries={measurementsQuery.data?.items ?? []}
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
  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
  },
  statCell: {
    width: '47%',
    flexGrow: 1,
    borderRadius: Radius.md,
    padding: 14,
  },
  statValue: {
    ...Type.title2,
  },
  statSub: {
    ...Type.caption1,
    marginTop: 2,
  },
  statLabel: {
    ...Type.caption1,
    marginTop: 4,
  },
  section: {
    marginTop: 24,
  },
  groupedList: {
    marginHorizontal: 16,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  profileRowIcon: {
    marginRight: 12,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: Radius.md,
  },
  photosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: Radius.md,
  },
})
