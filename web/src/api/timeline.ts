import api from '@/lib/api';

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
    | 'linked';
  occurredAt: string;
  title: string;
  description?: string | null;
  icon?: string | null;
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
