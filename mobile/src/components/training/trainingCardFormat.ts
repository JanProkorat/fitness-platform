import type { TrainingSession, TrainingSection } from '@/api/training'

// ─── Section fallback ──────────────────────────────────────────────────────────

/**
 * If a session has no sections (legacy flat plan not yet backfilled),
 * synthesize a single default section wrapping all flat exercises.
 * This matches the schema-on-read semantics of WithBackfilledSections on the backend.
 */
export function getEffectiveSections(
  session: TrainingSession,
  t: (key: string) => string,
): TrainingSection[] {
  if (session.sections && session.sections.length > 0) {
    return session.sections
  }
  // Fallback: wrap flat exercises in a single default section
  const exercises = session.exercises ?? []
  if (exercises.length === 0) return []
  return [
    {
      sectionId: 'default',
      order: 0,
      name: t('training.section.defaultName'),
      format: undefined,
      formatConfig: undefined,
      exercises,
    },
  ]
}
