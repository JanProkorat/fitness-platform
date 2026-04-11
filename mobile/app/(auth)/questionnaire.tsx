import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore, storage } from '../../src/stores/auth'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { GoldButton } from '@/components/ui/GoldButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { Avatar } from '@/components/ui/Avatar'
import { RadioGroup } from '@/components/questionnaire/RadioGroup'
import { ScaleInput } from '@/components/questionnaire/ScaleInput'
import api from '../../src/api/client'

// ─── Types ────────────────────────────────────────────────────────────

interface QuestionConfig {
  choices?: string[]
  options?: string[]
  allowCustom?: boolean
  min?: number
  max?: number
  unit?: string
  placeholder?: string
}

interface Question {
  publicId: string
  orderIndex: number
  type: string
  label: string
  helperText: string | null
  isRequired: boolean
  config: string | null
}

interface ExistingAnswer {
  questionPublicId: string
  valueText: string | null
  valueNumber: number | null
  valueJson: string | null
  fileUrl: string | null
}

interface QuestionnaireData {
  questionnairePublicId: string
  title: string
  description: string | null
  professionalName: string
  professionalRole: string | null
  professionalCity: string | null
  questionCount: number
  questions: Question[]
  existingResponsePublicId: string | null
  existingResponseStatus: string | null
  existingAnswers: ExistingAnswer[] | null
}

type AnswerMap = Record<
  string,
  { valueText?: string; valueNumber?: number; valueJson?: string }
>

type Phase = 'loading' | 'error' | 'intro' | 'questions' | 'summary' | 'success'

const MMKV_KEY = 'questionnaire_answers'

function saveToMmkv(answers: AnswerMap) {
  storage.set(MMKV_KEY, JSON.stringify(answers))
}

function loadFromMmkv(): AnswerMap {
  const raw = storage.getString(MMKV_KEY)
  if (!raw) return {}
  try { return JSON.parse(raw) as AnswerMap } catch { return {} }
}

function clearMmkv() {
  storage.remove(MMKV_KEY)
}

// ─── Intro Screen (matches prototype) ────────────────────────────────

function IntroScreen({
  questionnaire,
  onStart,
  onClose,
}: {
  questionnaire: QuestionnaireData
  onStart: () => void
  onClose: () => void
}) {
  const colors = useTheme()
  const { t } = useTranslation()

  const profName = questionnaire.professionalName
  const profFirstName = profName.split(' ')[0]
  const profRole = questionnaire.professionalRole ?? ''
  const profCity = questionnaire.professionalCity ?? ''

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.introScroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.introHero}>
          <Text style={{ fontSize: 72, lineHeight: 80 }}>📋</Text>
          <Text style={[styles.introTitle, { color: colors.label }]}>
            {questionnaire.title}
          </Text>
          <Text style={[styles.introDesc, { color: colors.label2 }]}>
            {t('questionnaire.introDesc', { name: profFirstName })}
          </Text>

          {/* Trainer card */}
          <View style={[styles.trainerCard, { backgroundColor: colors.bg2 }]}>
            <Avatar name={profName} size="sm" />
            <View style={{ flex: 1 }}>
              <Text style={[Type.headline, { color: colors.label, fontSize: 15 }]}>
                {profName}
              </Text>
              <Text style={[Type.caption1, { color: colors.label2, marginTop: 2 }]}>
                {profRole}{profCity ? ` · ${profCity}` : ''}
              </Text>
            </View>
          </View>

          {/* Meta chips */}
          <View style={styles.metaChips}>
            <View style={[styles.metaChip, { backgroundColor: colors.fill }]}>
              <Text style={[styles.metaChipText, { color: colors.label2 }]}>
                📝 {questionnaire.questionCount} {t('questionnaire.questions')}
              </Text>
            </View>
            <View style={[styles.metaChip, { backgroundColor: colors.fill }]}>
              <Text style={[styles.metaChipText, { color: colors.label2 }]}>
                🔒 {t('questionnaire.privateOnly')}
              </Text>
            </View>
          </View>
        </View>

        {/* Trainer message with questionnaire description */}
        <View style={styles.introBottom}>
          <View style={[styles.trainerMessage, { backgroundColor: colors.goldBg, borderColor: 'rgba(201,168,76,0.2)' }]}>
            <Text style={{ color: colors.label2, lineHeight: 22, fontSize: 13 }}>
              <Text style={{ fontWeight: '600', color: colors.label }}>{t('questionnaire.messageFrom', { name: profFirstName })}:</Text>
              {' „'}{questionnaire.description || t('questionnaire.trainerIntro')}{'"'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCta, { borderTopColor: colors.sep2, backgroundColor: colors.bg + 'F2' }]}>
        <GoldButton title={t('questionnaire.start')} onPress={onStart} />
      </View>

      {/* Close button */}
      <Pressable onPress={onClose} hitSlop={8} style={styles.closeAbsolute}>
        <Ionicons name="close" size={22} color={colors.label3} />
      </Pressable>
    </View>
  )
}

// ─── Success Screen (matches prototype) ──────────────────────────────

function SuccessScreen({ onContinue }: { onContinue: () => void }) {
  const colors = useTheme()
  const { t } = useTranslation()

  return (
    <View style={styles.successContainer}>
      <View style={[styles.successRing, { borderColor: colors.green + '33' }]}>
        <Ionicons name="checkmark" size={48} color={colors.green} />
      </View>
      <Text style={[styles.successTitle, { color: colors.label }]}>
        {t('questionnaire.allDone')}
      </Text>
      <Text style={[styles.successDesc, { color: colors.label2 }]}>
        {t('questionnaire.submittedDesc')}
      </Text>
      <GoldButton title={t('questionnaire.goHome')} onPress={onContinue} style={{ width: '100%', marginTop: 32 }} />
    </View>
  )
}

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

function QuestionInput({
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

// ─── Main Screen ──────────────────────────────────────────────────────

export default function QuestionnaireScreen() {
  const colors = useTheme()
  const router = useRouter()
  const { linkPublicId } = useLocalSearchParams<{ linkPublicId?: string }>()
  const { t } = useTranslation()
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const queryClient = useQueryClient()

  const [phase, setPhase] = useState<Phase>('loading')
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData | null>(null)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [responsePublicId, setResponsePublicId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [currentSection, setCurrentSection] = useState(0)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await api.get<QuestionnaireData>('/client/questionnaire', {
          params: linkPublicId ? { linkPublicId } : undefined,
        })
        setQuestionnaire(data)
        setResponsePublicId(data.existingResponsePublicId ?? null)

        const mmkvAnswers = loadFromMmkv()
        if (Object.keys(mmkvAnswers).length > 0) {
          setAnswers(mmkvAnswers)
        } else if (data.existingAnswers) {
          const restored: AnswerMap = {}
          for (const ans of data.existingAnswers) {
            restored[ans.questionPublicId] = {
              valueText: ans.valueText ?? undefined,
              valueNumber: ans.valueNumber ?? undefined,
              valueJson: ans.valueJson ?? undefined,
            }
          }
          setAnswers(restored)
        }

        setPhase('intro')
      } catch {
        setPhase('error')
      }
    })()
  }, [linkPublicId])

  const questions = questionnaire?.questions ?? []

  // Parse questions into sections
  const sections = useMemo(() => {
    const result: Array<{
      title: string
      description: string | null
      sectionIndex: number
      questions: Question[]
    }> = []

    let currentSec: (typeof result)[0] | null = null
    let questionNum = 0

    for (const q of questions) {
      if (q.type === 'section') {
        currentSec = { title: q.label, description: q.helperText, sectionIndex: result.length, questions: [] }
        result.push(currentSec)
      } else {
        if (!currentSec) {
          // Questions before any section marker go into a default section
          currentSec = { title: questionnaire?.title ?? '', description: null, sectionIndex: 0, questions: [] }
          result.push(currentSec)
        }
        currentSec.questions.push(q)
      }
    }

    return result
  }, [questions, questionnaire?.title])

  const totalSections = sections.length
  const activeSection = sections[currentSection] ?? sections[0]
  const activeQuestions = activeSection?.questions ?? []
  const isLastSection = currentSection >= totalSections - 1

  // Question numbering offset for current section
  const questionOffset = useMemo(() => {
    let offset = 0
    for (let i = 0; i < currentSection; i++) {
      offset += sections[i]?.questions.length ?? 0
    }
    return offset
  }, [currentSection, sections])

  const setAnswer = useCallback(
    (questionId: string, value: Partial<AnswerMap[string]>) => {
      setAnswers((prev) => {
        const updated = { ...prev, [questionId]: { ...prev[questionId], ...value } }
        saveToMmkv(updated)
        return updated
      })
    },
    [],
  )

  const answeredCount = useMemo(() => {
    let count = 0
    for (const q of questions) {
      const ans = answers[q.publicId]
      if (ans?.valueText?.trim() || ans?.valueNumber != null || ans?.valueJson) count++
    }
    return count
  }, [questions, answers])

  const allRequiredAnswered = useMemo(() => {
    for (const q of questions) {
      if (!q.isRequired) continue
      const ans = answers[q.publicId]
      switch (q.type) {
        case 'short_text':
          if (!ans?.valueText?.trim()) return false; break
        case 'number': case 'scale':
          if (ans?.valueNumber == null) return false; break
        case 'single_choice':
          if (!ans?.valueText) return false; break
        case 'multi_select':
          try { if (!ans?.valueJson || (JSON.parse(ans.valueJson) as string[]).length === 0) return false } catch { return false }
          break
      }
    }
    return true
  }, [questions, answers])

  const currentSectionComplete = useMemo(() => {
    for (const q of activeQuestions) {
      if (!q.isRequired) continue
      const ans = answers[q.publicId]
      switch (q.type) {
        case 'short_text':
          if (!ans?.valueText?.trim()) return false; break
        case 'number': case 'scale':
          if (ans?.valueNumber == null) return false; break
        case 'single_choice':
          if (!ans?.valueText) return false; break
        case 'multi_select':
          try { if (!ans?.valueJson || (JSON.parse(ans.valueJson) as string[]).length === 0) return false } catch { return false }
          break
      }
    }
    return true
  }, [activeQuestions, answers])

  const ensureResponse = async (): Promise<string> => {
    if (responsePublicId) return responsePublicId
    if (!questionnaire) throw new Error('No questionnaire')
    const { data } = await api.post<{ responsePublicId: string }>(
      '/client/questionnaire/response',
      { questionnairePublicId: questionnaire.questionnairePublicId },
    )
    setResponsePublicId(data.responsePublicId)
    return data.responsePublicId
  }

  const handleSubmit = useCallback(async () => {
    try {
      setSubmitting(true)
      const respId = await ensureResponse()
      const payload = Object.entries(answers)
        .filter(([, v]) => v.valueText != null || v.valueNumber != null || v.valueJson != null)
        .map(([questionPublicId, v]) => ({
          questionPublicId,
          valueText: v.valueText ?? null,
          valueNumber: v.valueNumber ?? null,
          valueJson: v.valueJson ?? null,
          fileUrl: null,
        }))
      await api.put(`/client/questionnaire/response/${respId}`, { answers: payload })
      await api.post(`/client/questionnaire/response/${respId}/submit`)
      clearMmkv()
      queryClient.invalidateQueries({ queryKey: ['pending-questionnaires'] })
      setPhase('success')
    } catch {
      Alert.alert(t('common.error'), t('questionnaire.submitError'))
    } finally {
      setSubmitting(false)
    }
  }, [answers])

  const handleContinue = useCallback(async () => {
    await refreshProfile()
    router.replace('/(client)')
  }, [refreshProfile, router])

  const progress = totalSections > 0 ? (currentSection + 1) / (totalSections + 1) : 0

  // ─── Render ──────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </SafeAreaView>
    )
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.label3} />
          <Text style={[Type.headline, { color: colors.label2, marginTop: 12 }]}>
            {t('common.error')}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  if (phase === 'intro' && questionnaire) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <IntroScreen
          questionnaire={questionnaire}
          onStart={() => setPhase('questions')}
          onClose={() => router.back()}
        />
      </SafeAreaView>
    )
  }

  if (phase === 'success') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <SuccessScreen onContinue={handleContinue} />
      </SafeAreaView>
    )
  }

  // ─── Summary phase ─────────────────────────────────────────────────

  if (phase === 'summary') {
    const formatAnswer = (q: Question): string => {
      const ans = answers[q.publicId]
      if (!ans) return '—'
      switch (q.type) {
        case 'short_text':
          return ans.valueText?.trim() || '—'
        case 'number':
          if (ans.valueNumber == null) return '—'
          try {
            const cfg = JSON.parse(q.config ?? '{}') as QuestionConfig
            return cfg.unit ? `${ans.valueNumber} ${cfg.unit}` : String(ans.valueNumber)
          } catch { return String(ans.valueNumber) }
        case 'single_choice':
          return ans.valueText || '—'
        case 'multi_select':
          try {
            const arr = JSON.parse(ans.valueJson ?? '[]') as string[]
            return arr.length > 0 ? arr.join(', ') : '—'
          } catch { return '—' }
        case 'scale':
          if (ans.valueNumber == null) return '—'
          try {
            const cfg = JSON.parse(q.config ?? '{}') as QuestionConfig
            return `${ans.valueNumber} / ${cfg.max ?? 10}`
          } catch { return String(ans.valueNumber) }
        default:
          return ans.valueText || '—'
      }
    }

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Progress bar — almost full */}
        <View style={[styles.progressBar, { backgroundColor: colors.fill }]}>
          <View style={[styles.progressFill, { width: '100%', backgroundColor: colors.gold }]} />
        </View>

        {/* Fixed header */}
        <View style={[styles.summaryHeader, { borderBottomColor: colors.sep2 }]}>
          <View style={styles.summaryHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionCounter, { color: colors.gold }]}>
                {t('questionnaire.reviewLabel')}
              </Text>
              <Text style={[styles.sectionTitle, { color: colors.label }]}>
                {t('questionnaire.reviewTitle')}
              </Text>
              <Text style={[styles.sectionDesc, { color: colors.label2 }]}>
                {t('questionnaire.reviewDesc')}
              </Text>
            </View>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.sectionClose}>
              <Ionicons name="close" size={22} color={colors.label3} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.summaryScroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Section cards */}
          {sections.map((sec, sIdx) => (
            <View key={sIdx} style={[styles.summaryCard, { backgroundColor: colors.bg2 }]}>
              <View style={[styles.summaryCardHeader, { borderBottomColor: colors.sep2 }]}>
                <Text style={[styles.summaryCardTitle, { color: colors.label }]}>
                  {totalSections > 1 ? `${t('questionnaire.sectionLabel')} ${sIdx + 1} — ` : ''}{sec.title}
                </Text>
                <Pressable onPress={() => { setCurrentSection(sIdx); setPhase('questions') }}>
                  <Text style={[styles.summaryEdit, { color: colors.blue }]}>
                    {t('questionnaire.edit')}
                  </Text>
                </Pressable>
              </View>
              {sec.questions.map((q, qIdx) => {
                const val = formatAnswer(q)
                const isMulti = q.type === 'multi_select' && val !== '—'
                return (
                  <View
                    key={q.publicId}
                    style={[
                      styles.summaryRow,
                      qIdx < sec.questions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.sep2 },
                    ]}
                  >
                    <Text style={[styles.summaryLabel, { color: colors.label2 }]}>{q.label}</Text>
                    {isMulti ? (
                      <View style={styles.summaryChips}>
                        {val.split(', ').map((v) => (
                          <View key={v} style={[styles.summaryChip, { backgroundColor: colors.goldBg }]}>
                            <Text style={[styles.summaryChipText, { color: colors.gold }]}>{v}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={[styles.summaryValue, { color: colors.label }]}>{val}</Text>
                    )}
                  </View>
                )
              })}
            </View>
          ))}

          {/* Privacy note */}
          <View style={[styles.privacyNote, { backgroundColor: colors.fill }]}>
            <Text style={[styles.privacyText, { color: colors.label2 }]}>
              🔒 {t('questionnaire.privateNote')}
            </Text>
          </View>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={[styles.bottomCta, { borderTopColor: colors.sep2, backgroundColor: colors.bg + 'F2' }]}>
          <View style={styles.bottomRow}>
            <SecondaryButton
              title={t('common.back')}
              onPress={() => { setCurrentSection(totalSections - 1); setPhase('questions') }}
              style={styles.bottomBtnBack}
            />
            <GoldButton
              title={submitting ? `${t('onboarding.submit')}...` : `${t('onboarding.submit')} ✓`}
              onPress={handleSubmit}
              disabled={!allRequiredAnswered || submitting}
              loading={submitting}
              style={{ flex: 2 }}
            />
          </View>
          <Text style={[styles.submitHint, { color: colors.label3 }]}>
            {t('questionnaire.cannotChangeAfter')}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  // ─── Questions phase ───────────────────────────────────────────────

  const handleBack = () => {
    if (currentSection > 0) {
      setCurrentSection((s) => s - 1)
      scrollRef.current?.scrollTo({ y: 0, animated: false })
    } else {
      setPhase('intro')
    }
  }

  const handleNext = () => {
    if (!isLastSection) {
      setCurrentSection((s) => s + 1)
      scrollRef.current?.scrollTo({ y: 0, animated: false })
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Progress bar */}
        <View style={[styles.progressBar, { backgroundColor: colors.fill }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.gold }]} />
        </View>

        {/* Fixed section header */}
        {activeSection && (
          <View style={[styles.sectionHeader, { borderBottomColor: colors.sep2 }]}>
            <View style={styles.sectionHeaderTop}>
              <View style={{ flex: 1 }}>
                {totalSections > 1 && (
                  <Text style={[styles.sectionCounter, { color: colors.gold }]}>
                    {t('questionnaire.sectionOf', { current: currentSection + 1, total: totalSections })}
                  </Text>
                )}
                <Text style={[styles.sectionTitle, { color: colors.label }]}>
                  {activeSection.title}
                </Text>
              </View>
              <Pressable onPress={() => router.back()} hitSlop={8} style={styles.sectionClose}>
                <Ionicons name="close" size={22} color={colors.label3} />
              </Pressable>
            </View>
            {activeSection.description && (
              <Text style={[styles.sectionDesc, { color: colors.label2 }]}>
                {activeSection.description}
              </Text>
            )}
          </View>
        )}

        {/* Scrollable questions */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.qScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section questions */}
          {activeQuestions.map((q, i) => (
            <View key={q.publicId} style={styles.questionBlock}>
              <Text style={[styles.qLabel, { color: colors.label }]}>
                {questionOffset + i + 1}. {q.label}
              </Text>
              {q.helperText && (
                <Text style={[styles.qHelper, { color: colors.label2 }]}>
                  {q.helperText}
                </Text>
              )}
              <View style={styles.qInput}>
                <QuestionInput
                  question={q}
                  answer={answers[q.publicId]}
                  onAnswer={(value) => setAnswer(q.publicId, value)}
                />
              </View>
            </View>
          ))}

          {/* Privacy note on last section */}
          {isLastSection && (
            <View style={[styles.privacyNote, { backgroundColor: colors.fill }]}>
              <Text style={[styles.privacyText, { color: colors.label2 }]}>
                🔒 {t('questionnaire.privateNote')}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom CTA */}
        <View style={[styles.bottomCta, { borderTopColor: colors.sep2, backgroundColor: colors.bg + 'F2' }]}>
          {isLastSection ? (
            <View style={styles.bottomRow}>
              {currentSection > 0 && (
                <SecondaryButton title={t('common.back')} onPress={handleBack} style={styles.bottomBtnBack} />
              )}
              <GoldButton
                title={t('questionnaire.reviewAnswers')}
                onPress={() => setPhase('summary')}
                disabled={!currentSectionComplete}
                style={{ flex: 2 }}
              />
            </View>
          ) : (
            <View style={styles.bottomRow}>
              {currentSection > 0 ? (
                <SecondaryButton title={t('common.back')} onPress={handleBack} style={styles.bottomBtnBack} />
              ) : (
                <SecondaryButton title={t('common.back')} onPress={() => setPhase('intro')} style={styles.bottomBtnBack} />
              )}
              <GoldButton
                title={t('questionnaire.nextSection')}
                onPress={handleNext}
                disabled={!currentSectionComplete}
                style={{ flex: 2 }}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },

  // ─── Intro ─────────────────────────────────────
  introScroll: { paddingBottom: 120 },
  introHero: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  introTitle: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5, marginTop: 20, textAlign: 'center' },
  introDesc: { fontSize: 16, lineHeight: 25, marginTop: 12, textAlign: 'center' },
  trainerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 28, padding: 14, paddingHorizontal: 16,
    borderRadius: Radius.lg, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  metaChips: { flexDirection: 'row', gap: 8, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' },
  metaChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full },
  metaChipText: { fontSize: 13, fontWeight: '500' },
  introBottom: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, gap: 12 },
  trainerMessage: { padding: 14, borderRadius: Radius.sm, borderWidth: 1, borderColor: 'transparent' },
  closeAbsolute: { position: 'absolute', top: 16, right: 16, padding: 4 },

  // ─── Success ───────────────────────────────────
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  successRing: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(52,199,89,0.12)', borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  successTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
  successDesc: { fontSize: 16, lineHeight: 25, textAlign: 'center', marginTop: 12 },

  // ─── Progress bar ──────────────────────────────
  progressBar: { height: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },

  // ─── Question header ───────────────────────────

  // ─── Questions scroll ──────────────────────────
  qScroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120 },
  sectionHeader: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionHeaderTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sectionClose: { padding: 4, marginTop: 2 },
  sectionCounter: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  sectionTitle: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4, lineHeight: 31 },
  sectionDesc: { fontSize: 15, lineHeight: 23, marginTop: 6 },
  questionBlock: { marginBottom: 28 },
  qLabel: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  qHelper: { fontSize: 13, lineHeight: 20, marginBottom: 14 },
  qInput: { marginTop: 4 },

  // ─── Privacy note ──────────────────────────────
  privacyNote: { padding: 14, borderRadius: Radius.sm, marginTop: 4 },
  privacyText: { fontSize: 13, lineHeight: 20 },

  // ─── Bottom CTA ────────────────────────────────
  bottomCta: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 36, borderTopWidth: StyleSheet.hairlineWidth },
  bottomRow: { flexDirection: 'row', gap: 12 },
  bottomBtnBack: { flex: 1, height: 52 },
  submitHint: { textAlign: 'center', fontSize: 13, marginTop: 10 },

  // ─── Summary ───────────────────────────────────
  summaryHeader: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  summaryScroll: { padding: 24, paddingTop: 16, paddingBottom: 32 },
  summaryHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  summaryCard: {
    borderRadius: Radius.lg, overflow: 'hidden', marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  summaryCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryCardTitle: { fontSize: 14, fontWeight: '600' },
  summaryEdit: { fontSize: 13, fontWeight: '600' },
  summaryRow: { paddingHorizontal: 16, paddingVertical: 10 },
  summaryLabel: { fontSize: 13, marginBottom: 4 },
  summaryValue: { fontSize: 14, fontWeight: '500' },
  summaryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  summaryChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  summaryChipText: { fontSize: 12, fontWeight: '500' },

  // ─── Inputs ────────────────────────────────────
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
