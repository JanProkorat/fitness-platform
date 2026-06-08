import api from '@/lib/api';

/**
 * On-track verdict for a client as assessed by the trainer dashboard.
 * Mirrors backend ClientVerdict enum.
 */
export type ClientVerdict = 'OnTrack' | 'NeedsAttention' | 'OffTrack';

/**
 * Direction a client's weight is moving relative to their target.
 * Mirrors backend WeightDirection enum.
 */
export type WeightDirection = 'Towards' | 'Away' | 'Stable';

/**
 * Response from GET /trainer/clients/{clientId}/verdict.
 * NOTE: generated.ts does not yet contain this type — regen-api
 * must be run once the backend is accessible on :5001 (epic branch).
 * Until then this hand-authored mirror of GetClientVerdictResponse.cs
 * is the source of truth for the web client.
 */
export interface ClientVerdictResponse {
  verdict: ClientVerdict;
  /** Nutrition plan compliance percent (0-100), or null when no active plan. */
  compliancePercent: number | null;
  /** Delta between current weight and target weight in kg, positive = above target. */
  weightDeltaToGoal: number | null;
  /** Direction the weight is moving relative to the goal. */
  weightDirection: WeightDirection;
  /** Sessions completed this ISO week, or null when no active training plan. */
  trainingFrequencyActual: number | null;
  /** Sessions prescribed per week in active training plan, or null. */
  trainingFrequencyPrescribed: number | null;
  /** UTC timestamp of the most recent activity, or null. */
  lastActiveAt: string | null;
  /** Number of personal records achieved in the current calendar month. */
  prCountThisMonth: number;
}

/** Fetch the on-track verdict for a client. */
export async function getClientVerdict(
  clientId: string,
): Promise<ClientVerdictResponse> {
  const { data } = await api.get<ClientVerdictResponse>(
    `/trainer/clients/${clientId}/verdict`,
  );
  return data;
}
