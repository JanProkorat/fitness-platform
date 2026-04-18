import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PersonalRecordsSheet } from '@/components/profile/PersonalRecordsSheet'
import { getPersonalRecords } from '@/api/records'
import type { PersonalRecordSummary } from '@/api/records'
import { formatWeight, formatRecordDate } from '@/components/profile/personalRecordsHelpers'

// ─── PR row ───────────────────────────────────────────────────────────────────

interface PrRowProps {
  record: PersonalRecordSummary
  withTopBorder: boolean
  onPress: () => void
}

function PrRow({ record, withTopBorder, onPress }: PrRowProps) {
  const colors = useTheme()
  const { t, i18n } = useTranslation()

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        withTopBorder && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.sep2 },
        pressed && { opacity: 0.7 },
      ]}
    >
      {/* Trophy icon */}
      <View style={[styles.trophyWrap, { backgroundColor: colors.goldBg }]}>
        <Text style={styles.trophyEmoji}>🏆</Text>
      </View>

      {/* Name + date */}
      <View style={styles.nameWrap}>
        <Text style={[styles.exerciseName, { color: colors.label }]} numberOfLines={1}>
          {record.exerciseName}
        </Text>
        <Text style={[styles.dateText, { color: colors.label3 }]}>
          {formatRecordDate(record.achievedAt, t)}
        </Text>
      </View>

      {/* Weight */}
      <Text style={[styles.weightText, { color: colors.gold }]}>
        {formatWeight(record.weightKg, i18n.language)}
      </Text>
    </Pressable>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PrSkeleton() {
  const colors = useTheme()
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1].map((i) => (
        <View
          key={i}
          style={[
            styles.skeletonRow,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.sep2 },
          ]}
        >
          <View style={[styles.skeletonIcon, { backgroundColor: colors.fill }]} />
          <View style={styles.skeletonText}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.fill, width: '60%' }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.fill, width: '30%', marginTop: 6 }]} />
          </View>
          <View style={[styles.skeletonBadge, { backgroundColor: colors.fill }]} />
        </View>
      ))}
    </View>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function PrEmptyState() {
  const colors = useTheme()
  const { t } = useTranslation()
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>🏆</Text>
      <Text style={[styles.emptyText, { color: colors.label2 }]}>
        {t('profile.records.empty')}
      </Text>
    </View>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

export function PersonalRecordsCard() {
  const colors = useTheme()
  const { t } = useTranslation()
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['personal-records-latest'],
    queryFn: () => getPersonalRecords({ page: 1, pageSize: 2 }),
  })

  const records = data?.items ?? []
  const totalCount = data?.totalCount ?? 0

  return (
    <>
      <View style={styles.section}>
        <SectionHeader
          title={t('profile.records.title')}
          actionLabel={t('profile.records.viewAll')}
          onActionPress={() => setSheetOpen(true)}
        />

        <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
          {isLoading ? (
            <PrSkeleton />
          ) : records.length === 0 ? (
            <PrEmptyState />
          ) : (
            <>
              {records.map((record, i) => (
                <PrRow
                  key={record.externalId}
                  record={record}
                  withTopBorder={i > 0}
                  onPress={() => setSheetOpen(true)}
                />
              ))}

              {/* "View all records" link row */}
              <Pressable
                onPress={() => setSheetOpen(true)}
                style={({ pressed }) => [
                  styles.viewAllRow,
                  { borderTopColor: colors.sep2, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons name="arrow-up-outline" size={18} color={colors.label2} />
                <Text style={[styles.viewAllText, { color: colors.label }]}>
                  {t('profile.records.viewAll')}
                </Text>
                <Text style={[styles.viewAllCount, { color: colors.label3 }]}>
                  {totalCount}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.label3} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      <PersonalRecordsSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  trophyWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  trophyEmoji: {
    fontSize: 16,
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  dateText: {
    fontSize: 12,
    marginTop: 2,
  },
  weightText: {
    fontSize: 16,
    fontWeight: '700',
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  viewAllText: {
    ...Type.subheadline,
    fontWeight: '500',
    flex: 1,
  },
  viewAllCount: {
    fontSize: 13,
  },
  // Skeleton
  skeletonWrap: {},
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  skeletonIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    flexShrink: 0,
  },
  skeletonText: {
    flex: 1,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
  skeletonBadge: {
    width: 60,
    height: 16,
    borderRadius: 6,
  },
  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: 10,
  },
  emptyText: {
    ...Type.footnote,
    textAlign: 'center',
    lineHeight: 20,
  },
})

export default PersonalRecordsCard
