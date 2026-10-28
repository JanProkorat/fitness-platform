import { api } from '@/api/client';
import type {
  CoachQuestionnairesItem,
  PendingDiaryRequestItem,
  PendingQuestionnaireItem,
} from '@/api/generated';

export type PendingQuestionnaire = PendingQuestionnaireItem;
export type PendingDiaryRequest = PendingDiaryRequestItem;
export type SubmittedByCoach = CoachQuestionnairesItem;

export type PendingItems = {
  questionnaires: PendingQuestionnaire[];
  diaryRequests: PendingDiaryRequest[];
};

export const PENDING_QUESTIONNAIRES_QUERY_KEY = ['questionnaires', 'pending'] as const;
export const SUBMITTED_QUESTIONNAIRES_QUERY_KEY = ['questionnaires', 'submitted'] as const;

/** Questionnaires and photo-diary requests waiting on the client (GET /client/questionnaires/pending). */
export async function fetchPendingQuestionnaires(signal?: AbortSignal): Promise<PendingItems> {
  const response = await api.getClientPendingQuestionnairesEndpoint(signal);
  return {
    questionnaires: response.items ?? [],
    diaryRequests: response.pendingDiaryRequests ?? [],
  };
}

/** Questionnaires the client already answered, grouped by coach link (GET /client/questionnaires/submitted). */
export async function fetchSubmittedQuestionnaires(signal?: AbortSignal): Promise<SubmittedByCoach[]> {
  const response = await api.getClientSubmittedResponsesEndpoint(signal);
  return response.coaches ?? [];
}
