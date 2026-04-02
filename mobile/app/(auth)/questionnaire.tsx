import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore, storage } from '../../src/stores/auth'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { GoldButton } from '@/components/ui/GoldButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import { QuestionScreen } from '@/components/questionnaire/QuestionScreen'
import { RadioGroup } from '@/components/questionnaire/RadioGroup'
import { ScaleInput } from '@/components/questionnaire/ScaleInput'
import api from '../../src/api/client'

// ─── Types ────────────────────────────────────────────────────────────

interface QuestionConfig {
  choices?: string[]
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

type Phase = 'loading' | 'error' | 'intro' | 'questions' | 'success'

const MMKV_KEY = 'questionnaire_answers'

function saveToMmkv(answers: AnswerMap) {
  storage.set(MMKV_KEY, JSON.stringify(answers))
}

function loadFromMmkv(): AnswerMap {
  const raw = storage.getString(MMKV_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as AnswerMap
  } catch {
    return {}
  }
}

function clearMmkv() {
  storage.remove(MMKV_KEY)
}

// ─── Intro Screen ─────────────────────────────────────────────────────

function IntroScreen({
  questionnaire,
  onStart,
}: {
  questionnaire: QuestionnaireData
  onStart: () => void
}) {
  const colors = useTheme()

  return (
    <View style={styles.introContainer}>
      <View style={[styles.introIcon, { backgroundColor: colors.goldBg }]}>
        <Ionicons name="clipboard-outline" size={40} color={colors.gold} />
      </View>
      <Text style={[Type.title1, { color: colors.label, textAlign: 'center', marginTop: 24 }]}>
        {questionnaire.title}
      </Text>
      {questionnaire.description && (
        <Text
          style={[
            Type.body,
            { color: colors.label2, textAlign: 'center', marginTop: 8, lineHeight: 24 },
          ]}
        >
          {questionnaire.description}
        </Text>
      )}
      <View style={[styles.introMeta, { backgroundColor: colors.bg2 }]}>
        <View style={styles.introMetaRow}>
          <Ionicons name="help-circle-outline" size={20} color={colors.label3} />
          <Text style={[Type.body, { color: colors.label, marginLeft: 10 }]}>
            {questionnaire.questionCount} questions
          </Text>
        </View>
        <View style={styles.introMetaRow}>
          <Ionicons name="time-outline" size={20} color={colors.label3} />
          <Text style={[Type.body, { color: colors.label, marginLeft: 10 }]}>
            ~{Math.max(2, Math.ceil(questionnaire.questionCount * 0.5))} min
          </Text>
        </View>
      </View>
      <GoldButton title="Start" onPress={onStart} style={styles.introCta} />
    </View>
  )
}

// ─── Success Screen ───────────────────────────────────────────────────

function SuccessScreen({ onContinue }: { onContinue: () => void }) {
  const colors = useTheme()

  return (
    <View style={styles.introContainer}>
      <View style={[styles.successIcon, { backgroundColor: colors.green + '20' }]}>
        <Ionicons name="checkmark-circle" size={64} color={colors.green} />
      </View>
      <Text style={[Type.title1, { color: colors.label, textAlign: 'center', marginTop: 24 }]}>
        All done!
      </Text>
      <Text
        style={[
          Type.body,
          { color: colors.label2, textAlign: 'center', marginTop: 8, lineHeight: 24 },
        ]}
      >
        Your questionnaire has been submitted. Your trainer will review your answers shortly.
      </Text>
      <GoldButton title="Continue" onPress={onContinue} style={styles.introCta} />
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function QuestionnaireScreen() {
  const colors = useTheme()
  const router = useRouter()
  const refreshProfile = useAuthStore((s) => s.refreshProfile)

  const [phase, setPhase] = useState<Phase>('loading')
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [responsePublicId, setResponsePublicId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Fetch questionnaire
  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await api.get<QuestionnaireData>('/client/questionnaire')
        setQuestionnaire(data)
        setResponsePublicId(data.existingResponsePublicId ?? null)

        // Restore answers: prefer MMKV, fallback to server
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

        setPhase(data.existingResponsePublicId ? 'questions' : 'intro')
      } catch {
        setErrorMsg('Could not load questionnaire.')
        setPhase('error')
      }
    })()
  }, [])

  const questions = questionnaire?.questions ?? []
  const currentQuestion = questions[currentStep]
  const totalSteps = questions.length

  const parseConfig = useCallback((configStr: string | null): QuestionConfig => {
    if (!configStr) return {}
    try {
      return JSON.parse(configStr) as QuestionConfig
    } catch {
      return {}
    }
  }, [])

  const currentConfig = useMemo(
    () => parseConfig(currentQuestion?.config ?? null),
    [currentQuestion, parseConfig],
  )

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

  const isCurrentAnswered = useCallback((): boolean => {
    if (!currentQuestion) return false
    const ans = answers[currentQuestion.publicId]
    if (!currentQuestion.isRequired) return true
    switch (currentQuestion.type) {
      case 'short_text':
        return !!ans?.valueText?.trim()
      case 'number':
        return ans?.valueNumber != null
      case 'single_choice':
        return !!ans?.valueText
      case 'multi_select': {
        if (!ans?.valueJson) return false
        try {
          return (JSON.parse(ans.valueJson) as string[]).length > 0
        } catch {
          return false
        }
      }
      case 'scale':
        return ans?.valueNumber != null
      default:
        return true
    }
  }, [currentQuestion, answers])

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

  const saveCurrentAnswers = async () => {
    const respId = await ensureResponse()
    const payload = Object.entries(answers)
      .filter(([, v]) => v.valueText || v.valueNumber != null || v.valueJson)
      .map(([questionPublicId, v]) => ({
        questionPublicId,
        valueText: v.valueText ?? null,
        valueNumber: v.valueNumber ?? null,
        valueJson: v.valueJson ?? null,
        fileUrl: null,
      }))
    if (payload.length > 0) {
      await api.put(`/client/questionnaire/response/${respId}`, { answers: payload })
    }
  }

  const handleNext = useCallback(async () => {
    if (currentStep < totalSteps - 1) {
      try {
        await saveCurrentAnswers()
      } catch {
        // continue — saved locally in MMKV
      }
      setCurrentStep((s) => s + 1)
    }
  }, [currentStep, totalSteps, answers])

  const handleBack = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1)
  }, [currentStep])

  const handleSubmit = useCallback(async () => {
    try {
      setSubmitting(true)
      const respId = await ensureResponse()
      await saveCurrentAnswers()
      await api.post(`/client/questionnaire/response/${respId}/submit`)
      clearMmkv()
      setPhase('success')
    } catch {
      Alert.alert('Error', 'Could not submit questionnaire. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [answers])

  const handleContinue = useCallback(async () => {
    await refreshProfile()
    router.replace('/(client)')
  }, [refreshProfile, router])

  // ─── Render inputs ────────────────────────────────────────────────

  const renderInput = (q: Question) => {
    const ans = answers[q.publicId]

    switch (q.type) {
      case 'short_text':
        return (
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
            placeholder={currentConfig.placeholder ?? 'Your answer...'}
            placeholderTextColor={colors.label3}
            value={ans?.valueText ?? ''}
            onChangeText={(text) => setAnswer(q.publicId, { valueText: text })}
            autoCapitalize="sentences"
            multiline
          />
        )

      case 'number':
        return (
          <View style={styles.numberRow}>
            <Pressable
              onPress={() => {
                const cur = ans?.valueNumber ?? 0
                if (cur > 0) setAnswer(q.publicId, { valueNumber: cur - 1 })
              }}
              style={[styles.stepper, { backgroundColor: colors.fill }]}
            >
              <Ionicons name="remove" size={20} color={colors.label} />
            </Pressable>
            <TextInput
              style={[styles.textInput, styles.numberInput, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
              placeholder={currentConfig.placeholder ?? '0'}
              placeholderTextColor={colors.label3}
              value={ans?.valueNumber != null ? String(ans.valueNumber) : ''}
              onChangeText={(text) => {
                const num = parseFloat(text.replace(',', '.'))
                setAnswer(q.publicId, { valueNumber: isNaN(num) ? undefined : num })
              }}
              keyboardType="decimal-pad"
              textAlign="center"
            />
            <Pressable
              onPress={() => {
                const cur = ans?.valueNumber ?? 0
                setAnswer(q.publicId, { valueNumber: cur + 1 })
              }}
              style={[styles.stepper, { backgroundColor: colors.fill }]}
            >
              <Ionicons name="add" size={20} color={colors.label} />
            </Pressable>
            {currentConfig.unit && (
              <Text style={[Type.body, { color: colors.label2, marginLeft: 8 }]}>
                {currentConfig.unit}
              </Text>
            )}
          </View>
        )

      case 'single_choice':
        return (
          <RadioGroup
            choices={currentConfig.choices ?? []}
            value={ans?.valueText}
            onChange={(choice) => setAnswer(q.publicId, { valueText: choice })}
          />
        )

      case 'multi_select': {
        let selected: string[] = []
        try {
          if (ans?.valueJson) selected = JSON.parse(ans.valueJson) as string[]
        } catch { /* ignore */ }
        const choices = currentConfig.choices ?? []

        return (
          <View style={styles.multiContainer}>
            {choices.map((choice) => {
              const isSelected = selected.includes(choice)
              return (
                <Pressable
                  key={choice}
                  onPress={() => {
                    const next = isSelected
                      ? selected.filter((c) => c !== choice)
                      : [...selected, choice]
                    setAnswer(q.publicId, { valueJson: JSON.stringify(next) })
                  }}
                  style={[
                    styles.multiPill,
                    {
                      backgroundColor: isSelected ? colors.goldBg : colors.bg2,
                      borderColor: isSelected ? colors.gold : colors.sep,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: isSelected ? colors.gold : 'transparent',
                        borderColor: isSelected ? colors.gold : colors.label3,
                      },
                    ]}
                  >
                    {isSelected && <Ionicons name="checkmark" size={14} color="#000" />}
                  </View>
                  <Text style={[Type.body, { color: isSelected ? colors.label : colors.label2, flex: 1 }]}>
                    {choice}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        )
      }

      case 'scale':
        return (
          <ScaleInput
            min={currentConfig.min}
            max={currentConfig.max}
            value={ans?.valueNumber}
            onChange={(val) => setAnswer(q.publicId, { valueNumber: val })}
          />
        )

      default:
        return (
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
            placeholder="Your answer..."
            placeholderTextColor={colors.label3}
            value={ans?.valueText ?? ''}
            onChangeText={(text) => setAnswer(q.publicId, { valueText: text })}
          />
        )
    }
  }

  // ─── Main render ──────────────────────────────────────────────────

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
            {errorMsg}
          </Text>
          <SecondaryButton
            title="Try again"
            onPress={() => {
              setPhase('loading')
              // re-trigger fetch
              setQuestionnaire(null)
            }}
            style={{ marginTop: 20 }}
          />
        </View>
      </SafeAreaView>
    )
  }

  if (phase === 'intro' && questionnaire) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <IntroScreen questionnaire={questionnaire} onStart={() => setPhase('questions')} />
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

  // Questions phase
  if (!currentQuestion) return null

  const isLast = currentStep === totalSteps - 1
  const canProceed = isCurrentAnswered()
  const progress = (currentStep + 1) / totalSteps

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Progress bar */}
        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: colors.fill }]}>
            <View
              style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.gold }]}
            />
          </View>
          <Text style={[Type.caption1, { color: colors.label3, marginLeft: 12 }]}>
            {currentStep + 1}/{totalSteps}
          </Text>
        </View>

        {/* Questionnaire title */}
        <View style={styles.titleRow}>
          <Text style={[Type.footnote, { color: colors.label3, letterSpacing: 0.5 }]}>
            {questionnaire?.title?.toUpperCase()}
          </Text>
        </View>

        {/* Question */}
        <QuestionScreen
          label={currentQuestion.label}
          helperText={currentQuestion.helperText}
          isRequired={currentQuestion.isRequired}
        >
          {renderInput(currentQuestion)}
        </QuestionScreen>

        {/* Navigation */}
        <View style={[styles.navRow, { borderTopColor: colors.sep2 }]}>
          {currentStep > 0 ? (
            <SecondaryButton title="Back" onPress={handleBack} style={styles.navBtn} />
          ) : (
            <View style={styles.navBtn} />
          )}
          <GoldButton
            title={isLast ? 'Submit' : 'Next'}
            onPress={isLast ? handleSubmit : handleNext}
            disabled={!canProceed || submitting}
            loading={submitting}
            style={[styles.navBtn, { flex: 2 }]}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  // Intro / Success
  introContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  introIcon: {
    width: 80,
    height: 80,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  introMeta: {
    borderRadius: Radius.md,
    padding: 16,
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  introMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  introCta: {
    width: '100%',
    marginTop: 24,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Progress
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  titleRow: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  // Navigation
  navRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  navBtn: {
    flex: 1,
  },
  // Inputs
  textInput: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...Type.body,
    minHeight: 48,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  numberInput: {
    flex: 1,
    maxWidth: 120,
  },
  stepper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  multiContainer: {
    gap: 10,
  },
  multiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
})
