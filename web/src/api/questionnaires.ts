import api from '@/lib/api';

export interface QuestionDto {
  publicId: string;
  orderIndex: number;
  type: string;
  label: string;
  helperText?: string | null;
  isRequired: boolean;
  isHidden: boolean;
  config?: string | null;
  mappedField?: string | null;
}

export interface QuestionnaireDto {
  publicId: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  isDefault: boolean;
  questions: QuestionDto[];
}

export interface QuestionnaireSummaryDto {
  publicId: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  isDefault: boolean;
  questionCount: number;
  dateCreated: string;
}

export interface UpdateQuestionDto {
  publicId?: string | null;
  orderIndex: number;
  type: string;
  label: string;
  helperText?: string | null;
  isRequired: boolean;
  isHidden: boolean;
  config?: string | null;
  mappedField?: string | null;
}

interface GetTrainerQuestionnairesResponse {
  questionnaires: QuestionnaireSummaryDto[];
}

export async function getTrainerQuestionnaires(): Promise<QuestionnaireSummaryDto[]> {
  const { data } = await api.get<GetTrainerQuestionnairesResponse>('/trainer/questionnaires');
  return data.questionnaires;
}

export async function getTrainerQuestionnaire(publicId: string): Promise<QuestionnaireDto> {
  const { data } = await api.get<QuestionnaireDto>(`/trainer/questionnaires/${publicId}`);
  return data;
}

export async function createQuestionnaire(title: string, description?: string): Promise<QuestionnaireDto> {
  const { data } = await api.post<QuestionnaireDto>('/trainer/questionnaires', { title, description });
  return data;
}

export async function updateQuestionnaire(publicId: string, payload: {
  title: string;
  description?: string | null;
  isActive: boolean;
  isDefault: boolean;
  questions: UpdateQuestionDto[];
}): Promise<QuestionnaireDto> {
  const { data } = await api.put<QuestionnaireDto>(`/trainer/questionnaires/${publicId}`, { publicId, ...payload });
  return data;
}

export async function deleteQuestionnaire(publicId: string): Promise<void> {
  await api.delete(`/trainer/questionnaires/${publicId}`);
}

export interface ResponseAnswerDto {
  questionPublicId: string;
  questionLabel: string;
  questionType: string;
  mappedField?: string | null;
  valueText?: string | null;
  valueNumber?: number | null;
  valueJson?: string | null;
  fileUrl?: string | null;
}

export interface ClientResponseDto {
  responsePublicId: string;
  questionnaireTitle: string;
  submittedAt?: string | null;
  answerCount: number;
  answers: ResponseAnswerDto[];
}

export interface ClientResponseItem {
  responsePublicId: string;
  questionnaireTitle: string;
  status: string;
  submittedAt?: string | null;
  dateCreated: string;
  answerCount: number;
  answers: ResponseAnswerDto[];
}

export interface ClientResponsesDto {
  responses: ClientResponseItem[];
}

export async function assignQuestionnaire(clientPublicId: string, questionnairePublicId: string): Promise<void> {
  await api.post<void>(`/trainer/clients/${clientPublicId}/assign-questionnaire`, { questionnairePublicId });
}

export async function cancelQuestionnaire(clientPublicId: string): Promise<void> {
  await api.post<void>(`/trainer/clients/${clientPublicId}/cancel-questionnaire`);
}

export async function replaceQuestionnaire(clientPublicId: string, questionnairePublicId: string): Promise<void> {
  await api.post<void>(`/trainer/clients/${clientPublicId}/replace-questionnaire`, { questionnairePublicId });
}

/** @deprecated Use getClientQuestionnaireResponses (plural) instead */
export async function getClientQuestionnaireResponse(clientId: string): Promise<ClientResponseDto> {
  const { data } = await api.get<ClientResponseDto>(`/trainer/clients/${clientId}/questionnaire-response`);
  return data;
}

export async function getClientQuestionnaireResponses(clientId: string): Promise<ClientResponsesDto> {
  const { data } = await api.get<ClientResponsesDto>(`/trainer/clients/${clientId}/questionnaire-responses`);
  return data;
}
