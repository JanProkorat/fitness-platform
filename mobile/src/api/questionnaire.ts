import api from './client'
import type {
  CoachQuestionnairesItem,
  SubmittedResponseItem,
  SubmittedAnswerItem,
  PendingQuestionnaireItem,
  GetClientPendingQuestionnairesResponse,
  GetClientSubmittedResponsesResponse,
} from './generated'

// Re-export generated types so consumer imports (`from '@/api/questionnaire'`) still work.
export type {
  CoachQuestionnairesItem,
  SubmittedResponseItem,
  SubmittedAnswerItem,
  PendingQuestionnaireItem,
  GetClientPendingQuestionnairesResponse,
}

/**
 * @deprecated Use `PendingQuestionnaireItem` from generated. Kept as alias for backward compatibility.
 */
// PendingQuestionnaireItem is already exported directly above.

/**
 * @deprecated Use `GetClientPendingQuestionnairesResponse` from generated.
 * Kept as alias for backward compatibility.
 */
export type PendingQuestionnairesResponse = GetClientPendingQuestionnairesResponse

/**
 * @deprecated Use `GetClientSubmittedResponsesResponse` from generated.
 * Kept as alias for backward compatibility.
 */
export type CoachQuestionnairesResponse = GetClientSubmittedResponsesResponse

/**
 * @deprecated Use `SubmittedAnswerItem` from generated. Kept as alias for backward compatibility.
 */
export type SubmittedAnswer = SubmittedAnswerItem

/**
 * `SubmittedQuestionnaire` is a client-side type used by the legacy
 * `getSubmittedQuestionnaire` and `getQuestionnaireResponseById` endpoints.
 * The generated `GetClientResponseResponse` uses `ResponseAnswerDto` for answers,
 * which has a different shape (questionLabel/questionType vs label/type).
 * Keeping this hand-written type until the endpoint is unified or removed.
 */
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

export async function getSubmittedQuestionnairesByCoach(): Promise<CoachQuestionnairesResponse> {
  const { data } = await api.get('/client/questionnaires/submitted')
  return data
}

// ─── Pending questionnaires (multi-coach) ────────────────────────────

export async function getPendingQuestionnaires(): Promise<GetClientPendingQuestionnairesResponse> {
  const { data } = await api.get('/client/questionnaires/pending')
  return data
}

// ─── Single response by ID ──────────────────────────────────────────

export async function getQuestionnaireResponseById(responseId: string): Promise<SubmittedQuestionnaire> {
  const { data } = await api.get(`/client/questionnaire/response/${responseId}`)
  return data
}
