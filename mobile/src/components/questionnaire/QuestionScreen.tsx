import React, { ReactNode } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Badge } from '@/components/ui/Badge'

interface QuestionScreenProps {
  label: string
  helperText?: string | null
  isRequired?: boolean
  children: ReactNode
  /** When true, renders as a card without its own ScrollView (for use inside a parent scroll) */
  card?: boolean
  /** Question counter, e.g. "3/10" */
  counter?: string
}

export function QuestionScreen({ label, helperText, isRequired, children, card, counter }: QuestionScreenProps) {
  const colors = useTheme()

  const content = (
    <>
      {counter && (
        <Text style={[styles.counter, { color: colors.label3 }]}>{counter}</Text>
      )}
      <Text style={[styles.label, { color: colors.label }]}>{label}</Text>
      {helperText && (
        <Text style={[styles.helper, { color: colors.label2 }]}>{helperText}</Text>
      )}
      {isRequired && !card && (
        <Badge label="Required" variant="gold" />
      )}
      <View style={styles.input}>{children}</View>
    </>
  )

  if (card) {
    return (
      <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
        {content}
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {content}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  card: {
    borderRadius: Radius.md,
    padding: 16,
  },
  counter: {
    ...Type.caption1,
    fontWeight: '600',
    marginBottom: 8,
  },
  label: {
    ...Type.title2,
    lineHeight: 30,
    marginBottom: 8,
  },
  helper: {
    ...Type.subheadline,
    lineHeight: 22,
    marginBottom: 8,
  },
  input: {
    marginTop: 12,
  },
})

export default QuestionScreen
