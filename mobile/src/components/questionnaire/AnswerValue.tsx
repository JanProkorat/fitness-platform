import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import type { SubmittedAnswer } from '@/api/questionnaire'

/** Renders the value of a submitted questionnaire answer based on answer type. */
export function AnswerValue({ answer }: { answer: SubmittedAnswer }) {
  const colors = useTheme()

  // multi_select — valueJson is a JSON array of strings
  if (answer.type === 'multi_select' && answer.valueJson) {
    let items: string[] = []
    try { items = JSON.parse(answer.valueJson) } catch {}
    if (items.length > 0) {
      return (
        <View style={styles.chipContainer}>
          {items.map((item, i) => (
            <View key={i} style={[styles.chip, { backgroundColor: colors.fill }]}>
              <Text style={[styles.chipText, { color: colors.label }]}>{item}</Text>
            </View>
          ))}
        </View>
      )
    }
  }

  // scale — show number with optional range context
  if (answer.type === 'scale' && answer.valueNumber != null) {
    let min = 1
    let max = 10
    try {
      if (answer.config) {
        const cfg = JSON.parse(answer.config)
        if (cfg.min != null) min = cfg.min
        if (cfg.max != null) max = cfg.max
      }
    } catch {}
    return (
      <Text style={[styles.answerText, { color: colors.label }]}>
        {answer.valueNumber}{' '}
        <Text style={{ color: colors.label3 }}>/ {max}</Text>
      </Text>
    )
  }

  // number
  if (answer.type === 'number' && answer.valueNumber != null) {
    let unit = ''
    try {
      if (answer.config) {
        const cfg = JSON.parse(answer.config)
        if (cfg.unit) unit = ` ${cfg.unit}`
      }
    } catch {}
    return (
      <Text style={[styles.answerText, { color: colors.label }]}>
        {answer.valueNumber}{unit}
      </Text>
    )
  }

  // text-based (short_text, single_choice, fallback)
  if (answer.valueText) {
    return (
      <Text style={[styles.answerText, { color: colors.label }]}>
        {answer.valueText}
      </Text>
    )
  }

  // No answer provided
  return (
    <Text style={[styles.answerText, { color: colors.label3, fontStyle: 'italic' }]}>
      —
    </Text>
  )
}

const styles = StyleSheet.create({
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  chipText: {
    ...Type.caption1,
    fontWeight: '500',
  },
  answerText: {
    ...Type.body,
  },
})

export default AnswerValue
