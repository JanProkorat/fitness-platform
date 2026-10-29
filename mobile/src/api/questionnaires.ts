import { api } from '@/api/client';
import { getErrorStatus, getProblemCode, isNetworkError } from '@/api/errors';
import { ApiException } from '@/api/generated';
import type {
  AnswerDto,
  ClientAnswerDto,
  ClientQuestionDto,
  CoachQuestionnairesItem,
  GetClientQuestionnaireResponse,
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

export type ClientQuestionnaire = GetClientQuestionnaireResponse;
export type ClientQuestion = ClientQuestionDto;
export type ClientAnswer = ClientAnswerDto;
export type AnswerPayload = AnswerDto;

export const clientQuestionnaireQueryKey = (linkPublicId: string, responsePublicId: string | null) =>
  ['questionnaires', 'client', linkPublicId, responsePublicId] as const;

const REQUIRED_ANSWER_MISSING = 'QUESTIONNAIRE_REQUIRED_ANSWER_MISSING';

export type QuestionnaireFailure =
  | 'network'
  | 'unavailable'
  | 'alreadySent'
  | 'requiredMissing'
  | 'saveFailed'
  | 'generic';

/** The problem code of an error; the generated client delivers a 400 body as raw text on an ApiException. */
function readCode(error: unknown): string | undefined {
  const direct = getProblemCode(error);
  if (direct) return direct;
  if (!(error instanceof ApiException)) return undefined;
  try {
    return getProblemCode(JSON.parse(error.response) as unknown);
  } catch {
    return undefined;
  }
}

/** Maps anything the load, create, save or submit calls can throw to the failure the screen shows. */
export function classifyQuestionnaireError(error: unknown): QuestionnaireFailure {
  if (isNetworkError(error)) return 'network';
  const status = getErrorStatus(error);
  if (status === 404) return 'unavailable';
  if (status === 409) return 'alreadySent';
  if (status === 400) return readCode(error) === REQUIRED_ANSWER_MISSING ? 'requiredMissing' : 'saveFailed';
  return 'generic';
}

/** The questionnaire of one coach link, with any answers already saved (GET /client/questionnaire). */
export function fetchClientQuestionnaire(
  linkPublicId: string,
  responsePublicId: string | null,
  signal?: AbortSignal,
): Promise<ClientQuestionnaire> {
  return api.getClientQuestionnaireEndpoint(linkPublicId, responsePublicId, signal);
}

/** Starts an in-progress response and returns its public id (POST /client/questionnaire/response). */
export async function createQuestionnaireResponse(questionnairePublicId: string): Promise<string> {
  const created = await api.createResponseEndpoint({ questionnairePublicId });
  if (!created.responsePublicId) throw new Error('The created response has no id.');
  return created.responsePublicId;
}

/** Saves every answer of an open response; a blank one clears the stored answer. */
export function saveQuestionnaireAnswers(responsePublicId: string, answers: AnswerPayload[]): Promise<void> {
  return api.updateResponseEndpoint(responsePublicId, { answers });
}

export function submitQuestionnaireResponse(responsePublicId: string): Promise<void> {
  return api.submitResponseEndpoint(responsePublicId);
}

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
