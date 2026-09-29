import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Tag as TagIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCreateFoodTag, useFoodTags, useReplaceFoodTagAssignments } from '@/hooks/useIngredientsQueries';
import TagFormDialog, { type TagFormValues } from '@/components/tags/TagFormDialog';
import type { FoodTagDto } from '@/api/food-types';

interface Props {
  foodId: string;
  /** The caller's tags currently assigned to this food. */
  assignedTags: FoodTagDto[];
  /** Called with the resulting tag set once a replace-assignments call succeeds. */
  onAssignedTagsChange: (tags: FoodTagDto[]) => void;
}

/**
 * Per-food tag assignment, used in the Ingredients drawer's tag section
 * (#1120). Mirrors `ClientTagPickerPopover` — built on Popover (not
 * DropdownMenu) so multi-select doesn't fight Radix's close-on-select
 * default, always sends the *full* desired tag set to
 * `replaceFoodTagAssignments` so a stale double-click can't partially
 * apply, and offers the same inline "+ Create tag" entry point that
 * auto-assigns the new tag to this food once created.
 *
 * The popover is controlled (`open`) and closes itself before opening
 * `TagFormDialog`, same as `IngredientTagFilterPopover`.
 */
export default function IngredientTagPickerPopover({ foodId, assignedTags, onAssignedTagsChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tagsQuery = useFoodTags();
  const assignMutation = useReplaceFoodTagAssignments();
  const createMutation = useCreateFoodTag();
  const tags = tagsQuery.data ?? [];
  const assignedIds = new Set(assignedTags.map((tag) => tag.tagId).filter((id): id is string => Boolean(id)));

  function toggleTag(tagId: string) {
    const next = assignedIds.has(tagId)
      ? [...assignedIds].filter((id) => id !== tagId)
      : [...assignedIds, tagId];
    assignMutation.mutate(
      { foodId, tagIds: next },
      { onSuccess: (response) => onAssignedTagsChange(response.tags ?? []) },
    );
  }

  function handleCreateClick() {
    setOpen(false);
    setCreateOpen(true);
  }

  function handleCreateDialogCloseAutoFocus(event: Event) {
    event.preventDefault();
    triggerRef.current?.focus();
  }

  function handleCreateSubmit(values: TagFormValues) {
    createMutation.mutate(
      { name: values.name, colorHex: values.colorHex, description: values.description || undefined },
      {
        onSuccess: (tag) => {
          setCreateOpen(false);
          if (tag.tagId) {
            assignMutation.mutate(
              { foodId, tagIds: [...assignedIds, tag.tagId] },
              { onSuccess: (response) => onAssignedTagsChange(response.tags ?? []) },
            );
          }
        },
      },
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button ref={triggerRef} type="button" variant="ghost" size="icon-xs" aria-label={t('ingredients.tagPicker.open')}>
            <TagIcon className="size-3.5" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          {tagsQuery.isPending ? (
            <p className="text-body text-muted-foreground">{t('common.loading')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {tags.length === 0 ? (
                <p className="text-body text-muted-foreground">{t('ingredients.filters.tagsEmpty')}</p>
              ) : (
                <ul className="flex max-h-64 flex-col gap-2.5 overflow-y-auto">
                  {tags.map((tag) => (
                    <li key={tag.tagId}>
                      <label className="flex cursor-pointer items-center gap-2 text-body text-foreground">
                        {/*
                          Disabled while a write is in flight because the
                          endpoint replaces the whole set and `assignedTags`
                          derives from the parent drawer's local state, which
                          only updates once the response lands. Ticking a
                          second tag before the first returns would compute
                          its set from stale data and silently drop the
                          first one.
                        */}
                        <Checkbox
                          checked={Boolean(tag.tagId) && assignedIds.has(tag.tagId ?? '')}
                          disabled={assignMutation.isPending}
                          onCheckedChange={() => tag.tagId && toggleTag(tag.tagId)}
                        />
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={tag.colorHex ? { backgroundColor: tag.colorHex } : undefined}
                          aria-hidden="true"
                        />
                        {tag.name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <Button type="button" variant="outline" size="sm" onClick={handleCreateClick}>
                <Plus className="size-3.5" aria-hidden="true" />
                {t('ingredients.tagPicker.createTag')}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      <TagFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        isPending={createMutation.isPending}
        onSubmit={handleCreateSubmit}
        onCloseAutoFocus={handleCreateDialogCloseAutoFocus}
        labels={{
          title: t('ingredients.tagPicker.createTitle'),
          description: t('ingredients.tagPicker.createDescription'),
          nameLabel: t('ingredients.tagPicker.nameLabel'),
          namePlaceholder: t('ingredients.tagPicker.namePlaceholder'),
          colorLabel: t('ingredients.tagPicker.colorLabel'),
          descriptionLabel: t('ingredients.tagPicker.descriptionLabel'),
          descriptionPlaceholder: t('ingredients.tagPicker.descriptionPlaceholder'),
          previewLabel: t('ingredients.tagPicker.previewLabel'),
          previewSampleName: t('ingredients.tagPicker.previewSampleName'),
          submitLabel: t('ingredients.tagPicker.createSubmit'),
          savingLabel: t('common.saving'),
          cancelLabel: t('common.cancel'),
          nameRequiredError: t('ingredients.tagPicker.validation.nameRequired'),
          colorInvalidError: t('ingredients.tagPicker.validation.colorInvalid'),
          colorPresetLabels: {
            red: t('ingredients.tagPicker.colors.red'),
            orange: t('ingredients.tagPicker.colors.orange'),
            yellow: t('ingredients.tagPicker.colors.yellow'),
            green: t('ingredients.tagPicker.colors.green'),
            blue: t('ingredients.tagPicker.colors.blue'),
            purple: t('ingredients.tagPicker.colors.purple'),
            pink: t('ingredients.tagPicker.colors.pink'),
            grey: t('ingredients.tagPicker.colors.grey'),
          },
        }}
      />
    </>
  );
}
