import { useState, useEffect, useMemo } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import { useTranslation } from 'react-i18next'
import { RadioGroup } from './RadioGroup'
import { ScaleInput } from './ScaleInput'
import { Question, QuestionConfig, AnswerMap } from './questionnaire-types'

// ─── Single Choice custom input ──────────────────────────────────────

function SingleChoiceCustomInput({
  isCustomSelected,
  customValue,
  onSubmit,
}: {
  isCustomSelected: boolean
  customValue: string
  onSubmit: (text: string) => void
}) {
  const colors = useTheme()
  const { t } = useTranslation()
  const [text, setText] = useState(customValue)

  useEffect(() => {
    if (!isCustomSelected) setText('')
  }, [isCustomSelected])

  const handleAdd = () => {
    const trimmed = text.trim()
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <View style={[styles.customAddRow, { borderColor: isCustomSelected ? colors.gold : colors.sep2, backgroundColor: isCustomSelected ? 'rgba(201,168,76,0.06)' : colors.bg2 }]}>
      <TextInput
        style={[styles.customAddInput, { color: colors.label }]}
        placeholder={t('questionnaire.customAnswer')}
        placeholderTextColor={colors.label3}
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleAdd}
        returnKeyType="done"
      />
      <Pressable
        onPress={handleAdd}
        disabled={!text.trim()}
        style={({ pressed }) => [
          styles.customAddBtn,
          {
            backgroundColor: text.trim() ? colors.gold : colors.fill,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons name="add" size={18} color={text.trim() ? '#fff' : colors.label3} />
      </Pressable>
    </View>
  )
}

// ─── Multi Select with custom add ────────────────────────────────────

function MultiSelectInput({
  items,
  selected,
  onToggle,
  onAddCustom,
  allowCustom,
}: {
  items: string[]
  selected: string[]
  onToggle: (choice: string) => void
  onAddCustom: (custom: string) => void
  allowCustom?: boolean
}) {
  const colors = useTheme()
  const { t } = useTranslation()
  const [customText, setCustomText] = useState('')

  const handleAdd = () => {
    const trimmed = customText.trim()
    if (trimmed) {
      onAddCustom(trimmed)
      setCustomText('')
    }
  }

  return (
    <View style={styles.multiWrap}>
      {items.map((choice) => {
        const isSelected = selected.includes(choice)
        return (
          <Pressable
            key={choice}
            onPress={() => onToggle(choice)}
            style={[
              styles.multiPill,
              {
                backgroundColor: isSelected ? 'rgba(201,168,76,0.12)' : colors.fill,
                borderColor: isSelected ? colors.gold : 'transparent',
              },
            ]}
          >
            <Text style={[styles.multiPillText, { color: isSelected ? colors.gold : colors.label2, fontWeight: isSelected ? '600' : '500' }]}>
              {choice}
            </Text>
          </Pressable>
        )
      })}
      {allowCustom && (
        <View style={[styles.customAddRow, { borderColor: colors.sep2, backgroundColor: colors.bg2 }]}>
          <TextInput
            style={[styles.customAddInput, { color: colors.label }]}
            placeholder={t('questionnaire.customAnswer')}
            placeholderTextColor={colors.label3}
            value={customText}
            onChangeText={setCustomText}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <Pressable
            onPress={handleAdd}
            disabled={!customText.trim()}
            style={({ pressed }) => [
              styles.customAddBtn,
              {
                backgroundColor: customText.trim() ? colors.gold : colors.fill,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name="add" size={18} color={customText.trim() ? '#fff' : colors.label3} />
          </Pressable>
        </View>
      )}
    </View>
  )
}

// ─── Question Input ──────────────────────────────────────────────────

export function QuestionInput({
  question,
  answer,
  onAnswer,
}: {
  question: Question
  answer: AnswerMap[string] | undefined
  onAnswer: (value: Partial<AnswerMap[string]>) => void
}) {
  const colors = useTheme()
  const { t } = useTranslation()

  const config: QuestionConfig = useMemo(() => {
    if (!question.config) return {}
    try { return JSON.parse(question.config) as QuestionConfig } catch { return {} }
  }, [question.config])

  switch (question.type) {
    case 'short_text':
      return (
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.bg2, borderColor: colors.sep2, color: colors.label }]}
          placeholder={config.placeholder ?? '...'}
          placeholderTextColor={colors.label3}
          value={answer?.valueText ?? ''}
          onChangeText={(text) => onAnswer({ valueText: text })}
          autoCapitalize="sentences"
          multiline
        />
      )

    case 'number':
      return (
        <View style={[styles.numberWrap, { backgroundColor: colors.bg2, borderColor: colors.sep2 }]}>
          <TextInput
            style={[styles.numberInput, { color: colors.label }]}
            placeholder={config.placeholder ?? '0'}
            placeholderTextColor={colors.label3}
            value={answer?.valueNumber != null ? String(answer.valueNumber) : ''}
            onChangeText={(text) => {
              const num = parseFloat(text.replace(',', '.'))
              onAnswer({ valueNumber: isNaN(num) ? undefined : num })
            }}
            keyboardType="decimal-pad"
          />
          {config.unit && (
            <Text style={[styles.numberUnit, { color: colors.label3 }]}>{config.unit}</Text>
          )}
        </View>
      )

    case 'single_choice': {
      const options = config.options ?? config.choices ?? []
      const isCustomSelected = !!answer?.valueText && !options.includes(answer.valueText)
      return (
        <View style={styles.choicesContainer}>
          {options.map((choice) => {
            const isSelected = answer?.valueText === choice
            return (
              <Pressable
                key={choice}
                onPress={() => onAnswer({ valueText: choice })}
                style={[
                  styles.choiceRow,
                  {
                    backgroundColor: isSelected ? 'rgba(201,168,76,0.06)' : colors.bg2,
                    borderColor: isSelected ? colors.gold : colors.sep2,
                  },
                ]}
              >
                <Text style={[styles.choiceText, { color: colors.label }]}>{choice}</Text>
                <View
                  style={[
                    styles.choiceCheck,
                    {
                      borderColor: isSelected ? colors.gold : colors.sep,
                      backgroundColor: isSelected ? colors.gold : 'transparent',
                    },
                  ]}
                >
                  {isSelected && <Ionicons name="checkmark" size={13} color="#fff" />}
                </View>
              </Pressable>
            )
          })}
          {config.allowCustom && (
            <SingleChoiceCustomInput
              isCustomSelected={isCustomSelected}
              customValue={isCustomSelected ? answer?.valueText ?? '' : ''}
              onSubmit={(text) => onAnswer({ valueText: text })}
            />
          )}
        </View>
      )
    }

    case 'multi_select': {
      let selected: string[] = []
      try { if (answer?.valueJson) selected = JSON.parse(answer.valueJson) as string[] } catch {}
      const options = config.options ?? config.choices ?? []
      const allItems = [...options, ...selected.filter((s) => !options.includes(s))]
      return (
        <MultiSelectInput
          items={allItems}
          selected={selected}
          onToggle={(choice) => {
            const next = selected.includes(choice) ? selected.filter((c) => c !== choice) : [...selected, choice]
            onAnswer({ valueJson: JSON.stringify(next) })
          }}
          onAddCustom={(custom) => {
            if (custom && !selected.includes(custom) && !options.includes(custom)) {
              onAnswer({ valueJson: JSON.stringify([...selected, custom]) })
            }
          }}
          allowCustom={config.allowCustom}
        />
      )
    }

    case 'scale':
      return (
        <ScaleInput
          min={config.min}
          max={config.max}
          value={answer?.valueNumber}
          onChange={(val) => onAnswer({ valueNumber: val })}
        />
      )

    default:
      return (
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.bg2, borderColor: colors.sep2, color: colors.label }]}
          placeholder="..."
          placeholderTextColor={colors.label3}
          value={answer?.valueText ?? ''}
          onChangeText={(text) => onAnswer({ valueText: text })}
        />
      )
  }
}

export default QuestionInput

const styles = StyleSheet.create({
  textInput: {
    borderRadius: Radius.md, borderWidth: 1.5,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 17, fontFamily: 'System', minHeight: 48,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  numberWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.md, borderWidth: 1.5,
    paddingHorizontal: 16, minHeight: 48,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  numberInput: { flex: 1, fontSize: 17, paddingVertical: 14 },
  numberUnit: { fontSize: 15, marginLeft: 4 },
  choicesContainer: { gap: 10 },
  choiceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, paddingHorizontal: 18, borderRadius: Radius.md, borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  choiceText: { fontSize: 16, flex: 1 },
  choiceCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  multiWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  multiPill: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: Radius.full, borderWidth: 1.5 },
  multiPillText: { fontSize: 15 },
  customAddRow: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    borderRadius: Radius.md, borderWidth: 1.5, paddingLeft: 16, paddingRight: 6, paddingVertical: 6,
  },
  customAddInput: { flex: 1, fontSize: 15, paddingVertical: 6 },
  customAddBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
})
