import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import {
  listSectionTemplates,
  createSectionTemplate,
  updateSectionTemplate,
  deleteSectionTemplate,
} from '@/api/sectionTemplates';
import type { SectionTemplateResponse } from '@/api/sectionTemplates';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { PageHeader } from '@/components/layout';
import { Button, Dialog, SearchInput } from '@/components/ui';
import { Pagination } from '@/components/data';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { showApiError, showSuccess } from '@/lib/api-errors';
import { INPUT_CLASS_SM } from '@/lib/styles';

const PAGE_SIZE = 50;

// ── Zod schema for create/edit dialog ──────────────────────────────────────

const templateSchema = z.object({
  name: z.string().min(1).max(200),
});
type TemplateFormValues = z.infer<typeof templateSchema>;

// ── Dialog component ────────────────────────────────────────────────────────

interface TemplateDialogProps {
  open: boolean;
  template: SectionTemplateResponse | null;
  onClose: () => void;
  onSaved: () => void;
}

function TemplateDialog({ open, template, onClose, onSaved }: TemplateDialogProps) {
  const { t } = useTranslation();
  const isEditing = template !== null;

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: { name: '' },
    values: template ? { name: template.name } : undefined,
  });

  const createMutation = useApiMutation(
    (values: TemplateFormValues) =>
      createSectionTemplate({
        name: values.name,
        defaultFormat: null,
        defaultFormatConfig: null,
        defaultExercises: [],
      }),
    {
      successKey: 'training.template.created',
      errorKey: 'training.template.createError',
      onSuccess: () => {
        onSaved();
        onClose();
        form.reset();
      },
    },
  );

  const updateMutation = useApiMutation(
    (values: TemplateFormValues) => {
      if (!template) return Promise.reject(new Error('no template'));
      return updateSectionTemplate(template.templateId, {
        name: values.name,
        defaultFormat: template.defaultFormat,
        defaultFormatConfig: template.defaultFormatConfig,
        defaultExercises: template.defaultExercises,
        version: template.version,
      });
    },
    {
      successKey: 'training.template.updated',
      errorKey: 'training.template.updateError',
      onSuccess: () => {
        onSaved();
        onClose();
      },
    },
  );

  const handleSubmit = form.handleSubmit((values) => {
    if (isEditing) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? t('training.template.editTitle') : t('training.template.createTitle')}
      maxWidth={440}
      footer={
        <>
          <Button onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isPending}>
            {isPending ? t('common.saving') : isEditing ? t('common.save') : t('common.create')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-text2">
            {t('training.template.nameLabel')}
          </label>
          <input
            {...form.register('name')}
            className={INPUT_CLASS_SM}
            placeholder={t('training.template.namePlaceholder')}
            autoFocus
          />
          {form.formState.errors.name && (
            <span className="text-[11px] text-red">{form.formState.errors.name.message}</span>
          )}
        </div>

        {isEditing && (
          <p className="text-[11px] text-text3">
            {t('training.template.savedAt', {
              date: new Date(template.updatedAt).toLocaleDateString(),
            })}
          </p>
        )}
      </form>
    </Dialog>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function SectionTemplatesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SectionTemplateResponse | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300, () => setPage(1));

  const { data, isLoading } = useQuery({
    queryKey: ['section-templates', page, debouncedSearch],
    queryFn: () => listSectionTemplates({ page, pageSize: PAGE_SIZE }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['section-templates'] });
  };

  const deleteMutation = useApiMutation(deleteSectionTemplate, {
    successKey: 'training.template.deleted',
    errorKey: 'training.template.deleteError',
    onSuccess: invalidate,
  });

  const confirmDelete = useConfirmDelete(deleteMutation);

  const totalPages = data ? Math.ceil((data.totalCount ?? 0) / PAGE_SIZE) : 0;

  // Client-side search filter (server doesn't filter by name yet)
  const filteredTemplates = (data?.templates ?? []).filter((tpl) =>
    debouncedSearch
      ? tpl.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      : true,
  );

  const openCreate = () => {
    setEditingTemplate(null);
    setDialogOpen(true);
  };

  const openEdit = (tpl: SectionTemplateResponse) => {
    setEditingTemplate(tpl);
    setDialogOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, tpl: SectionTemplateResponse) => {
    e.stopPropagation();
    confirmDelete.requestDelete(tpl.templateId, tpl.name);
  };

  const formatLabel = (format: string | null): string => {
    if (!format || format === 'Standard') return '';
    return t(`training.format.${format.charAt(0).toLowerCase() + format.slice(1)}`);
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

      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-3 px-20 py-2 border-b border-border bg-bg">
        <SearchInput
          placeholder={t('training.template.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[280px]"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-20 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-text3">
              {t('common.loading')}
            </div>
          ) : !filteredTemplates.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-text3">
              <span className="text-4xl">📋</span>
              <p className="mt-3 text-sm">{t('training.template.noTemplates')}</p>
              <p className="mt-1 text-xs text-text3">{t('training.template.noTemplatesHint')}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                {filteredTemplates.map((tpl) => (
                  <div
                    key={tpl.templateId}
                    className="flex items-center gap-3 px-4 py-3 rounded-md border border-border bg-bg hover:border-border-md hover:bg-bg2 cursor-pointer transition-colors"
                    onClick={() => openEdit(tpl)}
                  >
                    {/* Icon */}
                    <div
                      className="shrink-0 h-9 w-9 rounded-md flex items-center justify-center text-sm"
                      style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
                    >
                      📋
                    </div>

                    {/* Name + format chip */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-text truncate">{tpl.name}</div>
                      <div className="text-[11px] text-text3 mt-0.5 flex items-center gap-2">
                        {tpl.defaultFormat && tpl.defaultFormat !== 'Standard' ? (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
                          >
                            {formatLabel(tpl.defaultFormat)}
                          </span>
                        ) : null}
                        <span>
                          {t('training.template.exerciseCount', {
                            count: tpl.defaultExercises.length,
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Updated-at */}
                    <span className="shrink-0 text-[11px] text-text3">
                      {new Date(tpl.updatedAt).toLocaleDateString()}
                    </span>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(e, tpl)}
                      disabled={deleteMutation.isPending}
                      className="shrink-0 rounded-sm p-1 text-text3 transition-colors hover:text-red disabled:opacity-30"
                      title={t('common.delete')}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <Pagination
                page={page}
                totalPages={totalPages}
                totalCount={data?.totalCount ?? 0}
                onPageChange={setPage}
                className="mt-3"
              />
            </>
          )}
        </div>
      </div>

      {/* Create / Edit dialog */}
      <TemplateDialog
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
