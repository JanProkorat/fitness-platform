import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  listSectionTemplates,
  deleteSectionTemplate,
} from '@/api/sectionTemplates';
import type { WorkoutTemplateResponse } from '@/api/sectionTemplates';
import type { WorkoutFormat as WorkoutFormatType, WodConfig } from '@/api/training-plan-types';
import { FORMAT_LABEL_KEYS, FORMAT_BG_COLORS, FORMAT_COLORS } from '@/constants/training';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { PageHeader, Toolbar } from '@/components/layout';
import type { ToolbarView } from '@/components/layout';
import { Button, SearchInput } from '@/components/ui';
import { Pagination, ListView, CardGrid, Card, CardBody, CardPropRow, DatabaseTable } from '@/components/data';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { WorkoutDialog } from '@/components/training/WorkoutDialog';
import { estimatedSectionDurationSeconds, formatDurationCompact } from '@/lib/training-plan-format';

// ── Constants ───────────────────────────────────────────────────────────────

const ALL_FORMATS: WorkoutFormatType[] = ['Standard', 'AMRAP', 'EMOM', 'Tabata', 'ForTime'];

const PAGE_SIZE = 20;

const filterClass = 'rounded-md border border-border-md bg-bg px-3 py-[6px] text-[13px] text-text outline-none transition-colors focus:border-border-hv';

// ── Page ────────────────────────────────────────────────────────────────────

export default function SectionTemplatesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  type ViewType = 'table' | 'list' | 'cards';
  const [view, setView] = useState<ViewType>('table');
  const VIEWS: ToolbarView[] = [
    { id: 'table', label: t('common.viewTable'), icon: '⊞' },
    { id: 'list',  label: t('common.viewList'),  icon: '☰' },
    { id: 'cards', label: t('common.viewCards'), icon: '⬜' },
  ];

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState<string>('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplateResponse | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300, () => setPage(1));

  // Single query loads all templates (backend cap: 200). Filters +
  // pagination are applied client-side — same visual UX as ExercisesPage
  // but no backend search/filter calls per keystroke. Query key shared
  // with TrainingPlanPage's own workout-templates query (see that page's
  // ['workout-templates'] key) so a create/update/delete here cascades an
  // invalidation there too, and vice versa.
  const { data, isLoading } = useQuery({
    queryKey: ['workout-templates'],
    queryFn: () => listSectionTemplates(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['workout-templates'] });
  };

  const deleteMutation = useApiMutation(deleteSectionTemplate, {
    successKey: 'training.template.deleted',
    errorKey: 'training.template.deleteError',
    onSuccess: invalidate,
  });

  const confirmDelete = useConfirmDelete(deleteMutation);

  // Filter → paginate
  const { totalCount, totalPages, pageItems } = useMemo(() => {
    const all = data ?? [];
    const q = debouncedSearch.trim().toLowerCase();
    const filtered = all.filter((tpl) => {
      if (q && !(tpl.name ?? '').toLowerCase().includes(q)) return false;
      if (formatFilter) {
        const f = tpl.defaultFormat ?? 'Standard';
        if (f !== formatFilter) return false;
      }
      return true;
    });
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const start = (page - 1) * PAGE_SIZE;
    return {
      totalCount: total,
      totalPages: pages,
      pageItems: filtered.slice(start, start + PAGE_SIZE),
    };
  }, [data, debouncedSearch, formatFilter, page]);

  const openCreate = () => {
    setEditingTemplate(null);
    setDialogOpen(true);
  };

  const openEdit = (tpl: WorkoutTemplateResponse) => {
    setEditingTemplate(tpl);
    setDialogOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, tpl: WorkoutTemplateResponse) => {
    e.stopPropagation();
    if (tpl.templateId) {
      confirmDelete.requestDelete(tpl.templateId, tpl.name ?? '');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon="📋"
        title={t('training.template.pageTitle')}
        subtitle={t('training.template.pageSubtitle')}
        actions={
          <Button variant="primary" onClick={openCreate}>
            + {t('training.template.addTemplate')}
          </Button>
        }
      />

      <Toolbar
        views={VIEWS}
        activeView={view}
        onViewChange={(id) => setView(id as ViewType)}
        className="px-6 py-1.5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            placeholder={t('training.template.search')}
            aria-label={t('training.template.searchAriaLabel')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[240px]"
          />
          <select
            value={formatFilter}
            onChange={(e) => { setFormatFilter(e.target.value); setPage(1); }}
            className={filterClass}
            aria-label={t('training.template.formatFilterAriaLabel')}
          >
            <option value="">{t('training.template.allFormats')}</option>
            {ALL_FORMATS.map((f) => (
              <option key={f} value={f}>{t(`training.format.${FORMAT_LABEL_KEYS[f]}`)}</option>
            ))}
          </select>
        </div>
      </Toolbar>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-3">
        {/* Templates content — branches on view (table / list / cards) */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-text3">
            {t('common.loading')}
          </div>
        ) : !pageItems.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-text3">
            <span className="text-4xl">📋</span>
            <p className="mt-3 text-sm">{t('training.template.noTemplates')}</p>
            <p className="mt-1 text-xs text-text3">{t('training.template.noTemplatesHint')}</p>
          </div>
        ) : view === 'table' ? (
          <>
            <DatabaseTable
              columns={[
                {
                  key: 'icon', label: '', width: '52px',
                  render: () => (
                    <div className="h-10 w-10 rounded-sm bg-bg3 flex items-center justify-center text-sm shrink-0" aria-hidden="true">
                      📋
                    </div>
                  ),
                },
                { key: 'name', label: t('training.template.colName'), render: (tpl) => tpl.name },
                {
                  key: 'format', label: t('training.template.colFormat'), width: '140px',
                  render: (tpl) => {
                    const fmt = ((tpl.defaultFormat ?? 'Standard') as WorkoutFormatType);
                    return (
                      <span
                        className="inline-flex rounded-sm px-1.5 py-[1px] text-[10px] font-semibold"
                        style={{ background: FORMAT_BG_COLORS[fmt], color: FORMAT_COLORS[fmt] }}
                      >
                        {t(`training.format.${FORMAT_LABEL_KEYS[fmt]}`)}
                      </span>
                    );
                  },
                },
                {
                  key: 'exercises', label: t('training.template.colExercises'), width: '90px',
                  render: (tpl) => <span className="tabular-nums">{tpl.defaultExercises?.length ?? 0}</span>,
                },
                {
                  key: 'duration', label: t('training.template.colDuration'), width: '110px',
                  render: (tpl) => {
                    const fmt = ((tpl.defaultFormat ?? 'Standard') as WorkoutFormatType);
                    const dur = estimatedSectionDurationSeconds(fmt, tpl.defaultFormatConfig as WodConfig | null | undefined);
                    return <span className="tabular-nums">{dur != null && dur > 0 ? formatDurationCompact(dur) : '—'}</span>;
                  },
                },
                {
                  key: 'updated', label: t('training.template.colUpdated'), width: '120px',
                  render: (tpl) => (
                    <span className="text-text3 tabular-nums">
                      {tpl.updatedAt ? new Date(tpl.updatedAt).toLocaleDateString() : '—'}
                    </span>
                  ),
                },
              ]}
              rows={pageItems}
              rowKey={(tpl) => tpl.templateId ?? tpl.name ?? ''}
              onRowClick={(tpl) => openEdit(tpl)}
              renderRowActions={(tpl) => (
                <button
                  onClick={(e) => handleDeleteClick(e, tpl)}
                  disabled={deleteMutation.isPending}
                  className="rounded-sm p-1 text-text3 transition-colors hover:text-red disabled:cursor-not-allowed disabled:opacity-30"
                  title={t('common.delete')}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            />
            <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onPageChange={setPage} className="mt-3" />
          </>
        ) : view === 'list' ? (
          <>
            <ListView
              items={pageItems}
              itemKey={(tpl) => tpl.templateId ?? tpl.name ?? ''}
              onItemClick={(tpl) => openEdit(tpl)}
              renderAvatar={() => (
                <div className="w-10 h-10 rounded-sm flex items-center justify-center text-sm shrink-0" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                  📋
                </div>
              )}
              renderInfo={(tpl) => {
                const fmt = ((tpl.defaultFormat ?? 'Standard') as WorkoutFormatType);
                const exerciseCount = tpl.defaultExercises?.length ?? 0;
                const durationSec = estimatedSectionDurationSeconds(
                  fmt,
                  tpl.defaultFormatConfig as WodConfig | null | undefined,
                );
                return (
                  <div>
                    <div className="text-[13px] font-medium text-text truncate">{tpl.name}</div>
                    <div className="text-[11px] text-text3 flex items-center gap-2 mt-0.5">
                      <span
                        className="inline-flex rounded-sm px-1.5 py-[1px] text-[10px] font-semibold"
                        style={{ background: FORMAT_BG_COLORS[fmt], color: FORMAT_COLORS[fmt] }}
                      >
                        {t(`training.format.${FORMAT_LABEL_KEYS[fmt]}`)}
                      </span>
                      <span className="tabular-nums">
                        {t('training.template.exerciseCount', { count: exerciseCount })}
                        {durationSec != null && durationSec > 0 && <> · ≈ {formatDurationCompact(durationSec)}</>}
                      </span>
                    </div>
                  </div>
                );
              }}
              renderRight={(tpl) =>
                tpl.updatedAt ? (
                  <span className="text-[11px] text-text3 tabular-nums">
                    {new Date(tpl.updatedAt).toLocaleDateString()}
                  </span>
                ) : null
              }
              renderActions={(tpl) => (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteClick(e, tpl); }}
                  disabled={deleteMutation.isPending}
                  className="rounded-sm p-1 text-text3 transition-colors hover:text-red"
                  title={t('common.delete')}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            />
            <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onPageChange={setPage} className="mt-3" />
          </>
        ) : (
          <>
            <CardGrid>
              {pageItems.map((tpl) => {
                const fmt = ((tpl.defaultFormat ?? 'Standard') as WorkoutFormatType);
                const exerciseCount = tpl.defaultExercises?.length ?? 0;
                const durationSec = estimatedSectionDurationSeconds(
                  fmt,
                  tpl.defaultFormatConfig as WodConfig | null | undefined,
                );
                return (
                  <Card key={tpl.templateId} onClick={() => openEdit(tpl)}>
                    {/* Tall cover area with emoji + name overlay */}
                    <div className="relative h-40 w-full overflow-hidden rounded-t-md bg-bg3">
                      <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-40">
                        📋
                      </div>
                      {/* Format chip — top-right */}
                      <div className="absolute top-2 right-2 inline-flex items-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm">
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{ background: FORMAT_BG_COLORS[fmt], color: FORMAT_COLORS[fmt] }}
                        >
                          {t(`training.format.${FORMAT_LABEL_KEYS[fmt]}`)}
                        </span>
                      </div>
                      {/* Gradient + name overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pb-2 pt-10">
                        <div className="truncate text-[13px] font-bold text-white leading-tight [text-shadow:_0_1px_2px_rgba(0,0,0,0.6)]">
                          {tpl.name}
                        </div>
                      </div>
                    </div>
                    <CardBody>
                      <CardPropRow label={t('training.template.colExercises')}>
                        {exerciseCount}
                      </CardPropRow>
                      <CardPropRow label={t('training.template.colDuration')}>
                        {durationSec != null && durationSec > 0 ? formatDurationCompact(durationSec) : '—'}
                      </CardPropRow>
                      {tpl.updatedAt && (
                        <CardPropRow label={t('training.template.colUpdated')}>
                          {new Date(tpl.updatedAt).toLocaleDateString()}
                        </CardPropRow>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </CardGrid>
            <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onPageChange={setPage} className="mt-3" />
          </>
        )}
        </div>
      </div>

      {/* Create / Edit dialog */}
      <WorkoutDialog
        open={dialogOpen}
        template={editingTemplate}
        onClose={() => {
          setDialogOpen(false);
          setEditingTemplate(null);
        }}
        onSaved={invalidate}
      />

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        isOpen={!!confirmDelete.target}
        name={confirmDelete.target?.name ?? ''}
        isPending={confirmDelete.isPending}
        onConfirm={confirmDelete.confirmDelete}
        onCancel={confirmDelete.cancelDelete}
        title={t('training.template.deleteConfirmTitle')}
        message={
          confirmDelete.target
            ? t('training.template.deleteConfirmMessage', { name: confirmDelete.target.name })
            : undefined
        }
      />
    </div>
  );
}
