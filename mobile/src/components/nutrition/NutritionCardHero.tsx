import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'

interface MacroValue {
  current: number
  target: number
}

export interface NutritionCardHeroProps {
  /** Eyebrow line, e.g. "Výživa · Týden 4" */
  eyebrow: string
  /** Consumed kilocalories so far today. */
  consumedKcal: number
  /** Daily kcal target. */
  targetKcal: number
  /** Secondary subline, e.g. "3 jídla · 11 položek". */
  subline: string
  macros: {
    protein: MacroValue
    carbs: MacroValue
    fat: MacroValue
    fiber: MacroValue
  }
  /** Number of meals already eaten today. */
  mealsEaten: number
  /** Total number of meals planned for today. */
  mealsTotal: number
}

/**
 * Today-screen nutrition hero. Mirrors the training card's dark hero but with
 * a gold-brown gradient (`nutritionHeroStart` → `nutritionHeroEnd`), a kcal
 * headline, three macro chips (B/S/T) and a gold meals-eaten progress ring.
 *
 * See `docs/mobile_prototype.html`, scene `ph-today` (`grad-meal`).
 */
export function NutritionCardHero({
  eyebrow,
  consumedKcal,
  targetKcal,
  subline,
  macros,
  mealsEaten,
  mealsTotal,
}: NutritionCardHeroProps) {
  const colors = useTheme()

  // `${base}38` appends ~22% alpha (0x38 / 0xff ≈ 0.22) to the theme color,
  // matching the prototype's `rgba(…,.22)` tint on the hero macro chips.
  const chipTint = (base: string): string => `${base}38`

  // Animate the kcal counter between states so toggling a meal feels smooth
  // instead of snapping. Target is left un-animated — it rarely changes and
  // the stability helps legibility.
  const animatedKcal = useAnimatedNumber(consumedKcal)

  return (
    <LinearGradient
      colors={[colors.nutritionHeroStart, colors.nutritionHeroEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.content}>
        <Text
          style={[styles.eyebrow, { color: colors.onAccent }]}
          numberOfLines={1}
        >
          {eyebrow.toUpperCase()}
        </Text>
        <Text
          style={[styles.kcal, { color: colors.onAccent }]}
          numberOfLines={1}
        >
          {formatKcal(animatedKcal)} / {formatKcal(targetKcal)} kcal
        </Text>
        {subline ? (
          <Text
            style={[styles.subline, { color: colors.onAccent }]}
            numberOfLines={1}
          >
            {subline}
          </Text>
        ) : null}

        <View style={styles.chipsGrid}>
          <View style={styles.chipsRow}>
            <MacroChip
              label="B"
              value={macros.protein}
              tint={chipTint(colors.macroProtein)}
              unit="g"
            />
            <MacroChip
              label="S"
              value={macros.carbs}
              tint={chipTint(colors.macroCarbs)}
              unit="g"
            />
          </View>
          <View style={styles.chipsRow}>
            <MacroChip
              label="T"
              value={macros.fat}
              tint={chipTint(colors.macroFat)}
              unit="g"
            />
            <MacroChip
              label="Vl"
              value={macros.fiber}
              tint={chipTint(colors.macroFiber)}
              unit="g"
            />
          </View>
        </View>
      </View>

      <View style={styles.ringWrap}>
        <ProgressRing
          current={mealsEaten}
          total={mealsTotal}
          size={56}
          strokeWidth={5}
          color={colors.gold}
          showLabel={false}
        />
        <View style={styles.ringLabelWrap} pointerEvents="none">
          <Text style={[styles.ringLabel, { color: colors.onAccent }]}>
            {mealsEaten}/{mealsTotal}
          </Text>
        </View>
      </View>
    </LinearGradient>
  )
}

interface MacroChipProps {
  label: string
  value: MacroValue
  tint: string
  /** Optional unit suffix appended after the target (e.g. "g" for fiber). */
  unit?: string
}

function MacroChip({ label, value, tint, unit }: MacroChipProps) {
  const colors = useTheme()
  // Tween the current value so toggling a meal transitions smoothly. Display
  // rounded integers — the raw `consumed.*` is a sum of floats, so rendering
  // it directly produced jittery multi-decimal numbers ("23.45678/100") that
  // looked random between taps.
  const animatedCurrent = useAnimatedNumber(value.current)
  // See `formatKcal` — normalize tiny negatives / -0 produced by float drift.
  const roundedCurrent = Math.round(animatedCurrent)
  const safeCurrent = roundedCurrent <= 0 ? 0 : roundedCurrent
  return (
    <View style={[styles.chip, { backgroundColor: tint }]}>
      <Text style={[styles.chipText, { color: colors.onAccent }]}>
        {label} {safeCurrent}/{Math.round(value.target)}
        {unit ?? ''}
      </Text>
    </View>
  )
}

function formatKcal(n: number): string {
  // Normalize signed / near-zero floats: subtracting the exact values we added
  // can leave a tiny residue (e.g. -1.4e-14) that Math.round renders as "-0".
  const rounded = Math.round(n)
  const safe = rounded <= 0 ? 0 : rounded
  // Czech-style thousands separator with a non-breaking space.
  return safe.toLocaleString('cs-CZ').replace(/\s/g, '\u00a0')
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    ...Type.caption1,
    fontWeight: '600',
    letterSpacing: 0.8,
    opacity: 0.6,
    marginBottom: 6,
  },
  kcal: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subline: {
    ...Type.subheadline,
    opacity: 0.7,
    marginTop: 4,
  },
  chipsGrid: {
    marginTop: 10,
    gap: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  ringWrap: {
    marginLeft: 12,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabelWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
})

export default NutritionCardHero
