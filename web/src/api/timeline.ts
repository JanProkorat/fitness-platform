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

/** Payload of a `meal_day` item. Mirrors TimelineMealDayPayload. */
export interface TimelineMealDayPayload {
  mealsLogged: number;
  /** Null when the day's plan was not authored by the caller or has no planned meals. */
  mealsPlanned?: number | null;
}

/** Payload of a `workout` item. Mirrors TimelineWorkoutPayload. */
export interface TimelineWorkoutPayload {
  sessionExecutionId: string;
  /** Null for ad-hoc workouts and for plans the caller did not author. */
  sessionName?: string | null;
  exerciseCount: number;
}

/** Payload of a `measurement` item. Mirrors TimelineMeasurementPayload. */
export interface TimelineMeasurementPayload {
  weightKg?: number | null;
  bodyFatPercentage?: number | null;
}

/** Payload of a `questionnaire` item. Mirrors TimelineQuestionnairePayload. */
export interface TimelineQuestionnairePayload {
  questionnaireTitle: string;
}

/** Payload of a `nutrition_plan_published` / `training_plan_published` item. Mirrors TimelinePlanPublishedPayload. */
export interface TimelinePlanPublishedPayload {
  planId: string;
  planName?: string | null;
  weekNumber: number;
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
  /** Populated only when type === 'meal_day'. */
  mealDay?: TimelineMealDayPayload | null;
  /** Populated only when type === 'workout'. */
  workout?: TimelineWorkoutPayload | null;
  /** Populated only when type === 'measurement'. */
  measurement?: TimelineMeasurementPayload | null;
  /** Populated only when type === 'questionnaire'. */
  questionnaire?: TimelineQuestionnairePayload | null;
  /** Populated only for the two plan-published types. */
  planPublished?: TimelinePlanPublishedPayload | null;
}

export interface ClientTimelineResponse {
  items: ClientTimelineItem[];
  /** Whether the caller's link permits the nutrition-domain entries. */
  canViewNutritionPlans?: boolean;
  /** Whether the caller's link permits the training-domain entries. */
  canViewTrainingPlans?: boolean;
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
