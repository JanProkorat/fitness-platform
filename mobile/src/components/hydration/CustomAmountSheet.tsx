/**
 * CustomAmountSheet — bottom-sheet with a numeric input for a custom water
 * intake amount (1–5000 ml).
 *
 * Validation: rejects zero, negative, NaN, and values > 5000 ml.
 * No MMKV write occurs for invalid entries.
 */

import React, { useState, useCallback } from 'react'
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

const MAX_AMOUNT_ML = 5000

interface CustomAmountSheetProps {
  visible: boolean
  onConfirm: (amountMl: number) => void
  onDismiss: () => void
}

export function CustomAmountSheet({
  visible,
  onConfirm,
  onDismiss,
}: CustomAmountSheetProps): React.ReactElement {
  const { t } = useTranslation()
  const colors = useTheme()
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleInputChange = useCallback((text: string) => {
    setInputValue(text)
    setError(null)
  }, [])

  const handleConfirm = useCallback(() => {
    const parsed = parseInt(inputValue, 10)
    if (isNaN(parsed) || parsed <= 0) {
      setError(t('hydration.quickLog.errorInvalid'))
      return
    }
    if (parsed > MAX_AMOUNT_ML) {
      setError(t('hydration.quickLog.errorTooLarge', { max: MAX_AMOUNT_ML }))
      return
    }
    setInputValue('')
    setError(null)
    onConfirm(parsed)
  }, [inputValue, onConfirm, t])

  const handleDismiss = useCallback(() => {
    setInputValue('')
    setError(null)
    onDismiss()
  }, [onDismiss])

  const styles = makeStyles(colors)

  return (
    <BottomSheet
      visible={visible}
      onClose={handleDismiss}
      title={t('hydration.quickLog.customSheetTitle')}
      fitContent
    >
      <View style={styles.content}>
        {/* Input row */}
        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.label,
                backgroundColor: colors.fill,
                borderColor: error ? colors.red : colors.sep,
              },
            ]}
            keyboardType="number-pad"
            placeholder={t('hydration.quickLog.customPlaceholder')}
            placeholderTextColor={colors.label3}
            value={inputValue}
            onChangeText={handleInputChange}
            maxLength={5}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
            accessibilityLabel={t('hydration.quickLog.customPlaceholder')}
          />
          <Text style={[styles.unit, { color: colors.label2 }]}>
            {t('hydration.settings.targetSuffix')}
          </Text>
        </View>

        {/* Validation error */}
        {error !== null && (
          <Text style={[styles.errorText, { color: colors.red }]}>{error}</Text>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.cancelBtn,
              { borderColor: colors.sep, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={handleDismiss}
            accessibilityRole="button"
          >
            <Text style={[styles.cancelLabel, { color: colors.label2 }]}>
              {t('hydration.quickLog.cancel')}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.confirmBtn,
              { backgroundColor: colors.gold, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleConfirm}
            accessibilityRole="button"
          >
            <Text style={[styles.confirmLabel, { color: colors.onAccent }]}>
              {t('hydration.quickLog.confirm')}
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  )
}

export default CustomAmountSheet

type Colors = ReturnType<typeof useTheme>

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: 16,
      paddingTop: 8,
      gap: 12,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    input: {
      flex: 1,
      height: 48,
      borderRadius: Radius.md,
      borderWidth: 1,
      paddingHorizontal: 14,
      ...Type.body,
    },
    unit: {
      ...Type.body,
      fontWeight: '600',
      minWidth: 24,
    },
    errorText: {
      ...Type.footnote,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    cancelBtn: {
      flex: 1,
      height: 46,
      borderRadius: Radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelLabel: {
      ...Type.subheadline,
      fontWeight: '600',
    },
    confirmBtn: {
      flex: 2,
      height: 46,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmLabel: {
      ...Type.subheadline,
      fontWeight: '600',
    },
  })
}
