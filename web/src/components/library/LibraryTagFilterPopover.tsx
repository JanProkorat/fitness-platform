import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCreateFoodTag, useDeleteFoodTag, useFoodTags, useUpdateFoodTag } from '@/hooks/useIngredientsQueries';
import TagFormDialog, { DEFAULT_TAG_COLOR, type TagFormValues } from '@/components/tags/TagFormDialog';
import type { FoodTagDto } from '@/api/food-types';

interface Props {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
}

/**
 * Tag multi-select for filtering the ingredients and recipes tables, plus
 * create/edit/delete affordances for the caller's tags (one list shared by
 * both libraries). Nutritionist-only — the pages never mount this for a
 * trainer-only coach. Mirrors
 * `ClientTagFilterPopover`'s create-tag pattern (`+ Create tag` reopens the
 * popover without ticking the new tag) and adds the edit/delete affordances
 * client tags don't have a UI for yet.
 */
export default function LibraryTagFilterPopover({ selectedTagIds, onChange }: Props) {
  const { t } = useTranslation();
  const tagsQuery = useFoodTags();
  const tags = tagsQuery.data ?? [];
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<FoodTagDto | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const createMutation = useCreateFoodTag();
  const updateMutation = useUpdateFoodTag();
  const deleteMutation = useDeleteFoodTag();

  // Drop ids for tags no longer owned by the caller (e.g. deleted in
  // another tab) — mirrors ClientTagFilterPopover's own pruning effect: the
  // backend safely no-ops an unknown tag id, but the picker is the layer
  // that should stop rendering a ghost selection for one.
  useEffect(() => {
    if (!tagsQuery.isSuccess) {
      return;
    }
    const validIds = new Set(tags.map((tag) => tag.tagId).filter((id): id is string => Boolean(id)));
    const pruned = selectedTagIds.filter((id) => validIds.has(id));
    if (pruned.length !== selectedTagIds.length) {
      onChange(pruned);
    }
    // Only re-run when the fetched tag set settles, not on every parent
    // re-render (`onChange`/`selectedTagIds` are recreated each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagsQuery.isSuccess, tags]);

  function toggleTag(tagId: string) {
    onChange(
      selectedTagIds.includes(tagId) ? selectedTagIds.filter((id) => id !== tagId) : [...selectedTagIds, tagId],
    );
  }

  function handleCreateClick() {
    setOpen(false);
    setEditingTag(null);
    setFormOpen(true);
  }

  function handleEditClick(tag: FoodTagDto) {
    setOpen(false);
    setEditingTag(tag);
    setFormOpen(true);
  }

  // Returns focus to the trigger button once the dialog closes.
  function handleFormCloseAutoFocus(event: Event) {
    event.preventDefault();
    triggerRef.current?.focus();
  }

  function handleSubmit(values: TagFormValues) {
    const request = { name: values.name, colorHex: values.colorHex, description: values.description || undefined };

    if (editingTag?.tagId) {
      updateMutation.mutate(
        { tagId: editingTag.tagId, request },
        {
          onSuccess: () => {
            setFormOpen(false);
            setOpen(true);
          },
        },
      );
      return;
    }

    // Reopens the filter popover on success rather than auto-selecting the new
    // tag — it has zero tagged foods yet, so auto-selecting would filter the
    // table to empty right after creation (mirrors ClientTagFilterPopover).
    createMutation.mutate(request, {
      onSuccess: () => {
        setFormOpen(false);
        setOpen(true);
      },
    });
  }

  function handleDelete() {
    if (!editingTag?.tagId) {
      return;
    }
    deleteMutation.mutate(editingTag.tagId, {
      onSuccess: () => {
        setFormOpen(false);
        setOpen(true);
      },
    });
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button ref={triggerRef} type="button" variant="outline" size="sm" className="gap-1.5 rounded-full">
            <Plus className="size-3" aria-hidden="true" />
            {t('library.tags.filter')}
            {selectedTagIds.length > 0 && <span className="text-caption">{selectedTagIds.length}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          {tagsQuery.isPending ? (
            <p className="text-body text-muted-foreground">{t('common.loading')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {tags.length === 0 ? (
                <p className="text-body text-muted-foreground">{t('library.tags.empty')}</p>
              ) : (
                <ul className="flex max-h-64 flex-col gap-2.5 overflow-y-auto">
                  {tags.map((tag) => (
                    <li key={tag.tagId} className="flex items-center gap-2">
                      <label className="flex flex-1 cursor-pointer items-center gap-2 text-body text-foreground">
                        <Checkbox
                          checked={Boolean(tag.tagId) && selectedTagIds.includes(tag.tagId ?? '')}
                          onCheckedChange={() => tag.tagId && toggleTag(tag.tagId)}
                        />
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={tag.colorHex ? { backgroundColor: tag.colorHex } : undefined}
                          aria-hidden="true"
                        />
                        {tag.name}
                      </label>
                      <button
                        type="button"
                        onClick={() => handleEditClick(tag)}
                        aria-label={t('library.tags.editTag', { name: tag.name })}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button type="button" variant="outline" size="sm" onClick={handleCreateClick}>
                <Plus className="size-3.5" aria-hidden="true" />
                {t('library.tags.createTag')}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      <TagFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={editingTag ? 'edit' : 'create'}
        initialValues={
          editingTag
            ? {
                name: editingTag.name ?? '',
                colorHex: (editingTag.colorHex ?? DEFAULT_TAG_COLOR).toUpperCase(),
                description: editingTag.description ?? '',
              }
            : undefined
        }
        isPending={editingTag ? updateMutation.isPending : createMutation.isPending}
        onSubmit={handleSubmit}
        onCloseAutoFocus={handleFormCloseAutoFocus}
        onDelete={editingTag ? handleDelete : undefined}
        isDeleting={deleteMutation.isPending}
        deleteLabels={
          editingTag
            ? {
                buttonLabel: t('library.tags.deleteTag'),
                confirmTitle: t('library.tags.deleteConfirmTitle'),
                confirmDescription: t('library.tags.deleteConfirmDescription', { name: editingTag.name }),
                confirmButtonLabel: t('library.tags.deleteConfirmSubmit'),
                cancelLabel: t('common.cancel'),
              }
            : undefined
        }
        labels={{
          title: editingTag ? t('library.tags.editTitle') : t('library.tags.createTitle'),
          description: editingTag
            ? t('library.tags.editDescription')
            : t('library.tags.createDescription'),
          nameLabel: t('library.tags.nameLabel'),
          namePlaceholder: t('library.tags.namePlaceholder'),
          colorLabel: t('library.tags.colorLabel'),
          descriptionLabel: t('library.tags.descriptionLabel'),
          descriptionPlaceholder: t('library.tags.descriptionPlaceholder'),
          previewLabel: t('library.tags.previewLabel'),
          previewSampleName: t('library.tags.previewSampleName'),
          submitLabel: editingTag ? t('library.tags.editSubmit') : t('library.tags.createSubmit'),
          savingLabel: t('common.saving'),
          cancelLabel: t('common.cancel'),
          nameRequiredError: t('library.tags.validation.nameRequired'),
          colorInvalidError: t('library.tags.validation.colorInvalid'),
          colorPresetLabels: {
            red: t('library.tags.colors.red'),
            orange: t('library.tags.colors.orange'),
            yellow: t('library.tags.colors.yellow'),
            green: t('library.tags.colors.green'),
            blue: t('library.tags.colors.blue'),
            purple: t('library.tags.colors.purple'),
            pink: t('library.tags.colors.pink'),
            grey: t('library.tags.colors.grey'),
          },
        }}
      />
    </>
  );
}
