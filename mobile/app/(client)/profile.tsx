import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../src/stores/auth'
import { useThemeStore, type ThemePreference } from '@/stores/themeStore'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Separator } from '@/components/ui/Separator'
import { WeightChart } from '@/components/ui/WeightChart'
import { useTranslation } from 'react-i18next'
import { Toast } from '@/lib/toast'
import {
  getMeasurements,
  getMeasurementStats,
  type MeasurementDto,
  type MeasurementStatsResponse,
} from '../../src/api/measurements'
import {
  getComplianceScore,
  getCollaborations,
  endCollaboration,
  type ComplianceScoreResponse,
  type CollaborationDto,
} from '../../src/api/profile'
import { startConversation } from '../../src/api/messages'

const SCREEN_HEIGHT = Dimensions.get('window').height

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
        value: compliance ? `${Math.round(compliance.compliancePercent)}%` : '—',
        sub: compliance ? t('profile.streak', { count: compliance.currentStreak }) : undefined,
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

// ─── End Collaboration Sheet ──────────────────────────────────────────

function EndCollaborationSheet({
  visible,
  professionalName,
  role,
  onClose,
  onConfirm,
  isEnding,
}: {
  visible: boolean
  professionalName: string
  role: string
  onClose: () => void
  onConfirm: () => void
  isEnding: boolean
}) {
  const colors = useTheme()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [mounted, setMounted] = useState(false)
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const overlayOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      setMounted(true)
      translateY.setValue(SCREEN_HEIGHT)
      overlayOpacity.setValue(0)
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
      ]).start()
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }),
      ]).start(() => setMounted(false))
    }
  }, [visible])

  if (!mounted) return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.sheetOverlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { backgroundColor: colors.bg2, paddingBottom: insets.bottom + 60, transform: [{ translateY }] }]}>
        <View style={styles.sheetHandle}>
          <View style={[styles.sheetHandleBar, { backgroundColor: colors.sep }]} />
        </View>

        <View style={styles.sheetContent}>
          <Ionicons name="warning-outline" size={40} color={colors.red} style={{ alignSelf: 'center' }} />
          <Text style={[Type.title2, { color: colors.label, textAlign: 'center', marginTop: 12 }]}>
            {t('profile.endCollabQuestion')}
          </Text>
          <Text style={[Type.subheadline, { color: colors.label2, textAlign: 'center', marginTop: 8 }]}>
            {t('profile.endCollabDesc', { name: professionalName, role })}
          </Text>

          <Pressable
            onPress={onConfirm}
            disabled={isEnding}
            style={[styles.confirmEndBtn, { backgroundColor: colors.red }]}
          >
            <Text style={styles.confirmEndText}>
              {isEnding ? t('profile.ending') : t('profile.endCollabBtn')}
            </Text>
          </Pressable>

          <Pressable onPress={onClose} style={[styles.cancelBtn, { backgroundColor: colors.fill }]}>
            <Text style={[styles.cancelBtnText, { color: colors.label }]}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  )
}

// ─── Answer display helper ───────────────────────────────────────────

// ─── Coach Card ──────────────────────────────────────────────────────

function CoachCard({
  collab,
  isLast,
  onMessage,
  onEnd,
}: {
  collab: CollaborationDto
  isLast: boolean
  onMessage: () => void
  onEnd: () => void
}) {
  const colors = useTheme()
  const { t } = useTranslation()

  return (
    <View
      style={[
        styles.coachCard,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.sep2 },
      ]}
    >
      {/* Coach header row */}
      <View style={styles.collabRow}>
        <Ionicons
          name={collab.role === 'Trainer' ? 'barbell-outline' : 'nutrition-outline'}
          size={20}
          color={colors.gold}
          style={styles.profileRowIcon}
        />
        <View style={{ flex: 1 }}>
          <Text style={[Type.body, { color: colors.label }]}>{collab.professionalName}</Text>
          <Text style={[Type.caption1, { color: colors.label3 }]}>
            {collab.role}{collab.professionalCity ? ` · ${collab.professionalCity}` : ''}
          </Text>
        </View>
        <Pressable
          onPress={onMessage}
          style={[styles.endBtn, { backgroundColor: colors.gold + '18' }]}
        >
          <Ionicons name="chatbubble-outline" size={14} color={colors.gold} />
        </Pressable>
        <Pressable
          onPress={onEnd}
          style={[styles.endBtn, { backgroundColor: colors.red + '18' }]}
        >
          <Text style={[styles.endBtnText, { color: colors.red }]}>{t('profile.endCollab')}</Text>
        </Pressable>
      </View>

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
  const hasTrainer = user?.hasActiveLink ?? false
  const themePreference = useThemeStore((s) => s.preference)
  const setThemePreference = useThemeStore((s) => s.setPreference)
  const insets = useSafeAreaInsets()

  // Collaborations
  const [endTarget, setEndTarget] = useState<CollaborationDto | null>(null)

  const collabQuery = useQuery({
    queryKey: ['collaborations'],
    queryFn: getCollaborations,
    enabled: hasTrainer,
  })

  const endMutation = useMutation({
    mutationFn: endCollaboration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborations'] })
      useAuthStore.getState().refreshProfile()
      setEndTarget(null)
      Toast.show(t('profile.collabEnded'))
    },
    onError: () => {
      Alert.alert(t('common.error'), t('profile.collabEndError'))
    },
  })

  const statsQuery = useQuery({
    queryKey: ['measurement-stats'],
    queryFn: getMeasurementStats,
  })

  const measurementsQuery = useQuery({
    queryKey: ['measurements-recent'],
    queryFn: () => getMeasurements({ pageSize: 8 }),
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
    queryClient.invalidateQueries({ queryKey: ['collaborations'] })
  }, [queryClient])

  const weightEntries = useMemo(() => {
    const items = measurementsQuery.data?.items ?? []
    return items
      .filter((m): m is MeasurementDto & { weightKg: number } => m.weightKg != null)
      .map((m) => ({ date: m.measuredAt, weight: m.weightKg }))
      .reverse()
  }, [measurementsQuery.data])

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')

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

  const collaborations = collabQuery.data ?? []

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
          <Avatar name={fullName || t('profile.client')} size="lg" />
          <Text style={[Type.title1, { color: colors.label, marginTop: 12 }]}>
            {fullName}
          </Text>
          <Text style={[Type.subheadline, { color: colors.label2, marginTop: 2 }]}>
            {user?.email}
          </Text>
          <View style={styles.badges}>
            {complianceQuery.data && complianceQuery.data.currentStreak > 0 && (
              <Badge
                label={`🔥 ${complianceQuery.data.currentStreak}d streak`}
                variant="gold"
              />
            )}
            {complianceQuery.data && (
              <Badge
                label={`${Math.round(complianceQuery.data.compliancePercent)}% compliance`}
                variant="active"
              />
            )}
          </View>
        </View>

        {/* Stats grid */}
        <StatsGrid stats={statsQuery.data} compliance={complianceQuery.data} />

        {/* Weight progress */}
        <View style={styles.section}>
          <SectionHeader title={t('profile.weightProgress')} />
          <WeightChart
            entries={weightEntries}
            currentWeight={statsQuery.data?.latestWeight}
            weightDelta={statsQuery.data?.weightChange30Days}
          />
        </View>

        {/* Coaches section (replaces separate Collaborations + Questionnaire sections) */}
        <View style={styles.section}>
          <SectionHeader title={t('profile.coaches')} />
          {collaborations.length === 0 ? (
            <View style={[styles.groupedList, { backgroundColor: colors.bg2, padding: 20, alignItems: 'center' }]}>
              <Ionicons name="people-outline" size={28} color={colors.label3} />
              <Text style={[Type.subheadline, { color: colors.label3, marginTop: 8, textAlign: 'center' }]}>
                {t('profile.noCoaches')}
              </Text>
            </View>
          ) : (
            <View style={[styles.groupedList, { backgroundColor: colors.bg2 }]}>
              {collaborations.map((collab, idx) => (
                <CoachCard
                  key={collab.publicId}
                  collab={collab}
                  isLast={idx === collaborations.length - 1}
                  onMessage={() => {
                    startConversation(collab.professionalPublicId).then((conv) => {
                      router.push(`/(client)/messages/${conv.id}` as never)
                    })
                  }}
                  onEnd={() => setEndTarget(collab)}
                />
              ))}
            </View>
          )}
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

      {/* End collaboration confirmation sheet */}
      <EndCollaborationSheet
        visible={endTarget !== null}
        professionalName={endTarget?.professionalName ?? ''}
        role={endTarget?.role ?? ''}
        onClose={() => setEndTarget(null)}
        onConfirm={() => {
          if (endTarget) endMutation.mutate(endTarget.publicId)
        }}
        isEnding={endMutation.isPending}
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
  collabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  endBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  endBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Coach card
  coachCard: {
    paddingBottom: 4,
  },
  // Sheet
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetHandle: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetContent: {
    padding: 24,
  },
  confirmEndBtn: {
    paddingVertical: 14,
    borderRadius: Radius.sm,
    alignItems: 'center',
    marginTop: 24,
  },
  confirmEndText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 14,
    borderRadius: Radius.sm,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '500',
  },
})
