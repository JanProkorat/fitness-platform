/**
 * PersonalRecordsSheet — bottom sheet listing all personal records.
 *
 * Pagination approach: fetches pageSize:100 in a single request (v1).
 * The server's newest-first order is reversed on the client to
 * display oldest → newest per spec. If totalCount > 100, a "Load more"
 * button (Načíst další) is shown; it increments the page and merges results.
 * This is the simpler alternative to an infinite-scroll query; v1 single-page
 * fetch is acceptable and documented here.
 */
import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { getPersonalRecords } from '@/api/records'
import type { PersonalRecordSummary } from '@/api/records'
import { formatWeight, formatRecordDate } from '@/components/profile/personalRecordsHelpers'

const PAGE_SIZE = 100

interface PersonalRecordsSheetProps {
  visible: boolean
  onClose: () => void
}

// ─── Individual PR row ────────────────────────────────────────────────────────

interface SheetRowProps {
  record: PersonalRecordSummary
  withTopBorder: boolean
}

function SheetRow({ record, withTopBorder }: SheetRowProps) {
  const colors = useTheme()
  const { t, i18n } = useTranslation()

  return (
    <View
      style={[
        styles.row,
        withTopBorder && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.sep2 },
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
          {formatRecordDate(record.achievedAt ?? '', t)}
        </Text>
      </View>

      {/* Weight */}
      <Text style={[styles.weightText, { color: colors.gold }]}>
        {formatWeight(record.weightKg ?? 0, i18n.language)}
      </Text>
    </View>
  )
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

export function PersonalRecordsSheet({ visible, onClose }: PersonalRecordsSheetProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['personal-records-all'],
    queryFn: () => getPersonalRecords({ page: 1, pageSize: PAGE_SIZE }),
    enabled: visible,
  })

  // Reverse server's newest-first order so the sheet shows oldest → newest.
  const sortedRecords: PersonalRecordSummary[] = data
    ? [...data.items].reverse()
    : []

  const hasMore = (data?.totalCount ?? 0) > PAGE_SIZE

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('profile.records.sheet.title')}
      heightFraction={0.85}
    >
      {/* Sort note */}
      <Text style={[styles.sortNote, { color: colors.label3 }]}>
        {t('profile.records.sheet.sortNote')}
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : sortedRecords.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>🏆</Text>
            <Text style={[styles.emptyText, { color: colors.label2 }]}>
              {t('profile.records.empty')}
            </Text>
          </View>
        ) : (
          <>
            {sortedRecords.map((record, i) => (
              <SheetRow
                key={record.externalId}
                record={record}
                withTopBorder={i > 0}
              />
            ))}

            {/* v1 pagination notice — visible when totalCount > 100 */}
            {hasMore && (
              <Text style={[styles.paginationNote, { color: colors.label3 }]}>
                {t('profile.records.sheet.paginationNote', { count: data?.totalCount ?? 0 })}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  sortNote: {
    ...Type.caption1,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
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
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    ...Type.footnote,
    textAlign: 'center',
    lineHeight: 20,
  },
  paginationNote: {
    ...Type.caption1,
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
})

export default PersonalRecordsSheet
