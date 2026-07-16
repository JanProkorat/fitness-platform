import { useTranslation } from 'react-i18next';
import type { PublicWorkoutTemplateResponse } from '@/api/generated';
import type { WorkoutFormat as WorkoutFormatType } from '@/api/training-plan-types';
import { Card, CardBody, CardPropRow } from '@/components/data';
import { FORMAT_LABEL_KEYS, FORMAT_BG_COLORS, FORMAT_COLORS } from '@/constants/training';
import { resolveLocalizedTemplateName } from '@/lib/training-plan-format';

interface PublicWorkoutTemplateCardProps {
  template: PublicWorkoutTemplateResponse;
  onClick: () => void;
}

/**
 * Card tile for a single public workout template in the read-only
 * "Template library" section on the section-templates page. Mirrors the
 * visual language of the trainer's own-template cards (cover + format
 * chip + name overlay) so the two card families read as one system.
 */
export function PublicWorkoutTemplateCard({ template, onClick }: PublicWorkoutTemplateCardProps) {
  const { t, i18n } = useTranslation();

  const fmt = ((template.format ?? 'Standard') as WorkoutFormatType);
  const displayName = resolveLocalizedTemplateName(
    template.name ?? '',
    template.localizedNames,
    i18n.language,
  );
  const sections = template.sections ?? [];
  const sectionCount = sections.length;
  const exerciseCount = sections.reduce((sum, s) => sum + (s.exercises?.length ?? 0), 0);
  const durationMinutes = template.estimatedDurationMinutes;

  return (
    <Card onClick={onClick}>
      <div className="relative h-40 w-full overflow-hidden rounded-t-md bg-bg3">
        <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-40">
          🏋️
        </div>
        <div className="absolute top-2 right-2 inline-flex items-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm">
          <span
            className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: FORMAT_BG_COLORS[fmt], color: FORMAT_COLORS[fmt] }}
          >
            {t(`training.format.${FORMAT_LABEL_KEYS[fmt]}`)}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pb-2 pt-10">
          <div className="truncate text-[13px] font-bold text-white leading-tight [text-shadow:_0_1px_2px_rgba(0,0,0,0.6)]">
            {displayName}
          </div>
        </div>
      </div>
      <CardBody>
        {template.difficulty && (
          <CardPropRow label={t('exercises.difficulty')}>
            {t(`enums.difficulty.${template.difficulty}`)}
          </CardPropRow>
        )}
        <CardPropRow label={t('training.template.colExercises')}>
          {exerciseCount}
        </CardPropRow>
        <CardPropRow label={t('training.template.library.colSections')}>
          {sectionCount}
        </CardPropRow>
        <CardPropRow label={t('training.template.colDuration')}>
          {durationMinutes ? t('training.template.library.durationMinutes', { count: durationMinutes }) : '—'}
        </CardPropRow>
      </CardBody>
    </Card>
  );
}
