import React from 'react'
import { View, Text, StyleSheet, type ViewStyle } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { goldAlpha } from '@/constants/colors'

export type NoteBannerVariant = 'day' | 'meal' | 'ingredient'

interface NoteBannerProps {
  /**
   * Context of the note:
   *  - `day`         — daily nutritionist note (full-width, sits under the hero)
   *  - `meal`        — meal-level note (inside an expanded meal body)
   *  - `ingredient`  — per-ingredient note (inside an expanded meal body)
   */
  variant: NoteBannerVariant
  /** Bold gold label prefix, e.g. "Pozn k dni:" / "Pozn k jídlu:" / "Pozn:" */
  label: string
  /** Note body text. */
  children: React.ReactNode
  /** Optional style override for the wrapper. */
  style?: ViewStyle
}

/**
 * Gold-tinted note banner used across the Today nutrition card.
 *
 * Visual parity with the `ph-today` prototype (`docs/mobile_prototype.html`):
 *   - `day`        → `padding:10 16; background: gold@8%; bottom sep`
 *   - `meal`       → more prominent, sits as the final row in a meal body
 *   - `ingredient` → subtle, slotted between `ing-row`s
 */
export function NoteBanner({ variant, label, children, style }: NoteBannerProps) {
  const colors = useTheme()

  const variantStyle = styles[variant]
  const background =
    variant === 'day' ? goldAlpha['08'] : goldAlpha['06']

  return (
    <View
      style={[
        styles.base,
        variantStyle,
        { backgroundColor: background, borderColor: colors.sep2 },
        style,
      ]}
    >
      <Text style={[styles.text, { color: colors.label2 }]}>
        <Text style={[styles.label, { color: colors.gold }]}>{label} </Text>
        {children}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    // Shared
  },
  day: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  meal: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ingredient: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginTop: -6,
  },
  text: {
    ...Type.caption1,
    lineHeight: 17,
  },
  label: {
    fontWeight: '600',
  },
})

export default NoteBanner
