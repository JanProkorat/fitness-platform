import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { NutritionPlanTemplateSummaryDto } from '@/api/nutrition-plan-templates';
import GoalDot from '@/components/plan-templates/GoalDot';
import PlanTemplateRowMenu from '@/components/plan-templates/PlanTemplateRowMenu';
import DeletePlanTemplateDialog from '@/components/plan-templates/DeletePlanTemplateDialog';
import { useCopyPlanTemplate } from '@/hooks/usePlanTemplatesQueries';

const SKELETON_ROW_COUNT = 5;
const COLUMN_COUNT = 8;
const EMPTY_VALUE = '—';
const DAY_MS = 24 * 60 * 60 * 1000;
/** Edits older than this show a calendar date instead of a relative phrase. */
const RELATIVE_DAYS_LIMIT = 7;

const HEAD_CLASS = 'px-4 py-3.5 text-meta font-semibold';
const CELL_CLASS = 'px-4 py-2.75';

interface Props {
  templates: NutritionPlanTemplateSummaryDto[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  hasActiveFilter: boolean;
  onClearFilters: () => void;
}

function editedLabel(iso: string | undefined, language: string): string {
  if (!iso) {
    return EMPTY_VALUE;
  }
  const edited = new Date(iso);
  const now = new Date();
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysAgo = Math.round((startOfDay(now) - startOfDay(edited)) / DAY_MS);
  if (daysAgo >= 0 && daysAgo < RELATIVE_DAYS_LIMIT) {
    return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-daysAgo, 'day');
  }
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(edited);
}

/** The Plan templates table: one row per template with goal, length, kcal, meals, usage and edit date. */
export default function PlanTemplatesTable({
  templates,
  isPending,
  isError,
  onRetry,
  hasActiveFilter,
  onClearFilters,
}: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const copyMutation = useCopyPlanTemplate();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const numberFormat = new Intl.NumberFormat(i18n.language);

  function openTemplate(templateId: string | undefined) {
    if (templateId) {
      navigate(`/plan-templates/${templateId}`);
    }
  }

  return (
    <>
      <Table className="min-w-280">
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow>
            <TableHead className={HEAD_CLASS}>{t('planTemplates.table.columnTemplate')}</TableHead>
            <TableHead className={`w-44 ${HEAD_CLASS}`}>{t('planTemplates.table.columnGoal')}</TableHead>
            <TableHead className={`w-28 ${HEAD_CLASS}`}>{t('planTemplates.table.columnLength')}</TableHead>
            <TableHead className={`w-36 ${HEAD_CLASS}`}>{t('planTemplates.table.columnAvgPerDay')}</TableHead>
            <TableHead className={`w-28 ${HEAD_CLASS}`}>{t('planTemplates.table.columnMealsPerDay')}</TableHead>
            <TableHead className={`w-24 ${HEAD_CLASS}`}>{t('planTemplates.table.columnUsedBy')}</TableHead>
            <TableHead className={`w-32 ${HEAD_CLASS}`}>{t('planTemplates.table.columnEdited')}</TableHead>
            <TableHead className="w-12 px-4 py-3.5">
              <span className="sr-only">{t('planTemplates.table.columnActions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending &&
            Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
              <TableRow key={index}>
                <TableCell colSpan={COLUMN_COUNT}>
                  <Skeleton className="h-10 w-full" />
                </TableCell>
              </TableRow>
            ))}

          {!isPending && isError && (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="py-10 text-center">
                <div className="flex flex-col items-center gap-3">
                  <p className="text-body text-muted-foreground">{t('common.loadError')}</p>
                  <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                    {t('planTemplates.retry')}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}

          {!isPending && !isError && templates.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="py-10 text-center">
                <div className="flex flex-col items-center gap-2">
                  <p className="text-body text-muted-foreground">{t('planTemplates.noResultsForFilters')}</p>
                  {hasActiveFilter && (
                    <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
                      {t('planTemplates.clearFilters')}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}

          {!isPending &&
            !isError &&
            templates.map((template) => {
              const templateId = template.templateId ?? '';
              const name = template.name ?? '';
              const avgKcal = template.avgKcalPerDay;
              return (
                <TableRow
                  key={templateId}
                  className="cursor-pointer border-line"
                  onClick={() => openTemplate(templateId)}
                >
                  <TableCell className={CELL_CLASS}>
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-nutrition-soft text-nutrition-ink">
                        <CalendarDays className="size-4.5" aria-hidden="true" />
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <Link
                          to={`/plan-templates/${templateId}`}
                          className="text-copy font-semibold text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {name}
                        </Link>
                        {template.description && (
                          <span className="truncate text-meta text-muted-foreground">{template.description}</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={CELL_CLASS}>
                    {template.goal ? (
                      <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-meta font-semibold">
                        <GoalDot goal={template.goal} />
                        {t(`nutritionGoals.goal_${template.goal}`)}
                      </Badge>
                    ) : template.isOwnedByCurrentUser ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-full border-dashed px-2.5 text-meta font-semibold text-muted-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          openTemplate(templateId);
                        }}
                      >
                        {t('planTemplates.table.setGoal')}
                      </Button>
                    ) : (
                      <span className="text-body text-muted-foreground">{EMPTY_VALUE}</span>
                    )}
                  </TableCell>
                  <TableCell className={`${CELL_CLASS} text-body text-ink`}>
                    {t('planTemplates.table.weeks', { count: template.weekCount ?? 0 })}
                  </TableCell>
                  <TableCell className={`${CELL_CLASS} text-copy`}>
                    {avgKcal ? (
                      <>
                        <span className="font-semibold text-ink">{numberFormat.format(avgKcal)}</span>{' '}
                        <span className="text-ink-2">{t('planTemplates.table.kcalUnit')}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">{EMPTY_VALUE}</span>
                    )}
                  </TableCell>
                  <TableCell className={`${CELL_CLASS} text-body text-ink`}>
                    {template.mealsPerDay ?? EMPTY_VALUE}
                  </TableCell>
                  <TableCell className={`${CELL_CLASS} text-body text-ink`}>
                    {template.usedBy ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        {template.usedBy}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{EMPTY_VALUE}</span>
                    )}
                  </TableCell>
                  <TableCell className={`${CELL_CLASS} text-body text-muted-foreground`}>
                    {editedLabel(template.dateUpdated ?? template.dateCreated, i18n.language)}
                  </TableCell>
                  <TableCell className={CELL_CLASS}>
                    <PlanTemplateRowMenu
                      templateName={name}
                      canDelete={template.isOwnedByCurrentUser === true}
                      onOpen={() => openTemplate(templateId)}
                      onCopy={() => copyMutation.mutate(templateId)}
                      onDelete={() => setDeleteTarget({ id: templateId, name })}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
      {deleteTarget && (
        <DeletePlanTemplateDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
            }
          }}
          templateId={deleteTarget.id}
          templateName={deleteTarget.name}
        />
      )}
    </>
  );
}
