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
  /** Bold label prefix, e.g. "Pozn k dni:" / "Pozn k jídlu:" / "Pozn:" */
  label: string
  /** Note body text. */
  children: React.ReactNode
  /** Optional style override for the wrapper. */
  style?: ViewStyle
  /**
   * Override the default gold tint background — e.g. with the meal-kind tint
   * so the meal note reads as an extension of its meal header instead of a
   * competing gold band.
   */
  tint?: string
  /**
   * When set, renders a 4px-wide left accent bar in this color and uses it
   * for the label color too — visually attaches the banner to the section
   * above (e.g. the meal-kind accent on the meal header).
   */
  accentColor?: string
}

/**
 * Gold-tinted note banner used across the Today nutrition card.
 *
 * Visual parity with the `ph-today` prototype (`docs/mobile_prototype.html`):
 *   - `day`        → `padding:10 16; background: gold@8%; bottom sep`
 *   - `meal`       → more prominent, sits as the final row in a meal body
 *   - `ingredient` → subtle, slotted between `ing-row`s
 */
export function NoteBanner({
  variant,
  label,
  children,
  style,
  tint,
  accentColor,
}: NoteBannerProps) {
  const colors = useTheme()

  const variantStyle = styles[variant]
  const defaultBackground = variant === 'day' ? goldAlpha['08'] : goldAlpha['06']
  const background = tint ?? defaultBackground
  const labelColor = accentColor ?? colors.gold

  return (
    <View
      style={[
        styles.base,
        variantStyle,
        { backgroundColor: background, borderColor: colors.sep2 },
        style,
      ]}
    >
      {accentColor ? (
        // Absolutely-positioned bar pinned to the same x-offset as the meal
        // header's accent bar (16px from the card edge — matches the parent
        // NutritionCard's content padding) so the two bars stack vertically.
        <View
          style={[styles.accentBar, { backgroundColor: accentColor }]}
          pointerEvents="none"
        />
      ) : null}
      <Text
        style={[
          styles.text,
          { color: colors.label2 },
          accentColor ? styles.textWithAccent : null,
        ]}
      >
        <Text style={[styles.label, { color: labelColor }]}>{label} </Text>
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
  /**
   * When the banner has an accent bar, push the text right by `bar width
   * (4) + gap (12)` so it lines up with the header title's left edge. The
   * banner's own paddingHorizontal: 16 already places content at the
   * NutritionCard's 16px content edge, so this margin only adds the
   * "bar + gap" offset on top.
   */
  textWithAccent: {
    marginLeft: 16,
  },
  /**
   * Vertical accent bar mirroring the meal header's bar, pinned to the
   * same 16px content-edge offset. `top`/`bottom` insets keep the bar
   * from touching the banner edges so it reads as a contained marker.
   */
  accentBar: {
    position: 'absolute',
    left: 16,
    top: 8,
    bottom: 8,
    width: 4,
    borderRadius: 2,
  },
  label: {
    fontWeight: '600',
  },
})

export default NoteBanner
