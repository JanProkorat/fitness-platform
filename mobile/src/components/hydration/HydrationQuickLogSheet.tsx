/**
 * HydrationQuickLogSheet — bottom sheet for quick-logging water intake.
 *
 * Contains the 5 preset chips (200/300/500/750/1000 ml) and a custom amount
 * text input.  Logging any amount immediately updates the store and closes
 * the sheet.
 *
 * Error paths (per design review error_paths):
 *   - Custom input: non-numeric / 0 / > 5000 ml → shows inline error, no log.
 */

import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { QuickLogChips } from './QuickLogChips'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

const MAX_CUSTOM_ML = 5000

interface HydrationQuickLogSheetProps {
  visible: boolean
  onLog: (amountMl: number) => void
  onDismiss: () => void
}

export function HydrationQuickLogSheet({
  visible,
  onLog,
  onDismiss,
}: HydrationQuickLogSheetProps): React.ReactElement {
  const { t } = useTranslation()
  const colors = useTheme()

  const [customInput, setCustomInput] = useState('')
  const [customError, setCustomError] = useState<string | null>(null)

  const handlePresetLog = useCallback(
    (amountMl: number) => {
      onLog(amountMl)
      setCustomInput('')
      setCustomError(null)
    },
    [onLog],
  )

  const handleCustomChange = useCallback((text: string) => {
    setCustomInput(text)
    setCustomError(null)
  }, [])

  const handleCustomConfirm = useCallback(() => {
    const parsed = parseInt(customInput, 10)
    if (isNaN(parsed) || parsed <= 0) {
      setCustomError(t('hydration.quickLog.errorInvalid'))
      return
    }
    if (parsed > MAX_CUSTOM_ML) {
      setCustomError(t('hydration.quickLog.errorTooLarge', { max: MAX_CUSTOM_ML }))
      return
    }
    onLog(parsed)
    setCustomInput('')
    setCustomError(null)
  }, [customInput, onLog, t])

  const handleDismiss = useCallback(() => {
    setCustomInput('')
    setCustomError(null)
    onDismiss()
  }, [onDismiss])

  const styles = makeStyles(colors)

  return (
    <BottomSheet
      visible={visible}
      onClose={handleDismiss}
      title={t('hydration.quickLog.sheetTitle')}
      fitContent
    >
      <View style={styles.content}>
        {/* Preset chips */}
        <QuickLogChips
          onLog={handlePresetLog}
          onCustomPress={() => {
            // No-op: custom input is inline in this sheet
          }}
        />

        {/* Custom amount row */}
        <View style={styles.customRow}>
          <TextInput
            style={[
              styles.customInput,
              {
                color: colors.label,
                backgroundColor: colors.fill,
                borderColor: customError ? colors.red : colors.sep,
              },
            ]}
            keyboardType="number-pad"
            placeholder={t('hydration.quickLog.customPlaceholder')}
            placeholderTextColor={colors.label3}
            value={customInput}
            onChangeText={handleCustomChange}
            maxLength={5}
            returnKeyType="done"
            onSubmitEditing={handleCustomConfirm}
            accessibilityLabel={t('hydration.quickLog.customPlaceholder')}
          />
          <Text style={[styles.customUnit, { color: colors.label2 }]}>
            {t('hydration.settings.targetSuffix')}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.customConfirmBtn,
              { backgroundColor: colors.gold, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleCustomConfirm}
            accessibilityRole="button"
            accessibilityLabel={t('hydration.quickLog.confirm')}
          >
            <Text style={[styles.customConfirmLabel, { color: colors.onAccent }]}>
              {t('hydration.quickLog.confirm')}
            </Text>
          </Pressable>
        </View>

        {customError !== null && (
          <Text style={[styles.errorText, { color: colors.red }]}>{customError}</Text>
        )}

        <View style={styles.bottomPad} />
      </View>
    </BottomSheet>
  )
}

export default HydrationQuickLogSheet

type Colors = ReturnType<typeof useTheme>

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    content: {
      gap: 12,
      paddingTop: 4,
    },
    customRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
    },
    customInput: {
      flex: 1,
      height: 44,
      borderRadius: Radius.md,
      borderWidth: 1,
      paddingHorizontal: 12,
      ...Type.body,
    },
    customUnit: {
      ...Type.body,
      fontWeight: '600',
    },
    customConfirmBtn: {
      height: 44,
      borderRadius: Radius.md,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    customConfirmLabel: {
      ...Type.subheadline,
      fontWeight: '600',
    },
    errorText: {
      ...Type.footnote,
      paddingHorizontal: 16,
      marginTop: -4,
    },
    bottomPad: {
      height: 8,
    },
  })
}
