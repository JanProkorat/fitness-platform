import api from './client'

export interface SubmittedAnswer {
  label: string
  type: string
  valueText: string | null
  valueNumber: number | null
  valueJson: string | null
  config: string | null
}

export interface SubmittedQuestionnaire {
  questionnaireTitle: string
  submittedAt: string | null
  answers: SubmittedAnswer[]
}

/** @deprecated Use getSubmittedQuestionnairesByCoach instead */
export async function getSubmittedQuestionnaire(): Promise<SubmittedQuestionnaire> {
  const { data } = await api.get('/client/questionnaire/submitted')
  return data
}

// ─── Per-coach submitted questionnaires ──────────────────────────────

export interface SubmittedResponseItem {
  responsePublicId: string
  questionnaireTitle: string
  submittedAt: string | null
  answers: SubmittedAnswer[]
}

export interface CoachQuestionnairesItem {
  linkPublicId: string
  professionalName: string
  professionalRole: string | null
  responses: SubmittedResponseItem[]
}

export interface CoachQuestionnairesResponse {
  coaches: CoachQuestionnairesItem[]
}

export async function getSubmittedQuestionnairesByCoach(): Promise<CoachQuestionnairesResponse> {
  const { data } = await api.get('/client/questionnaires/submitted')
  return data
}

// ─── Pending questionnaires (multi-coach) ────────────────────────────

export interface PendingQuestionnaireItem {
  linkPublicId: string
  professionalName: string
  professionalRole: string | null
  questionnairePublicId: string | null
  questionnaireTitle: string | null
  questionCount: number
  responsePublicId: string | null
  responseStatus: string | null
}

export interface PendingQuestionnairesResponse {
  items: PendingQuestionnaireItem[]
}

export async function getPendingQuestionnaires(): Promise<PendingQuestionnairesResponse> {
  const { data } = await api.get('/client/questionnaires/pending')
  return data
}
