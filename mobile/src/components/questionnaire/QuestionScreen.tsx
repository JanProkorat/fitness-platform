import React, { ReactNode } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Badge } from '@/components/ui/Badge'

interface QuestionScreenProps {
  label: string
  helperText?: string | null
  isRequired?: boolean
  children: ReactNode
}

export function QuestionScreen({ label, helperText, isRequired, children }: QuestionScreenProps) {
  const colors = useTheme()

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.label, { color: colors.label }]}>{label}</Text>
      {helperText && (
        <Text style={[styles.helper, { color: colors.label2 }]}>{helperText}</Text>
      )}
      {isRequired && (
        <Badge label="Required" variant="gold" />
      )}
      <View style={styles.input}>{children}</View>
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
    marginTop: 20,
  },
})

export default QuestionScreen
