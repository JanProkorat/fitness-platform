/**
 * HydrationProfileSection — "Pitný režim" section in the Profile screen.
 *
 * States:
 *   disabled  → shows hint text "Zapnutím začnete sledovat..."
 *   enabled   → shows today's progress bar + 7-day history strip + Edit button
 *
 * Turning the switch ON for the first time opens the setup window.
 * Subsequent ON toggles (after it was turned OFF) also open the setup window.
 * Turning switch OFF persists enabled=false; the home card hides on next render.
 *
 * The "Upravit nastavení" row reopens the setup sheet when already enabled.
 *
 * Error path (AC):
 *   Switch toggled OFF then ON — re-opens setup sheet (matches prototype toggleHydration).
 */

import React, { useState, useCallback } from 'react'
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { HydrationProgressBar } from './HydrationProgressBar'
import { HydrationHistoryStrip } from './HydrationHistoryStrip'
import { HydrationSetupSheet } from './HydrationSetupSheet'
import {
  useHydrationStore,
  selectTodayTotalMl,
} from '@/stores/hydrationStore'
import { Type, interFamily } from '@/constants/typography'
import { Radius } from '@/constants/radius'

export function HydrationProfileSection(): React.ReactElement {
  const { t } = useTranslation()
  const colors = useTheme()

  const log = useHydrationStore((s) => s.log)
  const targetMl = useHydrationStore((s) => s.targetMl)
  const enabled = useHydrationStore((s) => s.enabled)
  const setEnabled = useHydrationStore((s) => s.setEnabled)

  const todayTotal = selectTodayTotalMl(log)

  const [setupSheetVisible, setSetupSheetVisible] = useState(false)

  const handleToggle = useCallback(
    (value: boolean) => {
      if (value) {
        // Turning ON — always open the setup sheet (matches prototype toggleHydration).
        // enabled flag is set to true after save in handleSetupSaved.
        setSetupSheetVisible(true)
      } else {
        setEnabled(false)
      }
    },
    [setEnabled],
  )

  const handleSetupSaved = useCallback(() => {
    setSetupSheetVisible(false)
    // Ensure enabled is persisted as true after save.
    setEnabled(true)
  }, [setEnabled])

  const handleSetupDismiss = useCallback(() => {
    setSetupSheetVisible(false)
    // If the user cancelled setup while the switch was toggled (not yet saved),
    // revert the switch to its previous state (which is still false because
    // setEnabled(true) only fires in handleSetupSaved).
  }, [])

  const styles = makeStyles(colors)

  return (
    <>
      <View style={styles.sectionHeader}>
        <SectionHeader title={t('hydration.profile.sectionTitle')} />
      </View>
      <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
        {/* Master switch row */}
        <View style={styles.switchRow}>
          <View style={[styles.switchIcon, { backgroundColor: colors.fill }]}>
            <Ionicons name="water-outline" size={18} color={colors.blue} />
          </View>
          <View style={styles.switchLabelWrap}>
            <Text style={[styles.switchLabel, { color: colors.label }]}>
              {t('hydration.profile.switchLabel')}
            </Text>
            <Text style={[styles.switchSub, { color: colors.label3 }]}>
              {t('hydration.profile.switchSub')}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            trackColor={{ false: colors.sep, true: colors.gold }}
            thumbColor={colors.bg}
            accessibilityLabel={t('hydration.profile.switchLabel')}
            accessibilityRole="switch"
          />
        </View>

        {/* Disabled hint */}
        {!enabled && (
          <View style={[styles.disabledHint, { borderTopColor: colors.sep2 }]}>
            <Text style={[styles.disabledHintText, { color: colors.label3 }]}>
              {t('hydration.profile.disabledHint')}
            </Text>
          </View>
        )}

        {/* Enabled content */}
        {enabled && (
          <View style={[styles.enabledContent, { borderTopColor: colors.sep2 }]}>
            {/* Progress */}
            <View style={styles.progressHeader}>
              <Text style={[styles.progressValue, { color: colors.label }]}>
                {todayTotal}
                <Text style={[styles.progressTarget, { color: colors.label2 }]}>
                  {' '}{t('hydration.profile.progressOf', { target: targetMl })}
                </Text>
              </Text>
              <Text style={[styles.progressToday, { color: colors.label3 }]}>
                {t('hydration.profile.todayLabel')}
              </Text>
            </View>
            <View style={styles.barWrap}>
              <HydrationProgressBar currentMl={todayTotal} targetMl={targetMl} barHeight={8} />
            </View>

            {/* 7-day history */}
            <Text style={[styles.historyLabel, { color: colors.label2 }]}>
              {t('hydration.profile.last7DaysLabel')}
            </Text>
            <HydrationHistoryStrip log={log} targetMl={targetMl} />

            {/* Edit button */}
            <Pressable
              style={({ pressed }) => [
                styles.editRow,
                { backgroundColor: colors.fill, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => setSetupSheetVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t('hydration.profile.editA11y')}
            >
              <Ionicons name="create-outline" size={18} color={colors.label2} />
              <Text style={[styles.editLabel, { color: colors.label, flex: 1 }]}>
                {t('hydration.profile.editLabel')}
              </Text>
              <Text style={[styles.editSub, { color: colors.label3 }]}>
                {t('hydration.profile.editSub')}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.label3} />
            </Pressable>
          </View>
        )}
      </View>

      <HydrationSetupSheet
        visible={setupSheetVisible}
        onDismiss={handleSetupDismiss}
        onSaved={handleSetupSaved}
      />
    </>
  )
}

export default HydrationProfileSection

type Colors = ReturnType<typeof useTheme>

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    sectionHeader: {
      // Margin handled by parent profile.tsx section wrapper
    },
    card: {
      marginHorizontal: 16,
      borderRadius: Radius.lg,
      overflow: 'hidden',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    switchIcon: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    switchLabelWrap: {
      flex: 1,
    },
    switchLabel: {
      ...Type.body,
    },
    switchSub: {
      ...Type.caption1,
      marginTop: 1,
    },
    disabledHint: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 10,
    },
    disabledHintText: {
      ...Type.footnote,
    },
    enabledContent: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 4,
      gap: 12,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    progressValue: {
      fontFamily: interFamily('700'),
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: -0.4,
    },
    progressTarget: {
      ...Type.subheadline,
      fontWeight: '600',
    },
    progressToday: {
      ...Type.footnote,
    },
    barWrap: {
      marginTop: -4,
    },
    historyLabel: {
      ...Type.caption1,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 4,
    },
    editRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: Radius.md,
      marginBottom: 10,
      marginTop: 4,
    },
    editLabel: {
      ...Type.body,
    },
    editSub: {
      ...Type.footnote,
    },
  })
}
