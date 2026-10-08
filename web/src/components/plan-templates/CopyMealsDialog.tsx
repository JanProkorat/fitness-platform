import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { EditorDocument } from '@/components/plan-editor/plan-editor-types';
import { toEditorDocument } from '@/hooks/usePlanTemplateEditor';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLoadPlanTemplate, usePlanTemplateSources } from '@/hooks/usePlanTemplatesQueries';
import { getErrorStatus } from '@/lib/api-errors';

type PickError = 'gone' | 'empty' | 'failed';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The template being edited; it is never offered as a source. */
  currentTemplateId: string | undefined;
  onApply: (source: EditorDocument) => void;
}

/** Lists the user's other templates; picking one hands its first week to the editor to copy. */
export default function CopyMealsDialog({ open, onOpenChange, currentTemplateId, onApply }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [pickError, setPickError] = useState<PickError | null>(null);
  const debounced = useDebouncedValue(search.trim());
  const sources = usePlanTemplateSources(debounced, open);
  const load = useLoadPlanTemplate();
  const templates = (sources.data?.templates ?? []).filter((template) => template.templateId !== currentTemplateId);

  function pick(templateId: string) {
    setPickError(null);
    load.mutate(templateId, {
      onSuccess: (detail) => {
        const source = toEditorDocument(detail);
        const hasMeals = source.weeks[0]?.days.some((day) => day.meals.length > 0) ?? false;
        if (hasMeals) {
          onApply(source);
        } else {
          setPickError('empty');
        }
      },
      onError: (error) => {
        const status = getErrorStatus(error);
        setPickError(status === 404 || status === 403 ? 'gone' : 'failed');
        if (status === 404 || status === 403) {
          void queryClient.invalidateQueries({ queryKey: ['plan-templates'] });
        }
      },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPickError(null);
          setSearch('');
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('planEditor.copyMeals.title')}</DialogTitle>
          <DialogDescription>{t('planEditor.copyMeals.body')}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('planEditor.copyMeals.search')}
            aria-label={t('planEditor.copyMeals.search')}
            className="h-10 pl-10"
          />
        </div>

        {pickError && (
          <p role="alert" className="rounded-xl border border-error bg-error-soft px-4 py-3 text-body text-error">
            {t(`planEditor.copyMeals.error_${pickError}`)}
          </p>
        )}

        <div className="flex max-h-96 min-h-40 flex-col gap-2 overflow-y-auto">
          {sources.isPending ? (
            <>
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </>
          ) : sources.isError ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-body text-muted-foreground">{t('planEditor.copyMeals.loadError')}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void sources.refetch()}>
                {t('planTemplates.retry')}
              </Button>
            </div>
          ) : templates.length === 0 ? (
            <p className="m-auto text-body text-muted-foreground">{t('planEditor.copyMeals.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {templates.map((template) => (
                <li key={template.templateId}>
                  <button
                    type="button"
                    disabled={load.isPending}
                    onClick={() => template.templateId && pick(template.templateId)}
                    className="flex w-full cursor-pointer flex-col gap-0.5 rounded-xl border border-line bg-card px-4 py-3 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className="truncate text-copy font-semibold text-ink">{template.name}</span>
                    <span className="text-meta text-muted-foreground">
                      {t('planEditor.copyMeals.summary', {
                        weeks: template.weekCount ?? 0,
                        meals: template.mealsPerDay ?? 0,
                      })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
