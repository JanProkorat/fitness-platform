import api from '@/lib/api';

/**
 * Structured payload present on `personal_record` timeline items.
 * The swagger schema does not surface this field (additionalProperties: false
 * on the NSwag-generated contract), so it is declared here in the hand-written
 * API module. The backend serialises the full object; this interface mirrors
 * GetClientTimelineResponse.cs > PersonalRecordPayload.
 */
export interface PersonalRecordPayload {
  externalId: string;
  exerciseExternalId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  workoutLogId: string;
}

/** A single entry in a client's activity timeline. */
export interface ClientTimelineItem {
  id: string;
  type:
    | 'meal_day'
    | 'workout'
    | 'measurement'
    | 'questionnaire'
    | 'nutrition_plan_published'
    | 'training_plan_published'
    | 'linked'
    | 'personal_record';
  occurredAt: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  /** Populated only when type === 'personal_record'. */
  personalRecord?: PersonalRecordPayload | null;
}

export interface ClientTimelineResponse {
  items: ClientTimelineItem[];
}

/**
 * Fetches a client's activity timeline (trainer-facing).
 * Returns items ordered newest-first.
 */
export async function getClientTimeline(
  clientId: string,
  limit = 30,
): Promise<ClientTimelineResponse> {
  const { data } = await api.get<ClientTimelineResponse>(
    `/trainer/clients/${clientId}/timeline`,
    { params: { limit } },
  );
  return data;
}
