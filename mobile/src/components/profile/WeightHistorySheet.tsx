import React from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { WeightHistoryList } from '@/components/profile/WeightHistoryList'
import { useTranslation } from 'react-i18next'
import type { MeasurementDto } from '@/api/measurements'

interface WeightHistorySheetProps {
  visible: boolean
  onClose: () => void
  entries: MeasurementDto[]
}

export function WeightHistorySheet({ visible, onClose, entries }: WeightHistorySheetProps) {
  const { t } = useTranslation()

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('profile.measurementHistory')}
      heightFraction={0.82}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <WeightHistoryList entries={entries} />
      </ScrollView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
})

export default WeightHistorySheet
