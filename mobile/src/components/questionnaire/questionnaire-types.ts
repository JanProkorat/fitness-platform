import { storage } from '@/stores/auth'

// ─── Types ────────────────────────────────────────────────────────────

export interface QuestionConfig {
  choices?: string[]
  options?: string[]
  allowCustom?: boolean
  min?: number
  max?: number
  unit?: string
  placeholder?: string
}

export interface Question {
  publicId: string
  orderIndex: number
  type: string
  label: string
  helperText: string | null
  isRequired: boolean
  config: string | null
}

export interface ExistingAnswer {
  questionPublicId: string
  valueText: string | null
  valueNumber: number | null
  valueJson: string | null
  fileUrl: string | null
}

export interface QuestionnaireData {
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

export type AnswerMap = Record<
  string,
  { valueText?: string; valueNumber?: number; valueJson?: string }
>

export type Phase = 'loading' | 'error' | 'intro' | 'questions' | 'summary' | 'success'

// ─── MMKV Helpers ─────────────────────────────────────────────────────

export const MMKV_KEY = 'questionnaire_answers'

export function saveToMmkv(answers: AnswerMap) {
  storage.set(MMKV_KEY, JSON.stringify(answers))
}

export function loadFromMmkv(): AnswerMap {
  const raw = storage.getString(MMKV_KEY)
  if (!raw) return {}
  try { return JSON.parse(raw) as AnswerMap } catch { return {} }
}

export function clearMmkv() {
  storage.remove(MMKV_KEY)
}
